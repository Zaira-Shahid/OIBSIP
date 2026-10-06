# Requirement Traceability Matrix

Source of truth: [OIBSIP_WebDev_Level3_PizzaDelivery_Master_Spec.md](OIBSIP_WebDev_Level3_PizzaDelivery_Master_Spec.md).
A row is only marked ✅ after it is implemented **and** verified. Nothing is checked off in advance.

Legend: ☐ not started · 🚧 in progress · ✅ verified

## Mandatory OASIS requirements

| ID  | Requirement                              | Module            | Implementation | Test | Status |
| --- | ---------------------------------------- | ----------------- | -------------- | ---- | ------ |
| U1  | User registration + email verification   | 2, 3              | Registration: `auth.controller`, Register page | `server/tests/auth.test.js` | 🚧 registration done; verification email in Module 3 |
| U2  | JWT login                                | 2                 | `auth.controller`, `authenticateUser`, Login page | `server/tests/auth.test.js` | 🚧 works; stays 🚧 until Module 3 makes verified-only login real |
| U3  | Forgot password + email reset link       | 3                 | `forgotPassword`/`resetPassword`, `emailService`, ForgotPassword/ResetPassword pages | `server/tests/email-flows.test.js` | 🚧 API + tests pass; real inbox + browser check pending |
| U4  | Pizza dashboard                          | 4                 | `Dashboard`, `PizzaCard`, `pizza.controller` | `server/tests/menu.test.js` | ✅ API tests pass; browser check done by Zaira |
| U5  | At least 5 pizza bases                   | 4, 5              | `InventoryItem` (category `base`), `seed:menu`, `GET /api/ingredients` | `server/tests/menu.test.js`, `builder.test.js` | ✅ approved by Zaira |
| U6  | At least 5 sauces                        | 4, 5              | `InventoryItem` (category `sauce`), `seed:menu`, `GET /api/ingredients` | `server/tests/menu.test.js`, `builder.test.js` | ✅ approved by Zaira |
| U7  | Cheese selection                         | 5                 | `Builder`, `OptionGroup`, `POST /api/pizzas/price` | `server/tests/builder.test.js` | ✅ approved by Zaira |
| U8  | Multiple vegetable selection             | 5                 | `Builder`, `OptionGroup`, `POST /api/pizzas/price` | `server/tests/builder.test.js` | ✅ approved by Zaira |
| U9  | Order summary                            | 6                 | `OrderSummary`, `PizzaBreakdown`, `POST /api/orders` | `server/tests/orders.test.js` | ✅ API tests pass; browser check done by Zaira |
| U10 | Razorpay test-mode checkout              | 7                 | `payment.controller`, `paymentService`, `OrderSummary`, `razorpay.js` | `server/tests/payments.test.js` (fake gateway) | ✅ approved by Zaira (real test-mode checkout verified) |
| U11 | Order statuses (Received/Kitchen/Delivery) | 6, 7, 10        | `Order.orderStatus`; ORDER_RECEIVED on verified payment, then forward-only admin updates (`AdminOrders`) | `server/tests/payments.test.js`, `admin.test.js`, `tracking.test.js` | ✅ approved by Zaira (browser-verified) |
| U12 | Real-time status on user dashboard       | 10                | `usePolling` (5 s), `Orders`, `OrderDetail`, `OrderTracker` | `server/tests/tracking.test.js` (API side) | ✅ approved by Zaira (browser-verified) |
| A1  | Separate admin login                     | 8                 | `POST /api/admin/login`, `requireAdmin` on `/api/admin`, `AdminLogin`, `AdminRoute` | `server/tests/admin.test.js` | ✅ approved by Zaira |
| A2  | Inventory dashboard                      | 9                 | `GET /api/admin/inventory`, `AdminInventory`, `InventoryRow` | `server/tests/inventory.test.js` | ✅ approved by Zaira |
| A3  | Automatic stock decrement after orders   | 7, 9              | `decrementStock` in `payment.controller` | `server/tests/payments.test.js` | ✅ implemented in Module 7; verified end to end in the browser by Zaira (a paid order lowered stock by the ordered quantity) |
| A4  | Manual stock update                      | 9                 | `PATCH /api/admin/inventory/:id`, `InventoryRow` | `server/tests/inventory.test.js` | ✅ approved by Zaira |
| A5  | Configurable low-stock threshold         | 9, 10             | Per-item `lowStockThreshold` editable in `PATCH /api/admin/inventory/:id`; `inventoryStatus` rule | `server/tests/inventory.test.js` | ✅ approved by Zaira (threshold in Module 9; alert state and reset in Module 10, verified with a real email) |
| A6  | Scheduled low-stock email (node-cron)    | 10                | `lowStockService` (`runLowStockCheck`, `startLowStockScheduler`), `sendLowStockDigest`, `POST /api/admin/inventory/check-low-stock` | `server/tests/lowstock.test.js` | ✅ approved by Zaira (real Gmail digest and 1-minute cron verified) |
| A7  | Admin order management                   | 8, 10             | `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`, `AdminOrders` | `server/tests/admin.test.js`, `tracking.test.js` | ✅ approved by Zaira (browser-verified) |

