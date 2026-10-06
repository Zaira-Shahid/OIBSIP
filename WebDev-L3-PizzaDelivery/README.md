# Pizza Delivery - Full-Stack Application

**Program:** OASIS INFOBYTE Summer Internship Program (OIBSIP)
**Track:** Web Development & Designing · **Level:** 3 · **Task:** 1 - Pizza Delivery Full-Stack Application

A pizza ordering and inventory management platform with separate user and admin roles, a custom pizza builder, Razorpay test-mode payments, automated low-stock email alerts and order status tracking.

> **Status:** under active development, built module by module. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for what is verified so far. Features listed below are the *planned* scope until they are marked ✅ there.

## Tech stack

- **React.js** (Vite) - frontend
- **Node.js + Express.js** - backend API
- **MongoDB** (Atlas) with Mongoose
- **Razorpay** (test mode only) - payments
- `node-cron` + Nodemailer - scheduled low-stock email alerts

## Architecture

```
React frontend (client/)
      ↓  /api  (REST, JSON, JWT)
Express API (server/)
      ↓
MongoDB Atlas
      ↓
External services: Razorpay (test), Gmail SMTP
```

## Repository layout

```
WebDev-L3-PizzaDelivery/
├── client/   React app
├── server/   Express API
└── docs/     Spec, requirements matrix, testing notes
```

## Setup

### Prerequisites
- Node.js 20+ and npm
- A MongoDB Atlas cluster (free tier is enough) and its connection string

### Install
```bash
git clone https://github.com/Zaira-Shahid/OIBSIP.git
cd OIBSIP/WebDev-L3-PizzaDelivery

cd server && npm install
cd ../client && npm install
```

### Configure the backend
```bash
cd server
cp .env.example .env     # on Windows PowerShell: Copy-Item .env.example .env
```
Fill in `server/.env`. Never commit this file. Variables:

| Variable | Needed from | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Module 1 (required now) | Atlas connection string |
| `JWT_SECRET` | Module 2 (required) | Signs login tokens (32+ characters) |
| `JWT_EXPIRES_IN` | Module 2 | Token lifetime, default `1d` |
| `AUTH_REQUIRE_VERIFIED` | Module 2 (temporary) | `false` lets unverified users log in during development; ignored in production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Module 2 | Used only by `npm run seed:admin` |
| `CLIENT_URL` | Module 1 | CORS origin / email links (default `http://localhost:5173`) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | Module 3 | Gmail SMTP (App Password) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Module 7 | Razorpay **test** keys |

### Create the admin account
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env`, then:
```bash
cd server && npm run seed:admin
```
It is safe to run again: an existing admin is never duplicated or overwritten. There is no public "register as admin" route.

### Run
```bash
# terminal 1
cd server && npm run dev      # http://localhost:5000

# terminal 2
cd client && npm run dev      # http://localhost:5173
```
The Vite dev server proxies `/api` to the backend. Check `http://localhost:5000/api/health`.

## Troubleshooting

- **`querySrv ECONNREFUSED` on startup** - Node's DNS resolver can fail the `mongodb+srv://` lookup on some networks (seen with Pakistani ISP DNS) even when the OS resolves it. The server detects this specific failure and retries once with Google/Cloudflare public DNS; networks that work normally never use the fallback. Alternatives: set your OS DNS to 8.8.8.8, or use Atlas's standard (non-SRV) `mongodb://` connection string.
- **"Could not connect to any servers"** - add your IP under Atlas *Network Access*.

## Tests
```bash
cd server && npm test
```
Runs against a separate `pizza-delivery-test` database and cleans up after itself.

## Docs
- [Requirements & traceability](docs/REQUIREMENTS.md)
- [Testing notes](docs/TESTING.md)
- [Master specification](docs/OIBSIP_WebDev_Level3_PizzaDelivery_Master_Spec.md)
