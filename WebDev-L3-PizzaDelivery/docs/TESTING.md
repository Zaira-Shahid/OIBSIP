# Testing Log

Only results that were actually executed are recorded here.

## Module 1 - Project foundation

| Check | Method | Result |
| --- | --- | --- |
| Client production build | `cd client && npm run build` | ✅ passes |
| Client lint | `cd client && npm run lint` | ✅ no findings |
| Server refuses to start without `MONGODB_URI` | `node src/server.js` with no `.env` | ✅ exits 1 with a clear message |
| Server fails cleanly on unreachable DB | `MONGODB_URI=mongodb://127.0.0.1:1/x` | ✅ exits 1 with a clear message, no stack trace |
| `GET /api/health` when DB is down | curl against the Express app without a DB connection | ✅ 503, `{"success":false,"data":{"status":"degraded","database":"disconnected"}}` |
| Unknown route | `GET /api/nope` | ✅ 404 JSON `{success:false,message}` |
| Malformed JSON body | `POST /api/health` with `{bad` | ✅ 400 JSON, no internals leaked |
| Vite dev server proxies `/api` | `curl localhost:5173/api/health` | ✅ same response as the API |
| SPA route fallback | `curl localhost:5173/some/route` | ✅ serves the app shell |
| Security headers | helmet | ✅ `X-Content-Type-Options` present |

| Real Atlas connection | `npm start` in server with Atlas URI | ✅ `MongoDB connected`, API listening on :5000 |
| `GET /api/health` with DB up | curl localhost:5000/api/health | ✅ 200, `database: connected` |
| Health via Vite proxy | curl localhost:5173/api/health | ✅ same 200 response |
| Home page status pill | Viewed in a browser by Zaira | ✅ green, "Server and database connected" |

### Notes

- On this machine Node's DNS resolver failed the Atlas `mongodb+srv` SRV lookup (`querySrv ECONNREFUSED`) although the OS resolved it. `server/src/config/db.js` retries with public DNS only after that failure. See README Troubleshooting.
- Atlas Network Access currently allows `0.0.0.0/0` (development only; restrict before any deployment).

### How to run this check yourself

1. Put your Atlas URI in `server/.env` (`MONGODB_URI=...`). In Atlas, also allow your IP under *Network Access*.
2. `cd server && npm run dev` → expect `MongoDB connected` and `API listening on http://localhost:5000`.
3. Open `http://localhost:5000/api/health` → `{"success":true,"data":{"status":"ok","database":"connected",...}}`.
4. `cd client && npm run dev`, open `http://localhost:5173` → green "Server and database connected".

## Module 2 - User authentication

