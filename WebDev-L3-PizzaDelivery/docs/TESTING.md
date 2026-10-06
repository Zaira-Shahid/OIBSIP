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

### Not yet verified

- Visual check of the Home page status pill in a browser. The pill is driven by the proxied `/api/health` response above, but the page was not viewed in a browser.

### Notes

- On this machine Node's DNS resolver failed the Atlas `mongodb+srv` SRV lookup (`querySrv ECONNREFUSED`) although the OS resolved it. `server/src/config/db.js` retries with public DNS only after that failure. See README Troubleshooting.
- Atlas Network Access currently allows `0.0.0.0/0` (development only; restrict before any deployment).

### How to run this check yourself

1. Put your Atlas URI in `server/.env` (`MONGODB_URI=...`). In Atlas, also allow your IP under *Network Access*.
2. `cd server && npm run dev` → expect `MongoDB connected` and `API listening on http://localhost:5000`.
3. Open `http://localhost:5000/api/health` → `{"success":true,"data":{"status":"ok","database":"connected",...}}`.
4. `cd client && npm run dev`, open `http://localhost:5173` → green "Server and database connected".
