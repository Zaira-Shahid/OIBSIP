# LinkedIn post (draft)

Oasis requires a LinkedIn post that links the demo video, tags Oasis Infobyte, includes `#oasisinfobyte` and a domain hashtag, and **describes only what is really built**. This draft does that; replace the bracketed parts, and edit the wording so it sounds like you.

---

I just finished Task 1 of my Web Development & Designing internship (Level 3) with @Oasis Infobyte: a full-stack **Pizza Delivery application**.

What it does:
🍕 Customers register (with email verification), build a pizza step by step (base, sauce, cheese, vegetables) or start from a preset, and see an itemised order summary
💳 Pay with Razorpay in test mode. The server recomputes every price and verifies the payment signature before an order is confirmed
📦 Stock is decremented automatically after each paid order, and the admin can manage inventory and low-stock thresholds
📧 A scheduled job (node-cron) emails the admin one digest when ingredients run low, without repeating the alert
🔄 Admins move orders from Received to In Kitchen to Sent to Delivery, and the customer's page updates by itself (polling)

Built with React.js, Node.js, Express.js and MongoDB, with JWT authentication and separate, server-protected admin access.

▶️ Demo video: [VIDEO LINK]
💻 Code: [GITHUB LINK - https://github.com/Zaira-Shahid/OIBSIP]

What I learned: keeping prices and stock decisions on the server, making payment confirmation safe to repeat, and testing the tricky cases (races, duplicate emails, refused input), not only the happy path.

#oasisinfobyte #webdevelopment #fullstack #reactjs #nodejs #expressjs #mongodb #razorpay #internship

---

## Before you post

- Replace `[VIDEO LINK]` and `[GITHUB LINK]`. The repository must be **public** and named `OIBSIP`.
- Type `@Oasis Infobyte` and pick the company page from the suggestions so it becomes a real tag.
- Keep every claim true: payments are test mode only, tracking uses polling, and the app is not deployed unless you have deployed it.
- Do not paste keys, connection strings or personal email addresses in the post or the video.
