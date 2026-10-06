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

### Not yet verified (Module 4)

- **The dashboard in a browser** (grid layout at phone/tablet/desktop widths, loading skeleton, empty state, error + "Try again", broken-image fallback). It compiles and the API it calls is verified, but it has not been viewed in a browser.
- The "Customize" button goes to a placeholder `/builder` page until Module 5.
