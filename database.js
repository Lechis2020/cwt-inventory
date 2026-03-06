const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'companies.json');

// Initialize database file if it doesn't exist
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      companies: [],
      machines: [],
      notes: []
    }, null, 2));
  }
}

// Read database
function readDatabase() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { companies: [], machines: [], notes: [] };
  }
}

// Write database
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Add company
function addCompany(company) {
  const db = readDatabase();
  const newCompany = {
    id: Date.now(),
    ...company,
    createdAt: new Date().toISOString()
  };
  db.companies.push(newCompany);
  writeDatabase(db);
  return newCompany;
}

// Get all companies
function getAllCompanies() {
  const db = readDatabase();
  return db.companies;
}

// Search companies
function searchCompanies(term) {
  const db = readDatabase();
  return db.companies.filter(company =>
    company.name.toLowerCase().includes(term.toLowerCase()) ||
    (company.machineModel && company.machineModel.toLowerCase().includes(term.toLowerCase()))
  );
}

// Delete company
function deleteCompany(id) {
  const db = readDatabase();
  db.companies = db.companies.filter(c => c.id !== id);
  writeDatabase(db);
  return true;
}

// Add multiple companies (bulk import)
function addCompanies(companies) {
  const db = readDatabase();
  const newCompanies = companies.map(company => ({
    id: Date.now() + Math.random(),
    ...company,
    createdAt: new Date().toISOString()
  }));
  db.companies.push(...newCompanies);
  writeDatabase(db);
  return newCompanies;
}

// Add note to company
function addNote(companyId, timestamp, noteText) {
  const db = readDatabase();
  const company = db.companies.find(c => c.id === companyId);
  
  if (company) {
    if (!company.notes) {
      company.notes = {};
    }
    company.notes[timestamp] = noteText;
    writeDatabase(db);
    return true;
  }
  return false;
}

// Get statistics
function getStats() {
  const db = readDatabase();
  return {
    totalCompanies: db.companies.length,
    totalMachines: db.companies.reduce((sum, c) => sum + (c.machines ? c.machines.length : 1), 0),
    recentNotes: db.notes ? db.notes.length : 0
  };
}

module.exports = {
  initDatabase,
  readDatabase,
  writeDatabase,
  addCompany,
  getAllCompanies,
  searchCompanies,
  deleteCompany,
  addCompanies,
  addNote,
  getStats
};
