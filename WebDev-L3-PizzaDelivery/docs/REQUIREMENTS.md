# Requirement Traceability Matrix

Source of truth: [OIBSIP_WebDev_Level3_PizzaDelivery_Master_Spec.md](OIBSIP_WebDev_Level3_PizzaDelivery_Master_Spec.md).
A row is only marked ✅ after it is implemented **and** verified. Nothing is checked off in advance.

Legend: ☐ not started · 🚧 in progress · ✅ verified

## Mandatory OASIS requirements

| ID  | Requirement                              | Module            | Implementation | Test | Status |
| --- | ---------------------------------------- | ----------------- | -------------- | ---- | ------ |
| U1  | User registration + email verification   | 2, 3              | -              | -    | ☐      |
| U2  | JWT login                                | 2                 | -              | -    | ☐      |
| U3  | Forgot password + email reset link       | 3                 | -              | -    | ☐      |
| U4  | Pizza dashboard                          | 4                 | -              | -    | ☐      |
| U5  | At least 5 pizza bases                   | 4, 5              | -              | -    | ☐      |
| U6  | At least 5 sauces                        | 4, 5              | -              | -    | ☐      |
| U7  | Cheese selection                         | 5                 | -              | -    | ☐      |
| U8  | Multiple vegetable selection             | 5                 | -              | -    | ☐      |
| U9  | Order summary                            | 6                 | -              | -    | ☐      |
| U10 | Razorpay test-mode checkout              | 7                 | -              | -    | ☐      |
| U11 | Order statuses (Received/Kitchen/Delivery) | 6, 10           | -              | -    | ☐      |
| U12 | Real-time status on user dashboard       | 10                | -              | -    | ☐      |
| A1  | Separate admin login                     | 8                 | -              | -    | ☐      |
| A2  | Inventory dashboard                      | 9                 | -              | -    | ☐      |
| A3  | Automatic stock decrement after orders   | 9                 | -              | -    | ☐      |
| A4  | Manual stock update                      | 9                 | -              | -    | ☐      |
| A5  | Configurable low-stock threshold         | 9, 10             | -              | -    | ☐      |
| A6  | Scheduled low-stock email (node-cron)    | 10                | -              | -    | ☐      |
| A7  | Admin order management                   | 8, 10             | -              | -    | ☐      |

## Module progress

| #  | Module                                      | Status |
| -- | ------------------------------------------- | ------ |
| 1  | Project foundation & architecture           | 🚧 see below |
| 2  | User authentication                         | ☐ |
| 3  | Email verification & password recovery      | ☐ |
| 4  | Pizza dashboard                             | ☐ |
| 5  | Custom pizza builder                        | ☐ |
| 6  | Order management                            | ☐ |
| 7  | Razorpay payment                            | ☐ |
| 8  | Admin authentication & authorization        | ☐ |
| 9  | Inventory management                        | ☐ |
| 10 | Low-stock automation + real-time tracking   | ☐ |
| 11 | Testing, UI polish & submission             | ☐ |

### Module 1 foundation checklist (spec Phase 1)

| Item                          | Status |
| ----------------------------- | ------ |
| Repository structure          | ✅ |
| Client (React + Vite) builds  | ✅ |
| Server starts                 | see TESTING.md |
| MongoDB connection            | see TESTING.md |
| `/api/health` endpoint        | see TESTING.md |
| Frontend routing              | ✅ (verified in build; browser check in TESTING.md) |

## Decisions that refine the spec (approved by Zaira)

- Stock availability is checked **before** creating the Razorpay order; the final atomic decrement happens at payment verification with the condition `stock >= required quantity`.
- `paymentStatus` and `orderStatus` are separate fields. An unpaid order has `paymentStatus = PENDING` and **no** `ORDER_RECEIVED` status; `orderStatus` becomes `ORDER_RECEIVED` only after successful signature verification. Unpaid orders never appear in the user's order tracking.
- Seed data ships with 5 bases and 5 sauces.
