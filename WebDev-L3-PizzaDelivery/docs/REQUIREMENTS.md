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
| U10 | Razorpay test-mode checkout              | 7                 | `payment.controller`, `paymentService`, `OrderSummary`, `razorpay.js` | `server/tests/payments.test.js` (fake gateway) | 🚧 mocked tests pass; real test-mode checkout pending your keys |
| U11 | Order statuses (Received/Kitchen/Delivery) | 6, 7, 10        | `Order.orderStatus`, set to ORDER_RECEIVED on verified payment | `server/tests/payments.test.js` | 🚧 Received done; Kitchen/Delivery by admin in Modules 8/10 |
| U12 | Real-time status on user dashboard       | 10                | -              | -    | ☐      |
| A1  | Separate admin login                     | 8                 | -              | -    | ☐      |
| A2  | Inventory dashboard                      | 9                 | -              | -    | ☐      |
| A3  | Automatic stock decrement after orders   | 7, 9              | `decrementStock` in `payment.controller` | `server/tests/payments.test.js` | 🚧 implemented in Module 7; verify with the admin inventory view in Module 9 |
| A4  | Manual stock update                      | 9                 | -              | -    | ☐      |
| A5  | Configurable low-stock threshold         | 9, 10             | -              | -    | ☐      |
| A6  | Scheduled low-stock email (node-cron)    | 10                | -              | -    | ☐      |
| A7  | Admin order management                   | 8, 10             | -              | -    | ☐      |

## Module progress

| #  | Module                                      | Status |
| -- | ------------------------------------------- | ------ |
| 1  | Project foundation & architecture           | ✅ |
| 2  | User authentication                         | ✅ approved by Zaira (U1/U2 stay 🚧 until Module 3) |
| 3  | Email verification & password recovery      | ✅ approved by Zaira (real-inbox check not run by Claude; U1–U3 stay 🚧 until that is done) |
| 4  | Pizza dashboard                             | ✅ approved by Zaira (U5/U6 stay 🚧 until the Module 5 builder shows them) |
| 5  | Custom pizza builder                        | ✅ approved by Zaira |
| 6  | Order management                            | ✅ approved by Zaira (merged via PR #4) |
| 7  | Razorpay payment                            | 🚧 built, mocked tests pass; awaiting your keys, browser check and "approved" |
| 8  | Admin authentication & authorization        | ☐ |
| 9  | Inventory management                        | ☐ |
| 10 | Low-stock automation + real-time tracking   | ☐ |
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

## TODO

- [ ] **Module 11:** add a Razorpay webhook (`payment.captured`) as a safety net for browsers that close before verify, and a screen or report for `needsRefund` orders.

- [ ] **After Module 7:** preset pizza pre-select. Decide how a preset's listed price relates to the builder's ingredient-sum price (Margherita is listed at ₹249 but its ingredients sum to about ₹140). If a `defaultIngredients` field is added to Pizza, keep `seed:menu` idempotent and update existing dev records safely. "Customize" currently opens an empty builder for every pizza.
- [ ] Unpaid orders left behind (user abandons payment) are kept and hidden from history; decide on a cleanup or expiry (Module 11).
- [ ] **After Module 3 is verified:** remove the temporary `AUTH_REQUIRE_VERIFIED` setting (or keep it hard-coded to `true`). It exists only so unverified users can log in during development; it is already ignored in production.
- [ ] Restrict Atlas Network Access (currently `0.0.0.0/0`) before any deployment.
- [ ] Module 8: separate `POST /api/admin/login`. `POST /api/auth/login` already rejects admin accounts.

## Module 2 decisions (approved by Zaira)

- JWT is stored in `localStorage` and sent as a Bearer token (1 day expiry).
- Password rule, identical on client and server: 8-72 characters, at least one letter and one number.
- Public registration always creates `role: "user"`; a `role` field in the request is rejected.
- Admin accounts exist only via `npm run seed:admin` (idempotent, never overwrites a password).
