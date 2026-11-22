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

See the plan doc for the full architecture and phase breakdown.
