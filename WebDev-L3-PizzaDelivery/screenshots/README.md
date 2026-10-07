# Screenshots

The main README embeds these nine images. Put the files in **this folder** with **exactly these names** (PNG).

| File | Page | How to get it |
| --- | --- | --- |
| `01-login.png` | Customer login | Normal window, logged out, open `/login`. Show the empty form. |
| `02-user-dashboard.png` | User dashboard | Logged in as a customer, open `/dashboard` and wait until all six pizza photos have loaded. |
| `03-pizza-builder.png` | Pizza builder | Click **Customize** on a pizza, stay on step 1 or 3 with a visible selection, so the stepper, the selected state and the running total all show. |
| `04-order-summary.png` | Order summary | Builder review step → **Continue to summary**. Show the whole itemised table with a quantity of 2 so "price per pizza", "× 2" and the total are all visible. |
| `05-razorpay-checkout.png` | Razorpay test checkout | Click **Proceed to pay** so the Razorpay window is open, with the "Test Mode" banner visible. **Do not type a real card.** |
| `06-admin-dashboard.png` | Admin dashboard | **Incognito window**, logged in as admin, `/admin/dashboard`, with the inventory and order counts visible. |
| `07-admin-inventory.png` | Inventory | `/admin/inventory`, ideally with one item showing **Low stock** and the badges visible. |
| `08-admin-orders.png` | Order management | `/admin/orders` with at least one paid order and its next-step button. |
| `09-order-tracking.png` | Order tracking | Customer window, `/orders/<id>` of a paid order showing the three-step tracker (set it to **In Kitchen** from the admin first so a middle step is highlighted). |

## Before you capture

- Use a clean browser profile (or a private window) so **bookmarks, other tabs, extensions and your email address** are not visible. A customer name like "Demo Customer" is better than a real name.
- Window about 1280×720 or larger, browser zoom 100%.
- **Never capture** `server/.env`, a terminal showing keys, a real card number, or your Razorpay/Atlas dashboards with keys or connection strings.
- Capture in this order so the data lines up: log in as a customer (01, 02) → builder (03) → summary (04) → payment window (05) → pay → admin dashboard and inventory (06, 07; lower one stock first for the Low badge) → admin orders (08) → mark In Kitchen → customer order page (09).
- Windows: `Win + Shift + S` (area capture) then paste into Paint and save as PNG.

## After capturing

Check that every file exists and opens, then run from the repository root:

```bash
ls WebDev-L3-PizzaDelivery/screenshots
```

You should see all nine PNG files plus this README. The README images only display once the files are committed.