Automated: `cd server && npm test` (Node's built-in test runner against the separate `pizza-delivery-test` database; `NODE_ENV=test` skips rate limits). **14 of 14 pass.**

| Check | Result |
| --- | --- |
| Register valid user: 201, role `user`, unverified, no `passwordHash`/token/password in response | ✅ |
| Password stored as bcrypt hash; verification token stored only as SHA-256 hash | ✅ |
| Reject invalid email, short password, letters-only, digits-only, short name, empty body (400, clear message, nothing saved) | ✅ |
| Reject `role: "admin"` in registration body (400, nothing saved) | ✅ |
| Duplicate email rejected, case-insensitive (409) | ✅ |
| Unverified login blocked (403) | ✅ |
| Verified login returns JWT with expiry; `GET /api/auth/me` returns profile | ✅ |
| Wrong password and unknown email return the identical generic 401 | ✅ |
| **Admin account rejected by `POST /api/auth/login`** with the same generic 401 | ✅ |
| `/me` without token, garbage token, wrong-secret token, expired token, token for a deleted user: all 401 | ✅ |
| `requireAdmin`: no token 401, normal user 403, forged `role: admin` claim in a user's token 403, real admin 200 (isolated probe app in the test file; no test route exists in the real app) | ✅ |
| Rate limits do not block tests (30 rapid logins, none 429) | ✅ |
| (Module 3 history) the temporary `AUTH_REQUIRE_VERIFIED` switch was ignored in production; it was removed in Module 11 | ✅ |
| `seed:admin`: creates verified admin; second run with a different password says "already exists, not overwritten", no duplicate, hash unchanged; weak password refused | ✅ |
| Rate limiter in real (non-test) mode: 22 bad logins through the Vite proxy | ✅ first 20 returned 401, then 429 with a clear message |
| Client `npm run lint` and `npm run build` | ✅ |

### Browser check (Module 2) - performed by Zaira

| Check | Result |
| --- | --- |
| Register a new account in the browser | ✅ |
| Log in with that account | ✅ |
| Dashboard shows the user's name and email; navbar shows "Hi, <name>" and Log out | ✅ |
| `seed:admin` against the real database: admin created; second run changes nothing | ✅ |

### Not manually verified (Module 2)

These were deliberately skipped in the browser and are **not** claimed as verified. The logic exists in the code (`AuthProvider`, `ProtectedRoute`, Navbar) and `/me` token handling is covered by the API tests, but the browser behaviour itself was not checked:

- Session persists after a page reload.
- Log out clears the session.
- Opening `/dashboard` while logged out redirects to the login page.

### Notes

- An older pre-existing account rejected login (most likely a forgotten password). It will be used to test forgot-password in Module 3.
- The real Atlas `pizza-delivery` database has the browser-registered customer account and the seeded admin. Automated tests use `pizza-delivery-test`.

## Module 3 - Email verification & password recovery

Automated: `cd server && npm test` now runs 29 tests (14 auth + 15 email flows). **29 of 29 pass.** Email flow tests inject a fake mail transport, so no real email is sent.

| Check | Result |
| --- | --- |
| Registration sends exactly one verification email (link `<CLIENT_URL>/verify-email?token=<64 hex>`, HTML + text); API response never contains the raw token; only its SHA-256 hash is stored | ✅ |
| Registration still succeeds with `emailSent:false` when the mail server fails | ✅ |
| Email service refuses to send when no transport/SMTP exists outside development | ✅ |
| Unverified login returns 403 with `code: EMAIL_NOT_VERIFIED` | ✅ |
| Valid verification link verifies the account; login then works | ✅ |
| Verification link is single-use (second use: 400) | ✅ |
| Unknown, malformed, missing and expired verification tokens rejected (400); expired token leaves account unverified | ✅ |
| Resend verification: identical response for existing and unknown emails; mail only goes to the real unverified account; new link works | ✅ |
| Forgot password: identical response for existing and unknown emails; only the real account gets mail; token hash stored; ~1 hour expiry | ✅ |
| Forgot password: invalid email format 400; admin accounts get no reset email | ✅ |
| Reset: weak password rejected; valid reset works; old password then 401, new password 200; token cleared and single-use | ✅ |
| Reset: unknown, malformed, missing and expired tokens rejected (400) | ✅ |
| Reset invalidates JWTs issued before it (401 "password was changed"); a fresh login works | ✅ |
| Reset also verifies an unverified account (mailbox ownership proven by the link) | ✅ |
| Client `npm run lint` and `npm run build` | ✅ |
| Live run through the Vite proxy against the real server (SMTP not configured, dev console fallback), throwaway user: register, verify, verify again (rejected), forgot (existing and unknown give the same message), reset, old password 401, new password 200; `/verify-email`, `/forgot-password`, `/reset-password` routes served | ✅ (throwaway user deleted afterwards) |

### Not yet verified (Module 3)

- **A real email delivered to a real inbox via Gmail SMTP.** `EMAIL_USER`, `EMAIL_PASSWORD` and `EMAIL_FROM` are not yet set in `server/.env`. Until they are, only the fake transport and the development console fallback have been exercised.
- **The new pages in a browser** (VerifyEmail, ForgotPassword, ResetPassword, the "Resend verification email" button and the updated Register/Login screens). They compile and their routes are served, but have not been clicked through.

### How to check Module 3 yourself

1. Put your Gmail address and a Gmail App Password in `server/.env` (`EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`) and restart the server.
2. Register a new account: expect the "We sent a verification link" screen and an email. Logging in before clicking the link shows the 403 message and a "Resend verification email" button.
3. Click the link: "Your email has been verified". Reload the same link: "invalid, expired or already used". Log in.
4. Log out, "Forgot your password?", enter the email, open the emailed link, set a new password, log in with it. The old password must fail.

## Module 4 - Pizza dashboard (branch `module-4-pizza-dashboard`)

Automated: `cd server && npm test` now runs 38 tests (14 auth + 15 email flows + 9 menu). **38 of 38 pass.** Menu tests use the `pizza-delivery-test` database.

| Check | Result |
| ----- | ------ |
| Seed data: 5 bases, 5 sauces, 4 cheeses, 7 vegetables, 6 pizzas | ✅ |
| `seed:menu` run twice adds nothing the second time | ✅ (dev DB and test) |
| Re-seeding does not overwrite edited stock/price (InventoryItem) or price (Pizza) | ✅ |
| `GET /api/pizzas` returns available pizzas only, with id/name/description/image/price | ✅ |
| `GET /api/pizzas/:id`: found, unknown id 404, malformed id 404, unavailable 404 | ✅ |
| `GET /api/ingredients` grouped by category, no stock/threshold fields | ✅ |
| Ingredient `available` follows stock; inactive items excluded | ✅ |
| Endpoints are public | ✅ |
| Live dev server returns the seeded data over HTTP | ✅ |
| All 6 Unsplash image URLs return 200 `image/jpeg` and show pizzas | ✅ (viewed) |
| Client `npm run lint` and `npm run build` | ✅ |

### Browser check (Module 4) - done by Zaira

| Check | Result |
| ----- | ------ |
| 6 pizzas shown with images | ✅ |
| Prices shown in ₹ | ✅ |
| "Customize" opens the builder placeholder | ✅ |
| Mobile layout works | ✅ |

Not exercised in a browser: the loading skeleton, empty state, error + "Try again" and broken-image fallback (code is in place; none were triggered).

The "Customize" button goes to a placeholder `/builder` page until Module 5. U5/U6 stay 🚧 until the builder displays the bases and sauces.

## Module 5 - Custom pizza builder (branch `module-5-pizza-builder`)

Automated: `cd server && npm test` now runs 49 tests (14 auth + 15 email flows + 9 menu + 11 builder). **49 of 49 pass.** The script runs files one at a time (`--test-concurrency=1`) because menu and builder tests share the `pizza-delivery-test` database.

| Check | Result |
| ----- | ------ |
| Price = base + sauce + cheese + vegetables from database prices | ✅ |
| Vegetables optional (omitted or empty) | ✅ |
| A database price change changes the quoted total | ✅ |
| Client-sent `total` / `price` / `prices` rejected (400) | ✅ |
| Missing base, sauce or cheese rejected; an array in place of one choice rejected | ✅ |
| Wrong-category ingredient, malformed id, unknown id, duplicate id, non-array vegetables, bad JSON rejected | ✅ |
| Out-of-stock ingredient: 409 `OUT_OF_STOCK`; inactive ingredient: 400 | ✅ |
| Response has no stock fields | ✅ |
| `priceCustomPizza` service enforces the same rules (reused by order creation) | ✅ |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |

### Not yet verified (Module 5)

- **The builder in a browser.** Compiled and linted only; no click-through done. The running dev API server predates the new route (`POST /api/pizzas/price` returned 404 on it), so it needs a restart before the review step works.
- Preset pre-selection from the dashboard (not built).

### How to check Module 5 yourself

1. Restart the API server, log in, click **Customize** on any pizza.
2. Step 1-2: Next with nothing chosen shows an error; choose a base and a sauce. Step 3: only one cheese can be selected. Step 4: select several vegetables, or none.
3. Back keeps every selection. The stepper shows the current and completed steps. On the review step the total is confirmed by the server and each "Change" link returns to its step.
4. Check with the keyboard (Tab, arrow keys, Space) and at phone width.

## Module 6 - Order management (branch `module-6-order-management`)

Automated: `cd server && npm test` runs 62 tests (14 auth + 15 email flows + 9 menu + 11 builder + 13 orders). **62 of 62 pass.**

| Check | Result |
| ----- | ------ |
| All `/api/orders` endpoints need a login (401) | ✅ |
| Order created unpaid: `paymentStatus` PENDING, no `orderStatus`, amount = unit price × quantity, snapshot stored | ✅ |
| Quantity defaults to 1; 0, 6, -1, 1.5, "2", null rejected | ✅ |
| Client-sent `amount`, `total`, `unitPrice`, `orderStatus`, `paymentStatus`, `userId` rejected | ✅ |
| Amount follows database prices; snapshot keeps the price and name at order time | ✅ |
| Out-of-stock (409), insufficient stock for the quantity (409), exactly enough stock (201), inactive ingredient (400) | ✅ |
| Rejected or invalid requests create no order | ✅ |
| PENDING orders do not change any stock | ✅ |
| Unpaid orders hidden from history and detail | ✅ |
| Confirmed orders newest first; users see only their own; other/unknown/malformed ids all 404 | ✅ |
| No stock numbers or owner id in responses | ✅ |
| `orderStatus` accepts only ORDER_RECEIVED, IN_KITCHEN, SENT_TO_DELIVERY | ✅ |
| `POST /api/pizzas/price` quotes unit price, quantity and total | ✅ |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |

### Browser check (Module 6) - done by Zaira

| Check | Result |
| ----- | ------ |
| Builder steps lead to the order summary with itemised prices | ✅ |
| Changing the quantity updates the total | ✅ |
| "Edit pizza" keeps the choices | ✅ |
| "Proceed to pay" creates the unpaid order and shows a clear notice | ✅ |
| "My orders" shows the empty state | ✅ |

### Not yet verified (Module 6)

- "My orders" stays empty until Module 7 can confirm a paid order. The list and detail pages are covered by API tests only, not by seeing real data in the browser.

### How to check Module 6 yourself

1. Restart the API server, log in, build a pizza and click **Continue to summary**.
2. Check the itemised table (base, sauce, cheese, vegetables, price per pizza, quantity, total). Change the quantity 1-5 and watch the total change.
3. **Edit pizza** returns to the builder review with your choices kept.
4. Click **Proceed to pay**: a "not confirmed yet" notice and a disabled "Payment coming next" button appear. In MongoDB a new order exists with `paymentStatus: PENDING` and no `orderStatus`, and no ingredient stock has changed.
5. Open **My orders**: empty, because the order is unpaid.

## Module 7 - Razorpay payment (branch `module-7-razorpay`)

Automated: `cd server && npm test` runs 80 tests (62 earlier + 18 payments). **80 of 80 pass.** Payment tests use a **fake gateway** and override any Razorpay keys in `.env`; Razorpay is never contacted.

| Check | Result |
| ----- | ------ |
| Payment endpoints need a login | ✅ |
| Not configured: 503; live (`rzp_live_`) key refused; no gateway call | ✅ |
| Start payment: gateway order = stored amount in paise, receipt = order id; no secret in the response | ✅ |
| Other users, unknown and malformed order ids: 404 | ✅ |
| Start payment re-checks stock (`INSUFFICIENT_STOCK` / `OUT_OF_STOCK`) and prices (`PRICE_CHANGED`) before contacting the gateway | ✅ |
| Gateway failure: safe 502, no internals leaked, order retryable | ✅ |
| Retry after closing the popup makes a fresh Razorpay order; the old one can no longer confirm | ✅ |
| Forged or bad signatures rejected; nothing changes; the genuine payment still works afterwards | ✅ |
| Valid signature: PAID, ORDER_RECEIVED, payment id stored, quantity taken from each of the 5 chosen ingredients only | ✅ |
| Confirmed order appears in history | ✅ |
| Repeated verify (3 more calls) and 5 simultaneous verifies decrement stock once | ✅ |
| Stock gone after payment: PAID, no orderStatus, `needsRefund`, earlier decrements rolled back, never negative, repeat verify changes nothing, cannot pay again | ✅ |
| Stock may reach exactly 0 but not below | ✅ |
| Paid order cannot start another payment (409 `ALREADY_PAID`) | ✅ |
| Verify rejects unknown fields and bad bodies | ✅ |
| `stockDeducted` hidden from API responses (caught by the existing "no stock fields" test) | ✅ |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |

### Real test-mode check (Module 7) - done by Zaira

| Check | Result |
| ----- | ------ |
| Razorpay popup opens in test mode | ✅ |
| Closing the popup leaves the order retryable | ✅ |
| Test payment succeeds; order detail shows "Payment successful" | ✅ |
| My orders lists the order as Order Received | ✅ |

### Not yet verified (Module 7)

- **A real Razorpay test-mode checkout.** Needs `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `server/.env`. The real Razorpay HTTP call (`POST /v1/orders`) and the real Checkout popup have not been exercised. Only the fake gateway and the signature algorithm (HMAC-SHA256 of `order_id|payment_id`, as Razorpay documents it) are tested.
- **The new pay flow in a browser** (popup, closing it, retry, success redirect, error messages).
- Refunds for `needsRefund` orders are manual and untested against Razorpay.

### How to check Module 7 yourself

1. Put your `rzp_test_` key id and secret in `server/.env` and restart the API server.
2. Build a pizza, open the summary and click **Proceed to pay**. Razorpay Checkout opens and the order exists unpaid.
3. Close the popup: a "nothing was charged" notice appears and **Pay now** works again (fresh Razorpay order).
4. Pay with the test card `4111 1111 1111 1111` (any future expiry, any CVV). You land on the order detail with "Payment successful", and **My orders** lists it as Order Received.
5. In MongoDB (or later the admin view), each ingredient of that pizza has dropped by the quantity, and the order has `paymentStatus: PAID` and `orderStatus: ORDER_RECEIVED`.
6. Try a failing test payment (Razorpay's test-mode failure option) and confirm you can retry.

## Module 8 - Admin authentication (branch `module-8-admin-auth`)

Automated: `cd server && npm test` runs 96 tests (80 earlier + 16 admin). **96 of 96 pass.**

| Check | Result |
| ----- | ------ |
| Admin login works (even for an account that is not email-verified); no secrets in the response | ✅ |
| Customer with correct credentials, wrong password and unknown email get identical 401 responses | ✅ |
| Admin login rejects extra fields; no admin registration route; `role` is rejected on public register | ✅ |
| Router crawl: every route on `/api/admin` except login gives 401 with no or a bad token and 403 for a customer | ✅ |
| Role is re-read from the database: a demoted admin gets 403, a deleted admin 401 | ✅ |
| Admin tokens get 403 on customer-only order and payment routes; customers unaffected | ✅ |
| Admin and customer tokens work at the same time without interfering | ✅ |
| `GET /api/admin/orders`: confirmed only (unpaid and needsRefund excluded), newest first, customer name and email, no internals, deleted customer tolerated | ✅ |
| Status: RECEIVED → IN_KITCHEN → SENT_TO_DELIVERY works and the customer sees it | ✅ |
| Skips, backwards moves, repeats and moves after delivery rejected (409) and nothing changes | ✅ |
| Unknown, lowercase, empty, non-string, missing or extra status input rejected (400) | ✅ |
| Orders without a status: 409 `ORDER_NOT_CONFIRMED`; unknown or malformed id 404 | ✅ |
| Customers cannot change a status, even their own order (403); no token 401 | ✅ |
| Four simultaneous status updates: exactly one wins | ✅ |
| `npm run admin:reset-password`: updates only that admin; the old password and old token stop working, the new ones work; refuses a customer account, a missing account, a weak password and empty config | ✅ |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |

### Browser check (Module 8) - done by Zaira

| Check | Result |
| ----- | ------ |
| "Staff login" link in the footer | ✅ |
| A customer opening `/admin/dashboard` is redirected away | ✅ |
| Admin login page has no register option | ✅ |
| Customer credentials are rejected on the admin login | ✅ |
| Admin login works in an Incognito window | ✅ |
| Admin navbar shows only admin links | ✅ |
| The customer session in the normal window stays logged in at the same time | ✅ |

Not exercised in a browser: `npm run admin:reset-password` (covered by automated tests only), and the admin navbar/redirect when an admin types a customer URL.

### How to check Module 8 yourself

1. Restart the API server. Make sure `ADMIN_EMAIL` / `ADMIN_PASSWORD` are set and run `npm run seed:admin` if the admin does not exist.
2. Footer **Staff login** → `/admin/login`. A customer's email and password there must fail with "Invalid email or password." The admin's must open the admin dashboard.
3. As a customer, type `/admin/dashboard`: you land on the staff login. As admin, type `/dashboard`: you land on the admin dashboard, and the navbar shows no customer links.
4. **Two windows:** log in as a customer in a normal window and as admin in an **incognito** window. Both stay logged in independently, and logging out in one does not log out the other. (In the *same* window the second login replaces the first.)
5. Optional: put a new `ADMIN_PASSWORD` in `.env`, run `cd server && npm run admin:reset-password`, and confirm the old password fails and the admin session in the browser is signed out.

See also [DEMO-CHECKLIST.md](DEMO-CHECKLIST.md).

## Module 9 - Inventory management (branch `module-9-inventory`)

Automated: `cd server && npm test` runs 112 tests (96 earlier + 16 inventory). **112 of 112 pass.**

| Check | Result |
| ----- | ------ |
| Status rule: 0 is out of stock, strictly below the threshold is low, equal to or above is OK | ✅ |
| Inventory routes: no token 401, customer 403 (plus the router crawl from Module 8) | ✅ |
| List returns every item (inactive included) grouped by category then name, with the expected fields | ✅ |
| Summary counts low and out-of-stock for active items only | ✅ |
| Set stock with `expectedStock`: saved, and the response is the updated item | ✅ |
| Stock changed meanwhile: 409 `STOCK_CHANGED` with the current row, nothing saved | ✅ |
| Five simultaneous sets from the same view: exactly one wins | ✅ |
| `+10` / `+50` are atomic: ten simultaneous `+10` give exactly +100 | ✅ |
| Adjustments cannot go below 0 or above 1,000,000 and change nothing when refused; exactly 0 is allowed | ✅ |
| Ten simultaneous `-1` on a stock of 5: exactly five succeed, never negative | ✅ |
| Threshold and active edits leave stock alone, and the status follows | ✅ |
| Combined edit applies all fields together, or none when the stock check fails | ✅ |
| 21 kinds of invalid input (missing `expectedStock`, negatives, decimals, strings, too large, `price`/`name`/`category`/`unit`/`role`, empty body, set + adjust together) rejected with 400, nothing changes | ✅ |
| Unknown and malformed ids: 404 | ✅ |
| Admin edits show up for customers (out of stock, hidden) and block orders larger than the stock (409) | ✅ |
| **A3 end to end:** unpaid order changes no stock; after verified payment the admin view shows each of the 5 ingredients down by the quantity and an unrelated item unchanged | ✅ |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |

### Browser check (Module 9) - done by Zaira

| Check | Result |
| ----- | ------ |
| Dashboard shows low and out-of-stock counts | ✅ |
| Inventory grouped by the 4 categories | ✅ |
| +10 / +50 and set-stock work | ✅ |
| Low and Out of stock badges update | ✅ |
| An out-of-stock item is disabled in the customer builder and comes back after a restock | ✅ |
| A paid order decremented stock by the ordered quantity (A3 verified end to end) | ✅ |

Not exercised in a browser: Deactivate/Activate, the "stock changed meanwhile" 409 flow with two windows, invalid-input messages, and the phone layout (all covered by API tests or code only).

### How to check Module 9 yourself

1. Restart the API server, log in as admin (incognito window) and open the dashboard: the Inventory card shows low and out-of-stock counts.
2. **Manage inventory**: four groups (bases, sauces, cheeses, vegetables) with stock, threshold and status. Check that status is readable without colour (✓ OK, ! Low stock, ✕ Out of stock).
3. Type a new number under "Set stock to" and Save; the row updates. Try `-5`, `1.5` and letters: an inline error, Save disabled.
4. Click **+10** and **+50**. Set a threshold above the stock: the badge becomes Low stock. Set stock 0: Out of stock; as a customer the builder shows that ingredient as out of stock.
5. **Deactivate** an item: it disappears from the customer's builder and the row is marked hidden; **Activate** brings it back.
6. **A3:** note a stock figure, pay for a pizza as a customer (test card), reload the admin page: each of that pizza's ingredients dropped by the quantity.
7. **Concurrency (two windows):** load the inventory in two admin windows. Save a new stock in window A, then try to save a different number in window B without reloading: B shows the "changed to ..." message, refreshes that row, and saves nothing.

## Module 10 - Low-stock alerts, live tracking, admin orders (branch `module-10-orders-alerts`)

Automated: `cd server && npm test` runs 139 tests (112 earlier + 24 low-stock + 3 tracking). **139 of 139 pass.** All email is captured by a fake transport; `node-cron` is replaced by a fake where the scheduler is exercised.

| Check | Result |
| ----- | ------ |
| Nothing low: no email; the run reports how many items it checked | ✅ |
| Newly low items produce ONE digest with name, category, stock, threshold and status; equal-to-threshold is not alerted | ✅ |
| An unchanged low item is never emailed again (3 further runs); a later digest lists only newly low items | ✅ |
| Escalation LOW → OUT_OF_STOCK is one new email, then silence while it stays out | ✅ |
| Restock to ≥ threshold through the admin API resets the alert immediately (before any scheduler run); a later drop emails again | ✅ |
| `+10`/`+50` reset only once the item reaches its threshold; lowering a threshold so the item is OK also resets | ✅ |
| OUT → partly restocked (still low) sends nothing, but falling to 0 again alerts; a run also clears state for items restocked behind its back | ✅ |
| Inactive items ignored | ✅ |
| Three overlapping runs send exactly one email; a second instance claiming an item first prevents a duplicate | ✅ |
| A failed email never crashes the run, releases the claim, and the next run retries (also restores LOW after a failed escalation) | ✅ |
| No recipient configured: nothing sent or marked; alerts flow once an address is set | ✅ |
| Digest HTML escapes item names | ✅ |
| `POST /api/admin/inventory/check-low-stock`: 401/403 for non-admins; same job and duplicate rules; clear 502 (mail failure) and 409 (no recipient) | ✅ |
| Scheduler never starts under test; schedules the configured `LOW_STOCK_CHECK_CRON`; logs one brief line per run without the address; invalid expression falls back to the default with a warning; real `node-cron` accepts the default and a 1-minute expression | ✅ |
| Customer sees each admin status change on the next fetch (detail and list); only the owner sees it; a new paid order appears in the admin list on the next fetch | ✅ |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |

### Browser and email check (Module 10) - done by Zaira

| Check | Result |
| ----- | ------ |
| Live tracking: admin moved an order Received → In Kitchen → Sent to Delivery and the customer page updated each time without a reload | ✅ |
| Admin Orders screen shows new paid orders and only the legal next-step button | ✅ |
| Scheduler ran every minute (`LOW_STOCK_CHECK_CRON` = 1 minute) | ✅ |
| One digest email arrived in Gmail; no repeat on later runs | ✅ |
| "Run low-stock check now" reported no new items after the alert | ✅ |
| Restock and drop again sent a new email | ✅ |

Not exercised in a browser: hiding the tab and returning (pause and refresh), the "Reconnecting" hint, the LOW → OUT_OF_STOCK escalation email with real mail, and the phone layout of the new screens.

### How to check Module 10 yourself

1. In `server/.env` set `LOW_STOCK_CHECK_CRON=*/1 * * * *` and make sure `ADMIN_ALERT_EMAIL` (or `ADMIN_EMAIL`) and the Gmail SMTP settings are filled in. Restart the API server: the console prints `[low-stock] scheduler running (*/1 * * * *)` and one `[low-stock] checked N items, alerted M` line per minute.
2. Admin (incognito window) → Inventory. Set one item's stock below its threshold (for example Classic base to 5). Within a minute, one email arrives listing that item. The next minutes send nothing. Alternatively click **Run low-stock check now**: it says "Alert sent for 1 item: Classic" the first time and "No new low-stock items." after that.
3. Set the same item to 0: one more email (Out of stock). Restock it above its threshold, then lower it again: a new email.
4. Customer (normal window): place and pay for an order. Admin → **Orders** lists it. Click **Mark In Kitchen**, then **Mark Sent to Delivery**.
5. In the customer window, leave My orders (and the order detail) open and untouched: the status and the 3-step tracker change within about 5 seconds without a reload.
6. Switch to another browser tab for a while, change the status as admin, then come back: the page refreshes straight away.
7. Put the `.env` cron back to `*/15 * * * *` (or remove the line) after the demo.

## Module 11 - Final polish, part A (branch `module-11-final`)

Automated: `cd server && npm test` runs 157 tests (139 before Module 11, +18). **157 of 157 pass.** The suite includes one test that waits for MongoDB's real TTL sweep (about 30 to 90 seconds), so a full run takes a little longer than before.

| Check | Result |
| ----- | ------ |
| Every seeded preset is buildable (one base, sauce, cheese; seeded ingredients only; no duplicates) | ✅ |
| Seeded preset prices are in a realistic range (₹200 to ₹450) | ✅ |
| Menu price = sum of the preset's ingredient prices; `selection` is exactly its ingredient set; list is cheapest first | ✅ |
| **What you see is what you pay:** `POST /api/pizzas/price` for each preset's selection returns exactly the card price | ✅ |
| Changing an ingredient price changes the menu price immediately; list and detail agree | ✅ |
| A preset with an inactive ingredient, no defaults, or two cheeses is hidden (list and detail) | ✅ |
| `seed:menu` is idempotent (a second run changes nothing) and never overwrites admin-changed defaults, descriptions or prices | ✅ |
| `seed:menu` upgrades a database made by the older seed: old prices moved (19 of 21; the admin-edited one kept), "Pepperoni Feast" renamed in place to "Mushroom Melt" (same record), defaults added, stale stored `price` removed; an admin-edited old pepperoni record is left alone and hidden | ✅ |
| `Order` has a 24-hour TTL index limited to `PENDING`/`FAILED` (partial filter) | ✅ |
| **Real TTL sweep** on a scratch collection with the same index (3 s expiry): old `PENDING` and `FAILED` orders deleted; old `PAID`, old refund-pending, a not-yet-due order and an order paid just before the sweep all kept | ✅ |
| Refund list: only paid-unconfirmed orders, newest payment first, customer and payment id; admin-only | ✅ |
| Mark refunded: works once, takes the order off the list, keeps the record; confirmed, unpaid, unknown and malformed ids refused; four simultaneous calls give one success | ✅ |
| Existing builder, order, payment and inventory tests now derive prices from the seed data instead of hard-coded numbers | ✅ |
| Tests can never reach a real mail server: with SMTP credentials in `.env` and no injected transport, sending fails locally (found when real Gmail settings in `.env` made an email test attempt real logins; fixed in `emailService`) | ✅ |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |

### Not yet verified (Module 11, part A)

- **In a browser:** the new menu cards (price, ingredient line), Customize pre-selecting the preset (including the out-of-stock note), the "Build your own pizza" button, and the "Needs a manual refund" section of the admin Orders screen (it only appears when such an order exists).
- Your existing dev database still has the old prices and presets until you run `npm run seed:menu` (see below). The running API server must also be restarted.

### U1-U3 real-inbox check (done by Zaira, all 7 steps passed)

Use a mailbox you can open. In `server/.env` make sure the Gmail settings are filled in, then restart the API server.

1. **Register** a new account with that email at `/register`. You should see the "We sent a verification link" screen.
2. **Verification email** arrives. Before clicking it, try to log in: it must be refused with "Please verify your email address", with a *Resend verification email* button (try it: a second email arrives).
3. Click the link in the email: "Your email has been verified". Open the same link again: "invalid, expired or already used".
4. **Log in** with the account: you reach the dashboard.
5. Log out. **Forgot your password?** with that email: you always get the same generic message. A reset email arrives.
6. Click the reset link, set a new password (8-72 characters, a letter and a number). Log in with the **old** password: refused. Log in with the **new** password: works.
7. Optional: use the reset link a second time: refused.

**Result:** verification email, unverified login blocked with Resend, verify link, login, forgot-password email, reset, and login with the new password all worked. U1-U3 are ✅ and the temporary `AUTH_REQUIRE_VERIFIED` setting was removed (verification is now always required; the automated test checks the old variable no longer does anything).

### How to check part A yourself

1. In `server`, run `npm run seed:menu` once. It prints how many ingredient prices and pizza records it upgraded (and 0 on a second run). Restart the API server.
2. Dashboard: six pizzas, each with a ₹ price and a line of ingredients. "Pepperoni Feast" is now "Mushroom Melt". Margherita is about ₹245, the others between about ₹315 and ₹360.
3. Click **Customize** on a card: the builder opens at step 1 with that pizza's ingredients selected and a "Starting from ..." note. Go to the review step: the total equals the card price. Change an ingredient: the total follows.
4. In the admin inventory set an ingredient of that preset to 0 stock, then click Customize on it again: it opens with that ingredient unselected and a note that it is out of stock.
5. **Build your own pizza** (button on the dashboard) opens an empty builder.
6. Admin refund list: this appears only after the rare "paid but ingredient ran out" case, which is hard to trigger by hand; it is covered by the automated tests.

### Browser check (Module 11, part A) - done by Zaira

| Check | Result |
| ----- | ------ |
| `seed:menu` run and server restarted; menu cards show the new prices with ingredient lines | ✅ |
| Customize pre-selects the preset's ingredients | ✅ |
| "Build your own pizza" works | ✅ |
| A real Gmail low-stock email was delivered by "Run low-stock check now" (after fixing the App Password) | ✅ |

## Module 11 - Final audit, polish and documentation (parts B to E)

### Final audit (spec Phase 11)

Total at this point: **157 tests**; `AUTH_REQUIRE_VERIFIED` has been removed and U1-U3 are verified (see the Module 3 and Module 11 sections).

| Check | Result |
| ----- | ------ |
| Server tests (`npm test`) | ✅ **157 of 157 pass** (final run, after the flakiness fix below) |
| Client `npm run lint` (no warnings) and `npm run build` | ✅ |
| **Secrets, working tree:** pattern scan for Razorpay keys, MongoDB credentials in URIs, private keys, cloud/API keys | ✅ only two fake test keys (`rzp_test_unittestkey`, `rzp_test_inventorytest`) and one fake `rzp_live_abc` used by tests |
| **Secrets, real values:** all 7 secret values in `server/.env` (Mongo URI and its password, JWT secret, admin password, both Razorpay values, Gmail App Password) searched in every tracked file and every commit on every branch | ✅ 0 matches |
| `.env` is ignored and has never been committed (only `.env.example` is tracked) | ✅ |
| A stray empty root `package-lock.json` that slipped into a commit during Module 10 | ✅ found and removed (`5531f92`) |
| Client routes: every `Link`/`navigate` target is a defined route; unknown URLs reach the 404 page | ✅ |
| Client has no `console` calls; no `dangerouslySetInnerHTML`; no TODO/FIXME markers in source | ✅ |
| Static accessibility scan of all 30 components: 0 buttons without a type, 0 images without alt text, 0 unlabelled form controls | ✅ |
| Loading, error and empty states exist on every data page (menu, orders, order detail, summary, builder, admin orders, inventory, dashboard) | ✅ |
| Backend logs reviewed: only start-up, scheduler and failure lines; no tokens, passwords, keys or addresses are logged (the development-only email fallback prints the email itself, as documented) | ✅ |
| Test isolation: with real SMTP settings in `.env` the suite could attempt real email; the email service now never builds a real transport under `NODE_ENV=test`, with a test | ✅ (found and fixed in this module) |
| **Flaky test fixed:** three tests that ran a script with a *synchronous* child process froze the in-process test server for several seconds, its idle keep-alive connections timed out, and the next request failed with `ECONNRESET` (seen in about half of the runs of the menu tests). They now use an asynchronous child process; the menu tests then passed 3 of 3 repeated runs | ✅ |
| Two further failures in earlier full runs were the test machine's DNS failing to resolve the Atlas host (`getaddrinfo ENOTFOUND`), once for a whole test file and once inside a child script; both passed on re-run and are not code failures. If a run shows `ENOTFOUND`, just run `npm test` again | ✅ noted |
| Known gaps found by the audit: no page titles, no error boundary, no skip link, a fixed-height navbar that would overflow on narrow screens with the admin links, a landing page that was only a status badge, no empty message on an unseeded inventory page | ✅ all fixed (below) |

### UI polish (no new features)

- Landing page with real calls to action for logged-out customers, customers and admins, plus a three-step "How it works"; the server-status badge now appears only when something is wrong.
- Page title per route (for example "My orders - Slice & Co."), a "Skip to main content" link, and a friendly error screen if a page crashes (it recovers on navigation).
- The navbar wraps instead of overflowing on narrow screens; tighter side padding on phones; an empty-inventory hint that points to `npm run seed:menu`.

### Documentation delivered

[README.md](../README.md) rewritten to spec section 27 · [API.md](API.md) · [SUBMISSION-CHECKLIST.md](SUBMISSION-CHECKLIST.md) · [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md) · [LINKEDIN-POST.md](LINKEDIN-POST.md) · `screenshots/README.md` (capture guide) · an updated [DEMO-CHECKLIST.md](DEMO-CHECKLIST.md) · `REQUIREMENTS.md` with every U and A row ✅.

### Not yet verified (final)

- **In a browser:** the new landing page, page titles, skip link (press Tab on any page), error screen (not easy to trigger), the wrapped navbar on a phone-width window, and the admin refund section.
- Browser **console** check (F12) while clicking through the demo flow: expected clean, not yet looked at.
- Responsive check at about 360 px wide on the main screens.
- Screenshots, the video, the LinkedIn post and the peer comments (yours; guides are in the docs above).

### How to check parts B to E yourself

1. Landing page (`/`): logged out you see **Sign up to order** and **Log in**; as a customer **Browse the menu** and **Build your own pizza**; as admin **Open the admin dashboard**. No "server connected" badge unless the API is down (stop the API briefly to see the warning, then start it again).
2. Look at the browser tab title on a few pages; it changes per page.
3. Press `Tab` once on any page: a "Skip to main content" link appears at the top left; `Enter` jumps to the content.
4. Make the browser window about 360 px wide and open the admin dashboard: the navbar links wrap onto a second line without overlapping the page.
5. Open the browser console (F12) and click through register → pay → admin → inventory: report any red error.
6. Read the README top to bottom as a stranger would and tell me anything that is unclear or wrong.
