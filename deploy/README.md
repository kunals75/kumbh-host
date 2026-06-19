# Kumbh Host — server deploy

Homestay owner portal for managing listings, photos, and bookings.

**Production URL:** https://host.kumbhguide.com

| Subdomain | App |
|-----------|-----|
| `kumbhguide.com` | Public website |
| `admin.kumbhguide.com` | Admin panel |
| `api.kumbhguide.com` | API |
| `host.kumbhguide.com` | Host portal |

| Path | Purpose |
|------|---------|
| `/var/www/kumbh/host` | Built static host UI (`dist/`) |

## Local dev

```bash
cd kumbh-host
npm install
cp .env.example .env   # set VITE_API_BASE_URL
npm run dev
```

## Auth

Hosts log in with credentials created by admin (`role=host`). Uses the same session cookie as kumbh-admin against `/api/v1/admin/auth/login`.

Flow:

1. Applicant submits the form on the public `/stays` page.
2. Admin approves in **kumbh-admin** → creates a host user + temp password (shown once).
3. Host signs in at **host.kumbhguide.com**, creates draft listings and uploads photos.
4. Admin publishes listings so they appear on the public website.

---

## Step-by-step server setup

### 1. DNS — create the subdomain

In your DNS provider (where `kumbhguide.com` is managed):

1. Add an **A record** (or CNAME if you use one for the other subdomains):
   - **Name:** `host`
   - **Value:** same IP as `admin.kumbhguide.com` / `kumbhguide.com`
2. Wait for DNS to propagate (often a few minutes).

Verify:

```bash
dig +short host.kumbhguide.com
```

### 2. API — allow the host origin

On the VPS, edit the API `.env`:

```bash
ssh droid@e2e-112-197
sudo nano /var/www/kumbh/api/.env
```

Ensure `ALLOWED_ORIGINS` includes the host subdomain (comma-separated, no spaces):

```
ALLOWED_ORIGINS=https://kumbhguide.com,https://www.kumbhguide.com,https://admin.kumbhguide.com,https://host.kumbhguide.com
```

Restart the API:

```bash
sudo systemctl restart kumbh-api
```

Without this, login from the host portal will fail due to CORS.

### 3. Build kumbh-host

On your dev machine:

```bash
cd kumbh-host
git pull origin main
npm install
cp .env.example .env
# VITE_API_BASE_URL=https://api.kumbhguide.com
npm run build
```

This produces a `dist/` folder with static files.

### 4. Create the directory on the server

```bash
ssh droid@e2e-112-197 "sudo mkdir -p /var/www/kumbh/host && sudo chown droid:droid /var/www/kumbh/host"
```

### 5. Sync built host UI → server

```bash
rsync -avz --delete dist/ droid@e2e-112-197:/var/www/kumbh/host/
```

### 6. Nginx

On the server (from a checkout of this repo, or copy the conf file manually):

```bash
sudo cp deploy/nginx/kumbh-host.conf /etc/nginx/sites-available/kumbh-host
sudo ln -sfn /etc/nginx/sites-available/kumbh-host /etc/nginx/sites-enabled/kumbh-host
sudo nginx -t && sudo systemctl reload nginx
```

### 7. HTTPS (SSL)

Use the **same method** you used for `admin.kumbhguide.com`. For example, with Certbot:

```bash
sudo certbot --nginx -d host.kumbhguide.com
```

If you use Cloudflare or another proxy, mirror whatever you did for the admin subdomain.

### 8. Smoke test

1. Open **https://host.kumbhguide.com** — you should see the “Host sign in” page.
2. In **https://admin.kumbhguide.com**, go to **Host applications**, approve an applicant (username + temp password shown once).
3. Sign in at **host.kumbhguide.com** with those credentials.
4. Create a draft listing and upload a photo.
5. In admin, publish the listing so it appears on the public stays page.

---

## What you do not need

- **No new backend service** — kumbh-host is static files only; it talks to the existing API.
- **No separate database** — hosts, listings, and bookings use the same SQLite DB as the API.
- **No source code on the server** — only `dist/` needs to be deployed (same as admin/website).

---

## Future deploys

After changes to kumbh-host:

```bash
cd kumbh-host
git pull
npm install   # if package.json changed
npm run build
rsync -avz --delete dist/ droid@e2e-112-197:/var/www/kumbh/host/
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login fails / CORS error in browser console | Add `https://host.kumbhguide.com` to `ALLOWED_ORIGINS`, restart API |
| 404 on refresh | Missing `try_files ... /index.html` in nginx |
| “Not a host account” | User must have `role=host` (created when admin approves an application) |
| Cookie/auth issues | API must be `https://api.kumbhguide.com`; host portal must be `https://host.kumbhguide.com` (not mixed http/https) |
