# Deploy CWT Inventory To Railway (Beginner Step-By-Step)

Goal: keep your app running online 24/7, even when your PC is off.

## Step 1: Install Git (one time)

Your terminal currently does not have `git`, so do this first.

1. Go to: https://git-scm.com/download/win
2. Run installer.
3. Keep default options and click Next until Install.
4. Close and re-open Command Prompt.
5. Verify:

```powershell
git --version
```

You should see something like `git version 2.x.x`.

## Step 2: Go to your project folder

```powershell
cd /d C:\Users\lechi\Documents\Codex
```

## Step 3: Create a GitHub repository (website)

1. Go to https://github.com
2. Click `+` (top right) -> `New repository`
3. Repository name: `cwt-inventory`
4. Keep it Public or Private (your choice)
5. Click `Create repository`
6. Keep that page open (you need the URL)

## Step 4: Push your code to GitHub

Run these commands in `C:\Users\lechi\Documents\Codex`:

```powershell
git init
git add .
git commit -m "Initial CWT Inventory app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cwt-inventory.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

If asked to sign in, complete GitHub login in the popup/browser.

## Step 5: Create Railway project from GitHub

1. Go to https://railway.app
2. Sign in with GitHub
3. Click `New Project`
4. Click `Deploy from GitHub Repo`
5. Select `cwt-inventory`
6. Wait for first deploy to start

## Step 6: Set the start command

In Railway, open your service settings and set:

- Start Command: `npm run web`

## Step 7: Add environment variables

In Railway service -> Variables, add:

- `HOST` = `0.0.0.0`
- `CWT_DATA_DIR` = `/app/data`

Do not manually set `PORT` unless Railway asks. Railway normally provides it.

## Step 8: Attach persistent storage (important)

Without this, data resets on redeploy.

1. In Railway project, click `New` -> `Volume`
2. Attach it to your web service
3. Mount path: `/app/data`

Persistent files stored there:

- `inventory-data.json`
- `app-settings.json`
- `backups/`

## Step 9: Open your live app URL

1. In Railway service, open the generated domain
2. It should load your inventory app in browser
3. Add one test item to confirm saving works

## Step 10: Verify persistence

1. In Railway, click `Redeploy`
2. After deploy completes, open app again
3. Confirm your test item is still there

If item remains, persistent storage is configured correctly.

## Updating your app later

When you change code locally:

```powershell
cd /d C:\Users\lechi\Documents\Codex
git add .
git commit -m "Describe your update"
git push
```

Railway will auto-redeploy from GitHub.

## Notes

- Daily automatic backup is already built into the app.
- Manual backup from Settings still works.
