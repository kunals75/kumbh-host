# Kumbh Host portal

Homestay owner portal for managing listings, photos, and bookings.

## Setup

```bash
cd kumbh-host
npm install
cp .env.example .env   # set VITE_API_BASE_URL
npm run dev
```

## Auth

Hosts log in with credentials created by admin (`role=host`). Uses the same session cookie as kumbh-admin against `/api/v1/admin/auth/login`.

## Deploy

Build static assets and serve at `host.kumbhguide.com` (nginx vhost). Add the host origin to `ALLOWED_ORIGINS` in kumbh-api `.env`.
