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
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | Module 3 | Gmail SMTP (App Password). If `EMAIL_USER`/`EMAIL_PASSWORD` are empty and `NODE_ENV=development`, emails are printed to the server console instead of sent |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Module 7 | Razorpay **test** keys only (`rzp_test_...`; live keys are refused). Until both are set, paying returns "Online payments are not configured yet" |

### Create the admin account
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env`, then:
```bash
cd server && npm run seed:admin
```
It is safe to run again: an existing admin is never duplicated or overwritten. There is no public "register as admin" route.

Staff sign in at `/admin/login` (linked as "Staff login" in the footer), which calls `POST /api/admin/login`. Customers cannot use it and admins cannot use the customer login. Everything under `/api/admin` (except that login) requires a valid admin token, checked against the database on every request.

### Low-stock email alerts
A `node-cron` job checks stock on a schedule and emails **one digest** listing every ingredient that newly became low or out of stock. Configure in `server/.env`:

| Variable | Purpose |
| --- | --- |
| `LOW_STOCK_CHECK_CRON` | How often to check, as a cron expression. Default `*/15 * * * *` (every 15 minutes). Use `*/1 * * * *` for a 1-minute demo. |
| `ADMIN_ALERT_EMAIL` | Where alerts go; falls back to `ADMIN_EMAIL`. Needs the Gmail SMTP settings from Module 3 (without SMTP, development prints the email to the server console). |

No spam: an item is emailed once per state. It is emailed again only if it gets worse (low to out of stock), or after it was restocked to its threshold and later drops again. The inventory page has a **Run low-stock check now** button for demos; it runs the same job with the same rules. The server logs one line per run, for example `[low-stock] checked 21 items, alerted 2`.

### Change the admin password
`seed:admin` never overwrites a password, so use the separate script. Put the admin's email in `ADMIN_EMAIL` and the **new** password in `ADMIN_PASSWORD` in `server/.env`, then:
```bash
cd server && npm run admin:reset-password
```
It updates only that account, applies the normal password rule (8-72 characters, a letter and a number), refuses an email that is not an admin account, and signs out every admin session issued before the change. There is no email-based admin reset by design. Remove the new password from `.env` afterwards if you do not want it stored there.

### Admin and customer at the same time
The browser keeps one login per browser profile, so signing in as admin replaces a customer session in the same window. To use both at once (for example in the demo), open the admin in a **private/incognito window** and the customer in a normal window; they do not share storage.


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
- **Emails are not arriving** - use a Gmail *App Password* (Google account > Security > 2-Step Verification > App passwords), not your normal password, and check the spam folder. Without SMTP settings in development the link is printed in the server console.
- **"Could not connect to any servers"** - add your IP under Atlas *Network Access*.

## Tests
```bash
cd server && npm test
```
Runs against a separate `pizza-delivery-test` database and cleans up after itself. Payment tests use a fake Razorpay gateway and override any keys in `.env`, so they never contact Razorpay.

## Payments (Razorpay test mode)
1. "Proceed to pay" creates an unpaid order; the server then creates a Razorpay order for the stored amount (in paise) and the browser opens Razorpay Checkout.
2. After payment the browser sends the three checkout values to `POST /api/payments/verify`. The server checks the signature, moves the order to `PAID`, takes the stock (`stock >= quantity` for each ingredient, atomically, all-or-nothing) and only then sets the status to Order Received. A repeated verify never takes stock twice.
3. Closing the checkout window leaves the order unpaid; paying again creates a fresh Razorpay order.
4. Test card: `4111 1111 1111 1111`, any future expiry, any CVV, any name (see Razorpay's test-mode docs for UPI/netbanking test values).

### Known limitations
- **Paid but out of stock (rare race).** If an ingredient runs out between the payment-start check and a successful payment, stock cannot be taken. The order stays `paymentStatus: PAID` with **no** order status, `needsRefund: true` is set, and the customer is shown a clear message that they will be refunded. The refund itself is **manual** (Razorpay dashboard): the admin Orders screen lists these payments (with the Razorpay payment id) under "Needs a manual refund", and the admin marks each one once it has been refunded.
- **No webhook.** Confirmation relies on the browser returning from checkout. If the browser closes after paying but before verify, the payment is not auto-confirmed. A Razorpay webhook is not implemented (it needs a publicly reachable URL and is outside the task requirements).
- Unpaid orders (abandoned checkouts) are deleted automatically 24 hours after creation by a MongoDB TTL index that only covers `PENDING`/`FAILED` orders; a paid order is never deleted. Opening an old unpaid order after that gives "Order not found".

## Menu and prices
The six menu pizzas are presets: each is a list of builder ingredients (`defaultIngredients`), and **Customize** opens the builder with them already selected. A preset has no price of its own. The price on its card is the sum of the current prices of its ingredients, calculated by the server, so it always equals what the builder charges. `npm run seed:menu` is safe to re-run at any time and also upgrades a database seeded by an older version: it only changes a record that still holds exactly what the old seed wrote, so your own edits to stock, prices, descriptions or defaults are kept.

## Deployment (optional)

> **Not required for OIBSIP.** The project is graded from the repository and the demo video, and runs fully on `localhost`. This section is a guide only; nothing here has been deployed or tested by the project author.

A common free setup is **Vercel** (client) + **Render** (server) + **MongoDB Atlas** (database):

1. **Atlas:** keep the cluster you already use. Under *Network Access* allow the server's outbound addresses (Render free instances do not have fixed IPs, so `0.0.0.0/0` is the usual choice there; do not leave that open on a database holding real data).
2. **Server on Render:** create a *Web Service* from the repository. Root directory `WebDev-L3-PizzaDelivery/server`, build command `npm install`, start command `npm start`. Set the same variables as your local `server/.env` (`MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, the `EMAIL_*` settings, the `RAZORPAY_*` **test** keys, `LOW_STOCK_CHECK_CRON`), plus `NODE_ENV=production` and `CLIENT_URL=<your Vercel URL>` (used for CORS and the links in emails). Run `npm run seed:menu` and `npm run seed:admin` once against the production database (for example from your computer with `MONGODB_URI` pointing at it).
3. **Client on Vercel:** import the same repository. Root directory `WebDev-L3-PizzaDelivery/client`, framework Vite, build command `npm run build`, output directory `dist`. The app calls the API at the relative path `/api`, which only the Vite dev server proxies, so add a `vercel.json` in the client folder that forwards it and keeps client-side routes working:
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://YOUR-SERVICE.onrender.com/api/:path*" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
4. **Things to know:** Render's free tier puts an idle service to sleep, and a sleeping server does not run the low-stock cron job, so scheduled alerts are unreliable there (the first request after a nap is also slow). Razorpay stays in **test mode** (`rzp_test_` keys only; live keys are refused by the server).

## Docs
- [Requirements & traceability](docs/REQUIREMENTS.md)
- [Testing notes](docs/TESTING.md)
- [Master specification](docs/OIBSIP_WebDev_Level3_PizzaDelivery_Master_Spec.md)
