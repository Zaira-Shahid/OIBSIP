# API reference

Base URL in development: `http://localhost:5000/api` (the Vite dev server proxies `/api`). All bodies and responses are JSON.

## Conventions

- **Success:** `{ "success": true, "data": { ... } }` (some endpoints return a `message` instead of `data`).
- **Error:** `{ "success": false, "message": "...", "code": "..." }`. `code` is present only when a client can act on it (for example `EMAIL_NOT_VERIFIED`). Stack traces and database details are never returned.
- **Authentication:** `Authorization: Bearer <token>`. The token comes from a login endpoint and is valid for 1 day. The user is re-read from the database on every request, so a deleted account, a changed role or a password reset takes effect immediately.
- **Roles:** `customer` endpoints reject admin accounts (403); `admin` endpoints reject customers (403). Missing or invalid token: 401.
- **Validation:** unknown fields are rejected (400). Prices, totals and statuses are never accepted from the client; the server computes them.
- **Rate limits** (per IP, 15 minutes, off in tests): register 10, login 20, email-sending endpoints 5, token endpoints 20, admin login 10, create order 30, payments 30. Exceeded: 429.

Common status codes: `400` invalid input, `401` not logged in / bad token, `403` wrong role or unverified email, `404` not found, `409` conflict with current state, `429` rate limited, `502` payment or mail provider problem, `503` payments not configured.

---

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | none | `{ status: "ok" \| "degraded", database, uptime }`; 503 when the database is not connected. |

## Authentication (customers)

| Method | Path | Auth | Body | Result |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | none | `{ name, email, password }` | 201 `{ user, emailSent }`. Always creates a `user`; a `role` field is rejected. Sends a verification email (valid 24 hours). 409 if the email exists. |
| GET | `/auth/verify-email?token=` | none | | Verifies the account. The token is single-use. 400 if invalid, expired or used. |
| POST | `/auth/resend-verification` | none | `{ email }` | Same generic message whether or not the account exists. |
| POST | `/auth/login` | none | `{ email, password }` | `{ token, user }`. Generic 401 for a wrong password, an unknown email **or an admin account**. 403 `EMAIL_NOT_VERIFIED` until the email is verified. |
| GET | `/auth/me` | any | | `{ user }` for the token. |
| POST | `/auth/forgot-password` | none | `{ email }` | Same generic message for any email; sends a reset link (valid 1 hour) only for a real customer account. |
| POST | `/auth/reset-password` | none | `{ token, password }` | Sets a new password, verifies the email, and invalidates every token issued before the reset. The reset token is single-use. |

Password rule (client and server): 8 to 72 characters, at least one letter and one number.

## Menu and builder (public)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/pizzas` | Available preset pizzas, cheapest first: `{ pizzas: [{ id, name, description, image, available, price, ingredients[], selection: { base, sauce, cheese, vegetables[] } }] }`. `price` is the server-computed sum of the preset's ingredient prices. A preset whose ingredients are missing or inactive is omitted. |
| GET | `/pizzas/:id` | One preset (same shape); 404 for an unknown, malformed, unavailable or unbuildable id. |
| GET | `/ingredients` | Active ingredients grouped by category: `{ ingredients: { base: [], sauce: [], cheese: [], vegetable: [] } }`, each `{ id, name, price, available }`. `available` is false at zero stock; stock numbers are never exposed. |
| POST | `/pizzas/price` | Quote a custom pizza. Body: `{ base, sauce, cheese, vegetables?: [], quantity?: 1-5 }` (ingredient ids). Returns `{ items: [{ id, name, category, price }], unitPrice, quantity, total }`. Exactly one base, sauce and cheese; vegetables optional; no duplicates. 400 for a wrong category or unknown id; 409 `OUT_OF_STOCK` / `INSUFFICIENT_STOCK` when stock is below the quantity. |