## Module progress

| #  | Module                                      | Status |
| -- | ------------------------------------------- | ------ |
| 1  | Project foundation & architecture           | ✅ |
| 2  | User authentication                         | ✅ approved by Zaira (U1/U2 stay 🚧 until Module 3) |
| 3  | Email verification & password recovery      | ✅ approved by Zaira (real-inbox check not run by Claude; U1–U3 stay 🚧 until that is done) |
| 4  | Pizza dashboard                             | ✅ approved by Zaira (U5/U6 stay 🚧 until the Module 5 builder shows them) |
| 5  | Custom pizza builder                        | ✅ approved by Zaira |
| 6  | Order management                            | ✅ approved by Zaira (merged via PR #4) |
| 7  | Razorpay payment                            | ✅ approved by Zaira |
| 8  | Admin authentication & authorization        | ✅ approved by Zaira |
| 9  | Inventory management                        | ✅ approved by Zaira |
| 10 | Low-stock automation + real-time tracking   | ✅ approved by Zaira |
| 11 | Testing, UI polish & submission             | ☐ |

### Module 1 foundation checklist (spec Phase 1)

| Item                          | Status |
| ----------------------------- | ------ |
| Repository structure          | ✅ |
| Client (React + Vite) builds  | ✅ |
| Server starts                 | ✅ |
| MongoDB connection (Atlas)    | ✅ |
| `/api/health` endpoint        | ✅ |
| Frontend routing              | ✅ (build + dev-server checks; see TESTING.md) |

## Decisions that refine the spec (approved by Zaira)

- Stock availability is checked **before** creating the Razorpay order; the final atomic decrement happens at payment verification with the condition `stock >= required quantity`.
- `paymentStatus` and `orderStatus` are separate fields. An unpaid order has `paymentStatus = PENDING` and **no** `ORDER_RECEIVED` status; `orderStatus` becomes `ORDER_RECEIVED` only after successful signature verification. Unpaid orders never appear in the user's order tracking.
- Seed data ships with 5 bases and 5 sauces.

## Module 5 decisions (approved by Zaira)

- Exactly one base, one sauce and one cheese are required; vegetables are optional and multiple.
- `POST /api/pizzas/price` takes ingredient ids only and returns the total computed from database prices. A client-sent price/total is rejected. Order creation (Modules 6/7) must call `priceCustomPizza` (`server/src/services/pricingService.js`) again and never trust a client total.
- Out-of-stock or inactive ingredients are rejected by the price endpoint (409 `OUT_OF_STOCK` / 400).
- Preset pre-selection (`defaultIngredients` on Pizza) is lower priority and not built yet; "Customize" currently opens the same empty builder.

## Module 6 decisions (approved by Zaira)

- One custom pizza per order, quantity 1-5. The server recomputes `amount = unitPrice x quantity`; `unitPrice` and `quantity` are stored on the order.
- The unpaid (`paymentStatus: PENDING`, no `orderStatus`) order is created only when the user clicks "Proceed to pay", not when the summary opens.
- PENDING orders never reserve or decrement stock. Stock is checked at creation (`stock >= quantity` for every ingredient, 409 `OUT_OF_STOCK` / `INSUFFICIENT_STOCK`). Decrement happens only after payment verification (Modules 7/9), with the same `stock >= quantity` condition.
- `GET /api/orders` and `GET /api/orders/:id` return only confirmed orders (`orderStatus` set) belonging to the caller; anything else is 404.
- The order stores a snapshot (ingredient id, name, price) of every ingredient, so history does not depend on current inventory.

## Module 7 decisions (approved by Zaira)

- Razorpay **test keys only** (`rzp_test_`; anything else is refused). No webhook for now (**note for Module 11**). The amount comes from the stored order (database prices) in paise.
- `POST /api/orders/:id/payment` re-checks stock and prices (409 if insufficient or changed) and creates a **fresh** Razorpay order every time, so closing the popup never blocks a retry.
- `POST /api/payments/verify` checks the HMAC signature, claims `PENDING -> PAID` atomically (only one request can), then takes `quantity` of every ingredient with an atomic `stock >= quantity` condition, rolling back on any shortfall. Only then is `orderStatus` set to `ORDER_RECEIVED`. A repeated verify never decrements twice.
- Rare race (stock gone after payment): `paymentStatus: PAID`, no `orderStatus`, `needsRefund: true`, a clear message to the user; the refund is manual. Documented in the README.
- The stock decrement lives in Module 7 (spec section 12); Module 9 adds the admin inventory UI, manual updates and alerts without changing verify.

## Module 8 decisions (approved by Zaira)

- One shared session token per browser profile. For the demo, admin runs in an incognito window and the customer in a normal one (documented in TESTING.md and DEMO-CHECKLIST.md).
- `POST /api/admin/login` accepts only admins and gives customers the same generic 401 as a wrong password; it has its own stricter rate limit and ignores email verification. No admin registration exists.
- Everything else under `/api/admin` sits behind `authenticateUser` + `requireAdmin` applied once at the router; a test crawls the router so a future unguarded route fails the suite.
- Admin accounts are blocked (403) from the customer-only order and payment routes.
- `GET /api/admin/orders`: confirmed orders only, newest first, capped at 200, with customer name and email. `PATCH /api/admin/orders/:id/status`: forward only, one step at a time; skips, backwards moves, repeats, unknown statuses and orders without a status (unpaid or `needsRefund`) are rejected. The admin orders screen and user live tracking are Module 10.
- Admin password change: `npm run admin:reset-password` (reads `ADMIN_EMAIL` / `ADMIN_PASSWORD`, admin accounts only, invalidates older admin tokens). No email-based admin reset.

## Module 9 decisions (approved by Zaira)

- Status rule (`inventoryStatus`): `OUT_OF_STOCK` at 0, `LOW` when stock is strictly below the item's own threshold, otherwise `OK`. The dashboard counts active items only.
- Editable by admin: stock, low-stock threshold and active only. No price editing in the admin UI.
- Setting an absolute stock must carry `expectedStock`; if the stock changed meanwhile the server answers 409 with the current item and the screen refreshes that row. The `+10` / `+50` restock buttons use an atomic `$inc` that cannot take stock below 0 (or above 1,000,000).
- No audit trail; `updatedAt` is the only record of a change.
- Dashboard overview shows low and out-of-stock counts. Orders overview and live statuses are Module 10.

## Module 10 decisions (approved by Zaira)

- Scheduler: `node-cron`, expression from `LOW_STOCK_CHECK_CRON` (default every 15 minutes; `*/1 * * * *` for the demo video); an invalid value falls back to the default with a warning. It never starts under `NODE_ENV=test`. Each run logs one short line (items checked, alerts sent) with no addresses or secrets.
- One digest email per run lists every newly low item (name, category, stock, threshold, status). Recipient: `ADMIN_ALERT_EMAIL`, falling back to `ADMIN_EMAIL`.
- Alert state per item (`lowStockAlertState`: LOW or OUT_OF_STOCK). An alert is sent only when an item gets worse than the state it was last alerted for: LOW -> OUT_OF_STOCK is a new alert, an unchanged state is never repeated. Restocking to `>=` the threshold clears the state immediately (inside the inventory update, not at the next run); OUT_OF_STOCK -> LOW lowers it to LOW without an email, so a later fall to 0 alerts again.
- Items are claimed atomically before sending (overlapping runs and multiple instances cannot double-send); a failed send releases the claim so the next run retries. The shared `inventoryStatus` rule is used by the screen and the scheduler.
- Demo helper: admin-only `POST /api/admin/inventory/check-low-stock` and a "Run low-stock check now" button on the inventory page; same job, same duplicate rules.
- Real-time = polling (spec 5.1): 5 s for customers (My orders, Order details), 10 s for admin (orders, dashboard). Polling pauses when the tab is hidden, refreshes when it becomes visible, never overlaps, and stops on unmount. A failed poll keeps the last data and shows "Reconnecting".
- Admin orders screen shows only the one legal next step as a button; the server still enforces it.

## TODO

- [ ] **Module 11 (note):** `npm audit` in `server` reports 3 high-severity findings, all in the dev-only chain `nodemon` -> `chokidar` -> `braces` (stack-exhaustion DoS on deeply nested glob patterns). They are not in production dependencies (the client reports 0). The only offered fix downgrades nodemon to 1.14.10, which is not safe; revisit when nodemon ships a fixed chokidar.


- [ ] **Module 11:** add a Razorpay webhook (`payment.captured`) as a safety net for browsers that close before verify, and a screen or report for `needsRefund` orders.

- [ ] **After Module 7:** preset pizza pre-select. Decide how a preset's listed price relates to the builder's ingredient-sum price (Margherita is listed at ₹249 but its ingredients sum to about ₹140). If a `defaultIngredients` field is added to Pizza, keep `seed:menu` idempotent and update existing dev records safely. "Customize" currently opens an empty builder for every pizza.
- [ ] Unpaid orders left behind (user abandons payment) are kept and hidden from history; decide on a cleanup or expiry (Module 11).
- [ ] **After Module 3 is verified:** remove the temporary `AUTH_REQUIRE_VERIFIED` setting (or keep it hard-coded to `true`). It exists only so unverified users can log in during development; it is already ignored in production.
- [ ] Restrict Atlas Network Access (currently `0.0.0.0/0`) before any deployment.

## Module 2 decisions (approved by Zaira)

- JWT is stored in `localStorage` and sent as a Bearer token (1 day expiry).
- Password rule, identical on client and server: 8-72 characters, at least one letter and one number.
- Public registration always creates `role: "user"`; a `role` field in the request is rejected.
- Admin accounts exist only via `npm run seed:admin` (idempotent, never overwrites a password).
