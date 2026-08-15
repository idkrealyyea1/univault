# UniVault — Step-by-Step Deployment Guide (GitHub + GitHub Pages + Render + Supabase)

Follow this guide from top to bottom. Copy each command and paste it into your terminal.
Replace the parts in **`<ANGLE BRACKETS>`** with your own values.

> ✅ The frontend paths have already been fixed for GitHub Pages (relative paths), so the
> site will work at `https://<your-username>.github.io/<repo-name>/`.
> ⚠️ Never run `scripts/dev.sh` after deployment — it overwrites `frontend/js/config.js`
> with localhost values. If you do, re-edit `config.js` (Step 4) and push again.

---

## PART 1 — Push the project to GitHub

### 1.1 Create the repo on GitHub

1. Go to https://github.com/new
2. Name it: `<repo-name>` (e.g. `univault`)
3. Visibility: **Private** or **Public** — your choice
4. Do **NOT** tick "Add a README" / ".gitignore" / "license" (the project already has them)
5. Click **Create repository**

### 1.2 Push from your terminal

Copy-paste these, one line at a time:

```bash
cd "/home/idkrealyyea/Desktop/future website"
git init -b main
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<REPO-NAME>.git
git push -u origin main
```

That's it — the code is now on GitHub. The rest is configured through the browser.

---

## PART 2 — Supabase (database + auth + storage)

### 2.1 Create the project

