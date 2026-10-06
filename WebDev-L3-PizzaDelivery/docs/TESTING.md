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
| Unverified login blocked (403) while `AUTH_REQUIRE_VERIFIED` is true | ✅ |
| Verified login returns JWT with expiry; `GET /api/auth/me` returns profile | ✅ |
| Wrong password and unknown email return the identical generic 401 | ✅ |
| **Admin account rejected by `POST /api/auth/login`** with the same generic 401 | ✅ |
| `/me` without token, garbage token, wrong-secret token, expired token, token for a deleted user: all 401 | ✅ |
| `requireAdmin`: no token 401, normal user 403, forged `role: admin` claim in a user's token 403, real admin 200 (isolated probe app in the test file; no test route exists in the real app) | ✅ |
| Rate limits do not block tests (30 rapid logins, none 429) | ✅ |
| `AUTH_REQUIRE_VERIFIED=false` is ignored when `NODE_ENV=production` | ✅ |
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

Automated: `cd server && npm test` now runs 29 tests (14 auth + 15 email flows). **29 of 29 pass.** Email flow tests inject a fake mail transport, so no real email is sent; tests pin `AUTH_REQUIRE_VERIFIED=true` regardless of the developer `.env`.

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

1. Put your Gmail address and a Gmail App Password in `server/.env` (`EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`), set `AUTH_REQUIRE_VERIFIED=true`, restart the server.
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
