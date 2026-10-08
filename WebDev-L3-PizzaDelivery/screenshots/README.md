# Screenshots

Six screenshots are included, captured by an automated browser (`tools/demo-video/screenshots.js`) against the built app with a throw-away demo customer:

| File | Page |
| --- | --- |
| `01-login.png` | Customer login |
| `02-user-dashboard.png` | User dashboard with the six preset pizzas |
| `03-pizza-builder.png` | Pizza builder with a selection and the running total |
| `04-order-summary.png` | Order summary: itemised prices, quantity 2, total |
| `06-admin-dashboard.png` | Admin dashboard |
| `07-admin-inventory.png` | Inventory with one item showing the **Low stock** badge |

## Not included (and why)

| Planned file | Why it is missing |
| --- | --- |
| `05-razorpay-checkout.png` | Needs the Razorpay checkout window. Razorpay's API returns HTTP 406 for requests from Pakistan, so the checkout could not be opened. |
| `08-admin-orders.png` | Needs at least one paid order, which needs a successful payment. |
| `09-order-tracking.png` | Needs a paid order as well. |

These were not faked. See "Known limitations" in the main README.
