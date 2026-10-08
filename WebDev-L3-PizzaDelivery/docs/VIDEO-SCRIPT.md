# Demo video script

The Oasis video must be a real **screen recording** of the app working end to end, not a slideshow. Aim for roughly 6 to 8 minutes. Order follows spec section 28.

## Required: the first 2 seconds

The very first frame must already show these three lines, large and readable, and stay for at least 2 seconds (3 is safer):

```
Full Name: Zaira Shahid
Track: Web Development & Designing
Task: Pizza Delivery Full-Stack Application
```

Make it a plain title card (any slide or a text file in a full-screen editor) and start recording on it. Then switch to the browser.

## Before you press record

1. `server/.env` has working Gmail and Razorpay **test** settings, and `LOW_STOCK_CHECK_CRON=*/1 * * * *` (set it back to `*/15 * * * *` afterwards).
2. `cd server && npm run seed:menu && npm run seed:admin`, then start both servers.
3. Two browser windows: a **normal window** for the customer and an **incognito window** for the admin (they have separate logins). Put them side by side or switch between them.
4. Have a verified customer account ready, or register a new one live with a mailbox you can open.
5. Pick one ingredient to run low during the demo (for example the Classic base), and note its threshold on the inventory page.
6. Hide `.env`, bookmarks, notifications and personal email. Close unrelated tabs.
7. Test the card: `4111 1111 1111 1111`, any future expiry, any CVV.

## Scenes

| # | Time | What to show | What to say (short) |
| --- | --- | --- | --- |
| 1 | 0:00 | **Title card** (above) | Nothing, or read the three lines. |
| 2 | 0:05 | **Registration / login.** Show the register form and the verification email arriving, click the link, log in. (Or just log in if the account exists, mentioning that email verification is required.) | "Customers register with an email verification link, then log in with a token." |
| 3 | 0:45 | **Pizza dashboard.** Scroll the six pizzas with photos, ingredients and ₹ prices. | "Each preset's price is the sum of its ingredients, calculated by the server." |
| 4 | 1:15 | **Pizza builder.** Click Customize. Walk through base, sauce, **exactly one cheese**, several vegetables. Go Back to show selections are kept; show the validation message if you try Next with nothing chosen. | "Four steps, validation before moving on, and nothing is lost when going back." |
| 5 | 2:15 | **Order summary.** Show the itemised table, change the quantity, show the total changing. | "The server recomputes this price; the browser cannot set it." |
| 6 | 2:45 | **Razorpay test checkout.** Proceed to pay, show the Test Mode window, close it once and show that Pay now works again, then pay with the test card. | "Test mode only. Closing the window does not lose the order." |
| 7 | 3:30 | **Order confirmation.** "Payment successful", then **My orders** shows Order Received. | "The order is confirmed only after the server verifies the payment signature." |
| 8 | 3:50 | **Admin login** (incognito window): footer "Staff login", sign in, show the admin dashboard. Mention a customer cannot sign in here. | "Admin login is separate and protected on the server." |
| 9 | 4:20 | **Inventory.** Show the grouped stock table. Point out that the ingredients of the order just paid went down by the quantity. | "Stock is decremented automatically after each paid order." |
| 10 | 4:50 | **Admin order management.** Open Orders, show the new paid order with customer and details. | "Admins see paid orders and only the next legal status." |
| 11 | 5:10 | **Status update.** Click Mark In Kitchen. | "Statuses can only move forward." |
| 12 | 5:20 | **User real-time tracking.** Switch to the customer window **without reloading**: the tracker has moved. Mark Sent to Delivery and show it update again. | "The customer's page refreshes by itself every few seconds." |
| 13 | 5:50 | **Low-stock behaviour.** On the inventory page set the chosen item's stock below its threshold (badge turns Low stock). Wait up to a minute (or click "Run low-stock check now") and show the **one digest email** in the inbox. Click the check again: "No new low-stock items". Optional: restock above the threshold. | "A scheduled job emails once, and does not repeat while the item stays low." |
| 14 | 7:00 | **Wrap-up** (a few seconds): the admin dashboard or the repository README. | One sentence of thanks. |

## Tips

- Narrate calmly and name what you are clicking; do not read code.
- If something is slow (email, Razorpay), cut or speed up that part when editing, but do not fake any result.
- Say only what the app really does. The tracking uses polling (not WebSockets), payments are test mode only, and the app is not deployed unless you deploy it.
- Export at 1080p if possible, and check the first 2 seconds again in the exported file.
