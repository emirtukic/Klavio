# Klavio - Football Club Management Platform

Klavio is a multi-tenant web application for managing football clubs in Bosnia and Herzegovina. It covers everything a club needs - members, training, matches, finances, digital forms, lineups, statistics, and more - under a single platform with three subscription tiers.

Built as a thesis project at the Faculty of Information Technologies, University of Sarajevo.

---

## Features

### Available on all plans (Starter - free)
- Member management (profiles, positions, statuses)
- Training schedule with RSVP and attendance tracking
- Match results, goals and assists
- Visual lineup builder (drag & drop formation)
- Announcements and notification board
- Calendar view
- Club branding (logo, primary colour)
- PWA - installable on mobile, works offline
- In-app support chat

### Pro plan (40 KM/month)
- Up to 150 members, 5 selections
- Financial management (income/expense tracking)
- Membership fee tracking per player
- Player statistics (goals, assists, cards, minutes)
- Player development tracking (technical, tactical, physical ratings)
- Photo gallery
- **Digital forms** - fill FSKS, NS BiH, NS FBiH forms in-app, download or print as PDF

### Klub plan (60 KM/month)
- Unlimited members and selections
- Medical records per player
- Equipment inventory management
- Sponsors and contract management
- Automated daily data backup
- Priority support
- Advanced reports

### Super Admin panel
- Club management (create, edit, delete, access any club)
- Subscription management
- Platform analytics (revenue, growth, subscriptions)
- Forms usage analytics (which clubs use which forms, trends)
- Platform-wide invoicing
- System notifications and support tickets

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Backend framework** | Express.js v5 |
| **Database** | MySQL 8 |
| **ORM / query** | mysql2/promise (connection pool) |
| **Authentication** | JWT (jsonwebtoken) + bcryptjs |
| **File uploads** | Multer |
| **Email** | Nodemailer (Gmail SMTP) |
| **Scheduled jobs** | node-cron |
| **Digital forms** | pdf-lib (client-side PDF fill) + docxtemplater/pizzip (DOCX templating) |
| **Frontend** | Vanilla HTML, CSS, JavaScript (no framework) |
| **UI components** | Bootstrap 5.3 + Bootstrap Icons |
| **Charts** | Chart.js 4.4 |
| **Environment** | dotenv |

---

## Project Structure

```
klavio/
├── backend/
│   ├── config/          # Database pool, mailer, email templates
│   ├── controllers/     # Route handler logic
│   ├── middleware/       # JWT auth, role check
│   ├── routes/          # Express routers
│   ├── services/        # Cron jobs, notification services
│   ├── seed_demo.js     # Optional: seed 4 demo clubs with realistic data
│   ├── .env             # Environment variables (not committed)
│   └── server.js        # Entry point
├── database/
│   ├── schema.sql       # Full database schema
│   ├── seed.sql         # Bootstrap seed (super admin account)
│   └── migrate_*.sql    # Incremental migration files
├── frontend/
│   ├── assets/
│   │   ├── css/         # Global styles
│   │   ├── js/          # auth.js, api.js, utils.js (shared logic)
│   │   ├── img/         # Logos and icons
│   │   └── uploads/     # Club logos and user avatars (gitignored)
│   ├── pages/           # App pages (dashboard, members, matches, etc.)
│   └── website/         # Public marketing site
├── obrazci/             # PDF and DOCX form templates
└── README.md
```

---

## Prerequisites

- **Node.js** v18 or newer - [nodejs.org](https://nodejs.org)
- **MySQL** 8.0 or newer - [mysql.com](https://dev.mysql.com/downloads/)
- A Gmail account (or other SMTP provider) for sending emails

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/klavio.git
cd klavio
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Set up the database

Open MySQL and run the schema and seed files in order:

```sql
source database/schema.sql
source database/seed.sql
```

Then run each migration file in order:

```bash
# In MySQL client
source database/migrate_multitenancy.sql
source database/migrate_selections.sql
source database/migrate_profile.sql
source database/migrate_features.sql
source database/migrate_email_verification.sql
source database/migrate_plans.sql
source database/migrate_equipment_selection.sql
```

> **Optional demo data** - to populate the database with 4 realistic Bosnian clubs (FK Sarajevo, HŠK Zrinjski Mostar, FK Željezničar, FK Sloboda Tuzla) run:
> ```bash
> cd backend
> node seed_demo.js
> ```

### 4. Configure environment variables

Create a `.env` file inside the `backend/` folder:

```env
# Server
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=club_management

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Email (Gmail SMTP)
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_gmail_app_password

# App base URL (used in email links)
APP_URL=http://localhost:3000
```

> For Gmail, generate an **App Password** in your Google account settings (requires 2-Step Verification enabled).

### 5. Start the server

```bash
cd backend
npm start
```

The app runs at **http://localhost:3000**

---

## First Login

After running the seed file, a super admin account is created:

| Field | Value |
|---|---|
| Email | `klavio.app@gmail.com` |
| Password | `admin123` |

> Change this password immediately after first login.

The super admin can create clubs, assign subscriptions, and access any club through the platform admin panel at `/pages/dashboard/super-admin.html`.

---

## Subscription Plans

| | Starter | Pro | Klub |
|---|---|---|---|
| Price | Free | 40 KM/month | 60 KM/month |
| Members | 25 | 150 | Unlimited |
| Selections | 1 | 5 | Unlimited |
| Finances | ✗ | ✓ | ✓ |
| Digital forms | ✗ | ✓ | ✓ |
| Medical records | ✗ | ✗ | ✓ |
| Equipment | ✗ | ✗ | ✓ |
| Backup | ✗ | ✗ | ✓ |

Subscriptions are managed by the super admin through the platform dashboard.

---

## Environment Notes

- The `backend/.env` file is **not committed** to version control.
- Uploaded files (`frontend/assets/uploads/`) are **not committed** - add them to `.gitignore`.
- The `backend/node_modules/` directory is **not committed**.
