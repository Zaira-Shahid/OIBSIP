# Demo checklist

Run through this before recording the demo video. Items marked **(later)** do not exist yet and should be skipped until their module is approved.

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
- [ ] Customize → builder: base, sauce, exactly one cheese, vegetables (several or none); Back keeps choices
- [ ] Review → Continue to summary: itemised breakdown, change quantity 1-5
- [ ] Proceed to pay → Razorpay popup; close it once (the order stays retryable), then pay with the test card
- [ ] Order detail shows "Payment successful"; My orders lists it as Order Received

## Admin flow (incognito window)

- [ ] Footer **Staff login** (or `/admin/login`), sign in as the admin
- [ ] Admin dashboard opens; the navbar shows admin links only
- [ ] A customer account cannot sign in here
- [ ] Admin orders screen with status updates **(later, Module 10)**
- [ ] The customer's My orders updates live when the admin changes the status **(later, Module 10)**
- [ ] Inventory dashboard, manual stock update, low-stock email **(later, Modules 9/10)**

## Before recording

- [ ] `cd server && npm test` passes
- [ ] No real secrets visible on screen (hide `.env`)
