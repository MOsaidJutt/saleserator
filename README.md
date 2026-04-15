# Saleserator Academy — Setup Guide

## Prerequisites

- Node.js v18 or higher
- npm
- A Supabase account (PostgreSQL)
- An AWS S3 bucket

---

## Project Structure

```
saleserator/
├── frontend/
└── backend/
```

---

## 1. Database Setup

**Running locally (pgAdmin):**

1. Open pgAdmin and create a new database named `saleserator`
2. Right-click the database → **Restore** or use the Query Tool
3. Import the `saleserator.sql` file included in the repository

**Migrating to a cloud service (Supabase, Railway Postgres, etc.):**

1. Create a new project on your chosen platform (e.g. [supabase.com](https://supabase.com))
2. Open the SQL Editor
3. Open `simple database.txt` from the repository — this file is migration-ready and will run directly in any SQL editor
4. Paste and run the full script — it will create all tables, functions, and seed default data
5. Once complete, run the three trigger statements at the bottom of the file separately:

```sql
CREATE TRIGGER trg_user_points_sync_from_activities
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.fn_user_points_sync_from_activities();

CREATE TRIGGER trg_uvp_bump
AFTER INSERT OR UPDATE OF position_sec ON public.user_video_progress
FOR EACH ROW EXECUTE FUNCTION public.bump_daily_activity();

CREATE TRIGGER trg_uvp_kpi
AFTER INSERT OR UPDATE OF position_sec ON public.user_video_progress
FOR EACH ROW EXECUTE FUNCTION public.uvp_after_change_recompute();
```

6. Get your database credentials from your platform's connection settings and fill in the backend `.env` accordingly

---

## 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside the `/backend` folder with the following variables:

| Variable | Description |
|---|---|
| `FRONTEND_URL` | The URL of the deployed frontend app, used for CORS and redirects |
| `SUPER_ADMIN_PASSWORD` | Password required to access the /superadmin panel |
| `DB_HOST` | PostgreSQL database host address |
| `DB_PORT` | PostgreSQL database port |
| `DB_USER` | PostgreSQL database username |
| `DB_PASSWORD` | PostgreSQL database password |
| `DB_NAME` | Name of the PostgreSQL database |
| `PORT` | Port the backend server listens on |
| `JWT_SECRET` | Secret key used to sign and verify authentication tokens |
| `NODE_ENV` | Environment mode — set to `development` locally, `production` on live deployment |
| `AWS_REGION` | AWS region where the S3 bucket is hosted |
| `AWS_S3_BUCKET` | Name of the S3 bucket used for course video storage |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID for S3 operations |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key for S3 operations |

Start the backend:

```bash
node app.js
```

Runs on `http://localhost:5000`

---

## 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file inside the `/frontend` folder with the following variable:

| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Base URL pointing to the backend API |

Start the frontend:

```bash
npm start
```

Runs on `http://localhost:3000` or your preferred service generated domain.

---

## 4. Super Admin

Accessible at `/superadmin` — not linked from anywhere in the app by design.
Protected by the `SUPER_ADMIN_PASSWORD` environment variable.
Use this to create companies and admin accounts.

---

## Support

For any questions regarding setup reach out to the original developer.