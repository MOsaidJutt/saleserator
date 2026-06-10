# Saleserator Academy

**A multi-tenant sales enablement platform — LMS + sales gamification engine + live "TV Mode" leaderboard broadcast — built end-to-end with a Node/Express/PostgreSQL API and a React 19 frontend.**

---

## 1. One-line pitch (Upwork title / Toptal headline)

> Full-stack multi-tenant SaaS for sales teams: video training (LMS), points & rank gamification, real-time leaderboards, and a live "TV Mode" broadcast screen for the sales floor.

## 2. Short description (Upwork portfolio entry / Toptal project summary)

Saleserator Academy is a white-labeled, multi-tenant SaaS I designed and built for sales organizations that want to train and motivate their reps in one place. Each company gets an isolated, branded workspace (own logo, theme, courses, users and leaderboards) reachable at its own URL slug. Sales reps watch video courses, log daily activities (calls, emails, demos, deals, etc.) and earn "SP" (sales points) that drive a rank-progression system and live leaderboards. A dedicated **TV Mode** screen streams real-time deal alerts, SP pop-ups and rank-up celebrations to office monitors via Server-Sent Events. Admins get a period-aware "Command Center" dashboard with team performance trends, mission-mix charts, top performers and at-risk-rep detection. A hidden Super Admin panel provisions new company tenants and their first admin accounts.

I built the entire stack solo: REST API, PostgreSQL schema (including triggers/functions for points sync, rank progression and leaderboard refresh), the S3 video pipeline, and every React screen across three role-based experiences (Super Admin, Company Admin, Sales Rep).

---

## 3. The problem it solves

Sales managers typically juggle three separate tools: a training/LMS platform, a CRM for activity tracking, and a spreadsheet or third-party app for leaderboards/competitions. Saleserator merges all three into a single branded product that any company can be onboarded into in minutes, with zero cross-tenant data leakage and a "wow factor" live broadcast screen for the sales floor.

---

## 4. Key Features

### Multi-tenancy, auth & branding
- Slug-based tenant routing (`/:company_slug/dashboard`, `/:company_slug/admin/...`, `/:company_slug/tv`)
- JWT authentication (7-day tokens) with bcrypt password hashing
- Three roles — **Super Admin**, **Company Admin**, **Sales Rep** — enforced via middleware route guards
- Invite-only onboarding (self-signup disabled; admins create rep accounts)
- Per-tenant white-labeling: company logo, name and theme colors via a Brand Settings screen, applied app-wide through a `BrandProvider`
- Every query is scoped by `company_id`, guaranteeing strict data isolation between tenants

### Sales gamification engine
- Activity logging across categories (Combat Ops, R&D/Intel, Training, Deals) with point values
- PostgreSQL triggers automatically sync a rep's total SP whenever an activity is inserted
- Company-configurable rank tiers (`rank_rules`) with badge colors and progress-to-next-rank percentages
- Daily / weekly / monthly / all-time leaderboards computed via dedicated SQL functions (`mk_period_key`, `refresh_leaderboard`)
- Automatic rank-up detection that fires a real-time celebration event

### Live "TV Mode" broadcast
- Full-screen, token-authenticated display designed for office TVs/monitors (no user login required on the TV itself)
- Real-time updates via **Server-Sent Events**, scoped per company
- Animated UI: floating "+SP" pop-ups, "Deal Closed" banners, full-screen rank-up overlays, and a live activity ticker
- Podium + Top-10 leaderboard with period switching (Today / Week / Month / All-time) and keyboard shortcuts

### Admin Command Center (analytics dashboard)
- Period-aware (daily/weekly/monthly/all-time) team performance view with period-over-period % deltas
- Mission-distribution chart (Combat / Intel / Training mix) rendered with Chart.js
- Top-performer leaderboard with per-rep activity breakdowns
- "At-risk rep" detection — flags reps with zero activity today or a declining 3-day trend
- Recent company-wide activity feed
- One-click generator for tokenized TV Mode links

### Course / LMS system
- Admin course authoring (create, edit, hide/unhide, delete) with categories and per-course point values
- Direct browser-to-S3 video uploads via short-lived presigned URLs (multi-file, no large payloads through the API)
- Per-tenant S3 key namespacing (`courses/<company_slug>/<course_id>/...`) for storage isolation
- Per-asset watch-progress tracking (resume position, completion %) and automatic course-completion recalculation when new videos are added
- Rep-facing course catalog, detail pages and an in-browser video player

### Super Admin panel
- Hidden, password-gated route for the platform operator
- Create new company tenants (auto-generated unique slug + DB function that seeds default rank tiers and activity categories)
- Create the first admin account for each company
- Directory views of all companies and admins

---

## 5. Architecture & technical highlights

- **Database-driven gamification** — points totals, rank assignment and leaderboard rankings are computed by PostgreSQL triggers and functions, keeping the numbers consistent even under concurrent activity inserts, instead of relying on application-layer recalculation.
- **Real-time without a websocket server** — TV Mode combines short-interval polling with a lightweight in-memory **SSE broadcaster** (`tvEvents.js`) that fans out company-scoped events to connected screens, avoiding the operational overhead of a full websocket/pubsub layer for an MVP.
- **Security-conscious API** — global + auth-specific rate limiting (`express-rate-limit`), Zod request validation, centralized error handling middleware, JWT + role guards on every protected route, and process-level crash guards (`unhandledRejection` / `uncaughtException`).
- **Cost-efficient media pipeline** — videos never touch the API server; the backend only issues presigned S3 PUT/GET URLs, so upload/download bandwidth scales independently of the Node process.
- **Strict tenant isolation** — every admin/user SQL query is parameterized and filtered by `company_id`, and S3 object keys are namespaced by company slug, so one tenant's data and media can never be queried or accessed by another.
- **Token-scoped device access** — TV screens authenticate with a separate hashed token (`tvToken.js` + `tvAuth` middleware) rather than a user JWT, so a TV display can be deployed in a public area without exposing staff credentials.

---

## 6. Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, React Router v7, Chart.js / react-chartjs-2, Framer Motion, Axios, Lucide Icons |
| **Backend** | Node.js, Express 5, JWT, bcrypt, Zod, express-rate-limit, Server-Sent Events |
| **Database** | PostgreSQL (custom triggers & functions for points, ranks and leaderboards) |
| **Storage** | AWS S3 (presigned uploads/downloads via AWS SDK v3) |
| **Tooling** | ESLint, Prettier, Jest + Supertest |

---

## 7. My role

Sole full-stack developer — designed the multi-tenant data model and PostgreSQL schema (including triggers/functions), built the entire Express API, implemented the AWS S3 upload pipeline, and developed every React screen for the Super Admin, Company Admin and Sales Rep experiences, including the real-time TV Mode broadcast UI.

---

## 8. Screenshots

> Add screenshots/GIFs here before publishing — recommended shots:
> - Sales rep dashboard (rank badge, progress bar, course catalog)
> - Admin Command Center (mission distribution chart, top performers, at-risk reps)
> - TV Mode in action (podium, live ticker, rank-up overlay, deal banner)
> - Course upload / video library screen
> - Brand Settings (white-label theming)

![Saleserator logo](./WhatsApp%20Image%202025-10-18%20at%2022.11.11_d7b4ebe3.jpg)

---

## 9. Links

- **Repository:** https://github.com/MOsaidJutt/saleserator
- **Live demo:** _add your deployed URL here_