1. Go to https://supabase.com → **Start your project** → sign in (GitHub account works)
2. **New project**:
   - Organization: your name
   - Project name: `univault`
   - Database password: **write it down, you'll need it** (e.g. something long, no special chars that break URLs)
   - Region: the closest one to your users (e.g. `eu-central-1` Frankfurt if you're in Israel)
3. Wait ~2 minutes for the project to spin up

### 2.2 Run the SQL files

1. In the project, open **SQL Editor** → **New query**
2. Open this file on your computer and copy ALL of its content:
   ```
   supabase/schema.sql
   ```
   Paste it in the editor → **Run**
3. Do the same for:
   ```
   supabase/seed.sql        → Run
   supabase/rls.sql         → Run
   ```
   ⚠️ Order matters: schema → seed → rls.

### 2.3 Copy your keys

1. Left sidebar: **⚙️ Project Settings** → **API**
2. Copy these 3 values into a scratch file (you'll paste them into Render and config.js):

```
Project URL:          https://<PROJECT-REF>.supabase.co
anon public key:      eyJ...           (safe to expose)
service_role secret:  eyJ...           (KEEP PRIVATE — only goes in Render)
```

---

## PART 3 — Render (backend API)

### 3.1 Generate the secret values you'll need

In a terminal, **inside the backend folder**:

```bash
cd "/home/idkrealyyea/Desktop/future website/backend"

# 1) bcrypt hash of your admin password (this password logs you into the admin panel):
node -e "console.log(require('bcryptjs').hashSync('PUT-YOUR-ADMIN-PASSWORD-HERE', 10))"

# 2) VAPID keys for push notifications:
npx web-push generate-vapid-keys
```

Copy the outputs — you'll paste them into Render.

### 3.2 Create the Web Service

1. Go to https://render.com → sign up (GitHub account works)
2. **New** → **Web Service** → connect your GitHub repo
3. It will detect the project; configure:

```
Name:                 univault-api
Region:               closest to you (e.g. Frankfurt)
Branch:               main
Root Directory:       backend
Runtime:              Node
Build Command:        npm install
Start Command:        node server.js
Instance Type:        Free
```

4. Click **Advanced** (bottom) → **Add Environment Variable** — add ALL of these:

| Key                       | Value |
|---------------------------|-------|
| `SUPABASE_URL`            | from Step 2.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 2.3 (the secret one) |
| `ADMIN_PASSWORD_HASH`     | the bcrypt output from 3.1 |
| `JWT_SECRET`              | any long random string (e.g. `openssl rand -hex 32`) |
| `ALLOWED_ORIGIN`          | `https://<YOUR-USERNAME>.github.io` ← NO repo path, just the host; must be the **exact** origin (CORS compares scheme + host) |
| `VAPID_SUBJECT`           | `mailto:you@example.com` (your email) |
| `VAPID_PUBLIC_KEY`        | from 3.1 |
| `VAPID_PRIVATE_KEY`       | from 3.1 |

5. Click **Create Web Service** and wait ~3 minutes for it to build and deploy.
6. Copy the deployed URL — it looks like:
   ```
   https://univault-api.onrender.com
   ```
   ⚠️ Free tier Render **sleeps** after 15 min of inactivity; the first request after sleep takes ~50 seconds. Don't panic — it's normal.

---

## PART 4 — Edit the frontend config (IMPORTANT)

Edit this file with a text editor:

```
frontend/js/config.js
```

Set the real values:

```js
const UNIVAULT_CONFIG = {
  SUPABASE_URL: 'https://<PROJECT-REF>.supabase.co',        // from Step 2.3
  SUPABASE_ANON_KEY: 'eyJ...',                               // from Step 2.3
  API_URL: 'https://univault-api.onrender.com',              // your Render URL from Step 3.2
  VAPID_PUBLIC_KEY: 'B...'                                   // from Step 3.1
};
```

Then commit and push so GitHub Pages gets the update:

```bash
cd "/home/idkrealyyea/Desktop/future website"
git add frontend/js/config.js
git commit -m "Set production config"
git push
```

---

## PART 5 — GitHub Pages (frontend)

> The workflow file `.github/workflows/pages.yml` already exists in the repo —
> it publishes the `frontend/` folder automatically on every push.

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment** → **Source**: select **GitHub Actions**
3. Go to the **Actions** tab — you'll see the "Deploy frontend to GitHub Pages" workflow running
4. Wait for it to finish (green ✓)
5. Your site is live at:
   ```
   https://<YOUR-USERNAME>.github.io/<REPO-NAME>/
   ```
   Admin panel:
   ```
   https://<YOUR-USERNAME>.github.io/<REPO-NAME>/admin/
   ```

---

## PART 6 — Make yourself admin + final test

### 6.1 Create your account on the live site

1. Open your live URL → pick a university → pick a field → you'll be sent to **Sign up**
2. Create your account (username + password, min 8 chars)

### 6.2 Promote yourself to admin

1. Back in Supabase → **SQL Editor** → **New query**
2. Open `supabase/admin.sql` on your computer, replace the username in the last line with yours, paste, **Run**

### 6.3 Final check

- [ ] Site loads with all styles/images at the GitHub Pages URL
- [ ] Signup → login → browse works
- [ ] Open `https://<YOUR-USERNAME>.github.io/<REPO-NAME>/admin/` → log in with your admin password → you see the dashboard
- [ ] Add a service, upload a file (Admin → Resources), then request access with a second account and approve it
- [ ] The second account can now open/download the file
- [ ] UCAS → Cybersecurity field shows the special matrix theme

---

## Gotchas (read before you panic)

| Symptom | Cause / Fix |
|---|---|
| Styles/JS missing (broken page) | You didn't push after the path fixes — push again, or the Pages workflow is still running |
| Admin password doesn't work | You must paste the bcrypt **hash**, not the plain password, into `ADMIN_PASSWORD_HASH` on Render, then redeploy |
| API calls fail from the site | Check `ALLOWED_ORIGIN` on Render is exactly `https://<your-username>.github.io` (no trailing slash, no repo name), and `API_URL` in config.js is the full Render URL |
| First API call is very slow | Render free tier is asleep — normal |
| "already registered" on signup | That's a username conflict, not email (synthetic email is `username@univault.local`) |
| Site still shows old localhost config | `scripts/dev.sh` overwrites `frontend/js/config.js` — redo Step 4 and push |
| Push notifications don't arrive | They need HTTPS (GitHub Pages has it) + the same VAPID keys in Render and config.js |

---

## Useful commands

```bash
# Regenerate a JWT secret
openssl rand -hex 32

# Redeploy Render backend after changing env vars
# → Render dashboard → your service → Manual Deploy → Clear build cache & deploy
```
