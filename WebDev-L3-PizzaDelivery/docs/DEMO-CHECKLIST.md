# Demo checklist

Run through this before recording the demo video. Items marked **(later)** do not exist yet and should be skipped until their module is approved. (Everything below exists as of Module 10.)

## Setup

1. Server `.env` has `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and Razorpay **test** keys (`RAZORPAY_KEY_ID` starts with `rzp_test_`).
2. `cd server && npm run seed:menu && npm run seed:admin`, then start both servers (`npm run dev` in `server` and in `client`).
3. **Two browser windows, so admin and customer are signed in at once:**
   - **Normal window:** the customer (http://localhost:5173).
   - **Incognito/private window:** the admin (http://localhost:5173/admin/login).
   - Why: the app keeps one login per browser profile, so admin and customer in the *same* window would replace each other. An incognito window has its own separate storage.
4. Razorpay test card: `4111 1111 1111 1111`, any future expiry, any CVV.

## Customer flow (normal window)

- [ ] Register, verify email, log in (or log in with an existing verified account)
- [ ] Dashboard shows 6 pizzas with images and ₹ prices
- [ ] Dashboard cards show a ₹ price and the ingredients of each pizza; **Customize** opens the builder with that pizza's ingredients already selected (or use **Build your own pizza** for an empty builder)
- [ ] Builder: base, sauce, exactly one cheese, vegetables (several or none); Back keeps choices; the review total equals the card price
- [ ] Review → Continue to summary: itemised breakdown, change quantity 1-5
- [ ] Proceed to pay → Razorpay popup; close it once (the order stays retryable), then pay with the test card
- [ ] Order detail shows "Payment successful"; My orders lists it as Order Received

## Admin flow (incognito window)

- [ ] Footer **Staff login** (or `/admin/login`), sign in as the admin
- [ ] Admin dashboard opens; the navbar shows admin links only
- [ ] A customer account cannot sign in here
- [ ] **Orders** screen lists the customer's paid order (name, email, pizza, quantity, amount, Paid)
- [ ] Click **Mark In Kitchen**, then **Mark Sent to Delivery**; only the next legal step is offered
- [ ] In the customer window, My orders and the order detail update by themselves within ~5 seconds (no reload), with the 3-step tracker moving
- [ ] Admin dashboard shows low / out-of-stock counts; **Manage inventory** opens the stock table
- [ ] After the customer's payment, the matching ingredients' stock in the admin table has dropped by the quantity (reload the page)
- [ ] Set one item's stock to a small number: its badge changes to Low stock; set 0: Out of stock, and the customer's builder shows it as out of stock
- [ ] Use **+10** / **+50** to restock, and change a low-stock threshold
- [ ] Low-stock email: set `LOW_STOCK_CHECK_CRON=*/1 * * * *` in `.env` before starting the server, lower one item's stock below its threshold, wait up to a minute for one digest email (or click **Run low-stock check now**); a second check sends nothing; restock above the threshold and drop again to get a new email

## Before recording

- [ ] `cd server && npm test` passes
- [ ] No real secrets visible on screen (hide `.env`)
