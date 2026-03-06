const ExcelJS = require('exceljs');
const db = require('./database');

async function importExcelCompanies() {
  try {
    console.log('Starting import from d:\\Sales 2024.xlsx...');
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('d:\\Sales 2024.xlsx');
    const worksheet = workbook.getWorksheet(1);
    
    const companies = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        console.log('Header:', row.values);
        return; // Skip header
      }
      
      const company = {
        name: row.getCell(1).value || '',
        machineModel: row.getCell(2).value || '',
        serviceTag: row.getCell(3).value || '',
        expressCode: row.getCell(4).value || '',
        notes: row.getCell(5).value || ''
      };
      
      if (company.name) {
        companies.push(company);
        console.log(`Row ${rowNumber}:`, company);
      }
    });
    
    console.log(`\nTotal companies to import: ${companies.length}`);
    
    if (companies.length > 0) {
      const imported = db.addCompanies(companies);
      console.log(`Successfully imported ${imported.length} companies`);
      
      const stats = db.getStats();
      console.log('Database stats:', stats);
      
      console.log('\nAll companies in database:');
      const allCompanies = db.getAllCompanies();
      allCompanies.forEach(c => {
        console.log(`- ${c.name} | ${c.machineModel} | ${c.serviceTag} | ${c.expressCode}`);
      });
    }
  } catch (error) {
    console.error('Error importing Excel:', error);
    process.exit(1);
  }
}

// Initialize and import
db.initDatabase();
importExcelCompanies();
