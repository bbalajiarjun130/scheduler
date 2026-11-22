# Scheduler

Personal scheduling, meeting approval, and project time-management platform.

## Local development

```bash
npm install
npm run docker:up                 # starts local MongoDB on :27017
cp apps/api/.env.example apps/api/.env   # fill in secrets (openssl rand -hex 32)
cp apps/web/.env.example apps/web/.env
npm run dev:api                   # http://localhost:4000
npm run dev:web                   # http://localhost:5173
```

The first account you sign up through `/signup` is automatically made the Administrator
(approved immediately). Every subsequent signup lands in `pending` and needs approval
from `/admin/users`.

## Tests

```bash
npm run test -w apps/api
```

## Deployment

- `render.yaml` — backend (Node web service) on Render.
- `apps/web/vercel.json` — frontend (static Vite build) on Vercel.
- MongoDB Atlas for the production database (`MONGODB_URI`).

### One-time account setup checklist

1. **MongoDB Atlas** — create a free (M0) cluster, add a database user, allow network
   access from Render's IPs (or `0.0.0.0/0` for simplicity on a free cluster), and copy
   the connection string into Render's `MONGODB_URI`.
2. **Render** — new Web Service from this repo, it will pick up `render.yaml`
   automatically (Blueprint deploy). Fill in the `sync: false` env vars in the
   dashboard: `MONGODB_URI`, `WEB_ORIGIN`/`WEB_BASE_URL`/`APP_BASE_URL` (your Vercel and
   Render URLs), and the Resend/Google values below once you have them.
3. **Vercel** — import this repo, set the root directory to `apps/web` (it already has
   its own `vercel.json`), and add `VITE_API_URL` pointing at your Render service's URL
   and `VITE_GOOGLE_CLIENT_ID` (same value as the backend's `GOOGLE_CLIENT_ID`).
4. **Resend** (optional — emails are console-logged until this is set) — create an API
   key at resend.com, add it as `RESEND_API_KEY` on Render, and set `EMAIL_FROM` to a
   verified sending address.
5. **Google Cloud OAuth** (optional — enables "Sign in with Google" and the Calendar/Meet
   integration) — at console.cloud.google.com/apis/credentials, create an OAuth 2.0
   Client ID (Web application):
   - Authorized JavaScript origins: your Vercel URL (and `http://localhost:5173` for
     local dev) — required for Sign-In.
   - Authorized redirect URIs: `<your-render-url>/api/integrations/google/callback`
     (and the `localhost:4000` equivalent for local dev) — required for the Calendar
     integration specifically; omitting this breaks only that feature, not sign-in.
   - Put the Client ID in `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID`
     (frontend, same value), and the Client Secret in `GOOGLE_CLIENT_SECRET` (backend
     only — never the frontend).
   - Then, as the admin, connect it from `/admin/settings` in the running app.

None of this is required to run the app locally — everything above degrades gracefully
to a console-logged/disabled state until configured.

See the plan doc for the full architecture and phase breakdown.
