# FRC Workshop Signup

A self-hosted web app for FRC (FIRST Robotics Competition) teams to coordinate mentor workshop attendance. Mentors sign up for shifts, admins manage the schedule, and a live dashboard shows who's in the shop — perfect for displaying on a TV in the workshop.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)
![SQLite](https://img.shields.io/badge/SQLite-Self--Contained-003B57)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)

## Features

### For Mentors
- **Quick signup** — enter your name and email, pick shifts, optionally add a note ("Bringing pizza", "Late arrival", etc.)
- **No account needed** — mentors are identified by email, no passwords to remember

### For the Shop
- **Live dashboard** — shows the current shift and next shift with all signed-up mentors, auto-refreshes every 30 seconds, designed for a TV/monitor display
- **Leaderboard** — tracks total hours per mentor with season filtering, highlights top 3

### For Admins
- **Shift templates** — define recurring shifts (e.g., every Tuesday 6-9 PM) and bulk-generate weeks of shifts at once
- **One-off shifts** — create ad-hoc shifts for special build days or events
- **Season management** — group stats by build season, off-season, etc.
- **Full branding** — customize app name, browser title, theme colors (6-color palette), and upload a team logo
- **Simple auth** — single admin password, no user management overhead

## Quick Start with Docker

The easiest way to run the app. Everything is self-contained — no external database needed.

```bash
git clone <your-repo-url> mentor-signup
cd mentor-signup
```

Edit `docker-compose.yml` to set your secrets:

```yaml
environment:
  - SESSION_SECRET=your-random-string-at-least-32-characters-long
  - ADMIN_DEFAULT_PASSWORD=your-admin-password
```

Then build and run:

```bash
docker compose up -d
```

The app will be available at **http://localhost:3000**.

The default admin password is `changeme` (or whatever you set in `ADMIN_DEFAULT_PASSWORD`). Change it after first login in **Admin > Settings**.

### Persistent Data

The SQLite database and uploaded logos are stored in a Docker named volume (`mentor-data`) mounted at `/app/data`. Your data survives container rebuilds.

## Local Development

### Prerequisites
- **Node.js 22 LTS** (v24+ has known compatibility issues)
- npm

### Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Initialize database
npx prisma migrate deploy
npx prisma db seed

# Start dev server
npm run dev
```

Open **http://localhost:3000**.

> **Note:** If your project directory is on an exFAT drive (e.g., some external drives), Next.js builds will fail due to lack of symlink support. Copy the project to an NTFS drive for building.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:../data/mentor-signup.db` |
| `SESSION_SECRET` | Secret for encrypting admin session cookies (min 32 chars) | — |
| `ADMIN_DEFAULT_PASSWORD` | Initial admin password set during seeding | `changeme` |
| `NEXT_PUBLIC_APP_NAME` | Fallback app name (overridden by admin branding settings) | `FRC Workshop Signup` |
| `NEXT_PUBLIC_REFRESH_INTERVAL` | Dashboard auto-refresh interval in milliseconds | `30000` |

## Usage Guide

### Initial Setup

1. Navigate to **/admin** and log in with your admin password
2. Go to **Templates** and create your recurring shift schedule (e.g., Tuesday/Thursday 6-9 PM)
3. Click **Generate Shifts** to create the next 4 weeks of shifts from your templates
4. Go to **Seasons** and create a season (e.g., "2026 Build Season") with start/end dates
5. Optionally go to **Settings** to customize your team's branding and colors

### Mentor Workflow

1. Visit the home page and click **Sign Up**
2. Enter name and email
3. Select one or more upcoming shifts and optionally add notes
4. Done — the mentor shows up on the dashboard and leaderboard

### Dashboard Display

Navigate to **/dashboard** on a shop TV or monitor. It auto-refreshes and shows:
- **Current shift** with a pulsing LIVE badge and all signed-up mentors
- **Next shift** with its date, time, and mentor list

## Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Server Components)
- **Database:** [Prisma 6](https://www.prisma.io/) + SQLite
- **Auth:** [iron-session](https://github.com/vvo/iron-session) (encrypted cookies)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/) with runtime CSS custom properties for dynamic theming
- **Deployment:** Docker with multi-stage build, standalone output

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/mentors` | Register or update a mentor |
| `GET` | `/api/shifts` | List upcoming shifts |
| `POST` | `/api/signups` | Sign up for a shift |
| `DELETE` | `/api/signups/:id` | Cancel a signup |
| `GET` | `/api/dashboard` | Current + next shift data |
| `GET` | `/api/leaderboard?seasonId=` | Leaderboard with stats |
| `GET` | `/api/seasons` | List all seasons |
| `GET` | `/api/branding` | App branding settings |
| `GET` | `/api/logo` | Serve uploaded logo |

### Admin Endpoints (session required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/login` | Authenticate |
| `POST` | `/api/admin/logout` | End session |
| `GET/POST` | `/api/admin/templates` | List / create shift templates |
| `PUT/DELETE` | `/api/admin/templates/:id` | Update / delete a template |
| `GET/POST` | `/api/admin/shifts` | List / create shifts |
| `PUT/DELETE` | `/api/admin/shifts/:id` | Update / delete a shift |
| `POST` | `/api/admin/shifts/generate` | Generate shifts from templates |
| `GET/POST` | `/api/admin/seasons` | List / create seasons |
| `PUT/DELETE` | `/api/admin/seasons/:id` | Update / delete a season |
| `POST` | `/api/admin/settings/password` | Change admin password |
| `POST` | `/api/admin/settings/branding` | Update name, title, colors |
| `POST/DELETE` | `/api/admin/settings/logo` | Upload / remove logo |

## Database Schema

```
mentors          — id, name, email (unique), created_at
shift_templates  — id, day_of_week, start_time, end_time, label, active
shifts           — id, date, start_time, end_time, label, cancelled, template_id
signups          — id, mentor_id, shift_id, note, signed_up_at (unique per mentor+shift)
seasons          — id, name, start_date, end_date
settings         — key (PK), value (stores admin password hash, branding, colors)
```

## License

MIT