## Orders (customers only)

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/orders` | `{ base, sauce, cheese, vegetables?, quantity? }` | Creates an **unpaid** order (`paymentStatus: PENDING`, no `orderStatus`). The amount is recomputed on the server from database prices; stock is checked but not reserved. 201 `{ order }`. Unpaid orders are deleted after 24 hours. |
| GET | `/orders` | | The caller's **confirmed** orders (those with an `orderStatus`), newest first. |
| GET | `/orders/:id` | | One confirmed order of the caller; 404 for anyone else's, an unpaid order, or a bad id. |
| POST | `/orders/:id/payment` | | Starts or restarts payment: re-checks stock and prices (409 `INSUFFICIENT_STOCK`, `OUT_OF_STOCK`, `PRICE_CHANGED`), creates a **fresh** Razorpay order and returns `{ orderId, payment: { keyId, razorpayOrderId, amount (paise), currency } }`. 409 `ALREADY_PAID` for a paid order; 503 `PAYMENTS_NOT_CONFIGURED`; 502 `GATEWAY_ERROR`. |

An order stores a snapshot (`customPizza`: base, sauce, cheese, vegetables, each with ingredient id, name and price), `unitPrice`, `quantity`, `amount`, `paymentStatus` (`PENDING`, `PAID`, `FAILED`) and `orderStatus` (`ORDER_RECEIVED`, `IN_KITCHEN`, `SENT_TO_DELIVERY`).

## Payments (customers only)

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/payments/verify` | `{ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` | Verifies the Razorpay signature (HMAC-SHA256 of `order_id|payment_id`), moves the order `PENDING -> PAID` atomically, takes `quantity` of every ingredient (each with an atomic `stock >= quantity` condition, rolled back on any shortfall) and only then sets `orderStatus: ORDER_RECEIVED`. Idempotent: repeating it never decrements stock twice. 400 `INVALID_SIGNATURE` / `PAYMENT_MISMATCH`; 409 `PAYMENT_PROCESSING`; 409 `PAID_NOT_CONFIRMED` when the ingredients ran out after payment (the order is flagged for a manual refund). |

Razorpay is used in **test mode only**: a key id that does not start with `rzp_test_` is refused.

## Admin (admin accounts only)

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/admin/login` | `{ email, password }` | The only unauthenticated admin route. Accepts only admin accounts; anything else gets the same generic 401. Not subject to email verification. |
| GET | `/admin/me` | | `{ user }`. |
| GET | `/admin/orders` | | Confirmed orders, newest first (max 200), each with `customer: { name, email }`. |
| PATCH | `/admin/orders/:id/status` | `{ status }` | Forward only: `ORDER_RECEIVED -> IN_KITCHEN -> SENT_TO_DELIVERY`. 400 unknown status; 409 `INVALID_TRANSITION` (skip, backwards, repeat or after delivery), `ORDER_NOT_CONFIRMED` (unpaid or awaiting refund), `STATUS_CONFLICT` (another admin acted first). |
| GET | `/admin/orders/refunds` | | Paid orders that could not be confirmed and need a manual refund: customer, `amount`, Razorpay `paymentReference`, `paidAt`. |
| POST | `/admin/orders/:id/mark-refunded` | | Records that the refund was made in the Razorpay dashboard. 409 `NOT_AWAITING_REFUND` if the order is not in that state. |
| GET | `/admin/inventory` | | `{ items, summary: { total, low, outOfStock } }`. Every item (inactive included) with `status` `OK`, `LOW` (stock strictly below its threshold) or `OUT_OF_STOCK`. The summary counts active items only. |
| PATCH | `/admin/inventory/:id` | see below | Edits stock, threshold and/or active. Nothing else (name, category, unit, price) is editable. |
| POST | `/admin/inventory/check-low-stock` | | Runs the low-stock job now, with the same duplicate rules as the scheduler: `{ checked, alerted: [...] }`. 409 `NO_RECIPIENT`; 502 `EMAIL_FAILED`. |

`PATCH /admin/inventory/:id` body (at least one of `stock`, `adjustBy`, `lowStockThreshold`, `active`):

- `{ stock, expectedStock }` sets an absolute stock (0 to 1,000,000). `expectedStock` is the stock the admin saw; if it changed meanwhile the server answers 409 `STOCK_CHANGED` with the current item in `data.item` and saves nothing.
- `{ adjustBy }` is an atomic whole-number change (for example `10`, `50`, `-5`) that cannot take stock below 0 or above 1,000,000 (409 `ADJUSTMENT_REJECTED`).
- `stock` and `adjustBy` cannot be combined. `lowStockThreshold` (0 to 1,000,000) and `active` (boolean) can accompany either.

## Background job

A `node-cron` job (`LOW_STOCK_CHECK_CRON`, default every 15 minutes) emails **one digest** to `ADMIN_ALERT_EMAIL` (falling back to `ADMIN_EMAIL`) listing items that newly became low or out of stock. An item is emailed once per state: again only if it worsens (low to out of stock), or after being restocked to its threshold and later dropping again. Overlapping runs and multiple server instances cannot double-send.
