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
