# OIBSIP Web Development & Designing --- Level 3

## Master Implementation Specification

### Project: Pizza Delivery Full-Stack Application

> **Status:** Implementation-ready master spec\
> **Program:** OASIS INFOBYTE Summer Internship Program (OIBSIP)\
> **Track:** Web Development & Designing\
> **Level:** Level 3\
> **Task:** Task 1 --- Pizza Delivery Full-Stack Application\
> **Purpose:** Single source of truth for implementation by Claude in VS
> Code

------------------------------------------------------------------------

# 1. IMPORTANT --- READ THIS FIRST

This document is the project specification and implementation contract.

Claude must read this entire file before making architectural or
implementation decisions.

## Non-negotiable rules

1.  Do not hallucinate requirements, APIs, credentials, business rules,
    or completed work.
2.  Do not silently remove, weaken, or reinterpret an Oasis Infobyte
    requirement.
3.  Do not mark a requirement complete until it is actually implemented
    and tested.
4.  If something is ambiguous, ask Zaira before making a consequential
    assumption.
5.  Keep the project runnable after every major module.
6.  Prefer simple, maintainable architecture over unnecessary
    complexity.
7.  Do not add third-party services merely because they are fashionable.
8.  Never commit secrets, API keys, passwords, or private credentials.
9.  Use test/sandbox credentials for payment integration.
10. Every mandatory Oasis requirement must be traceable to an
    implementation and a test.
11. Before declaring the project complete, run the complete acceptance
    checklist in this document.
12. If a source requirement conflicts with an optional enhancement, the
    Oasis requirement wins.
13. Do not copy tutorials or repositories verbatim. Use external
    resources only for understanding and implementation guidance.
14. Keep documentation synchronized with the actual implementation.

------------------------------------------------------------------------

# 2. SOURCE REQUIREMENTS --- OASIS INFOBYTE

## 2.1 Completion rule

For Web Development & Designing, Oasis requires completion of **all
tasks within one chosen level**.

Selected level:

-   Level 3
-   Task 1 only
-   Pizza Delivery Full-Stack Application

Oasis describes Level 3 as a complex full-stack project requiring React,
Node.js, MongoDB, and API integration.

## 2.2 Official task objective

Build a production-grade, full-stack pizza ordering and inventory
management platform with:

-   separate Admin and User roles
-   real-time order tracking
-   payment integration
-   automated stock notifications

## 2.3 Required technology stack

The Oasis task card specifies:

-   React.js --- frontend
-   Node.js + Express.js --- backend
-   MongoDB --- database
-   Razorpay --- payment, test mode

Do not replace these core technologies without explicit approval from
Zaira.

------------------------------------------------------------------------

# 3. OFFICIAL FEATURE CHECKLIST

This is the highest-priority acceptance checklist.

## 3.1 User side

### Authentication

-   [ ] User registration with email verification
-   [ ] User login with JWT-based authorisation
-   [ ] Forgot password flow with email reset link

### Pizza dashboard

-   [ ] Dashboard displaying available pizza varieties

### Custom pizza builder

The builder must have these four steps:

-   [ ] Step 1 --- Choose a pizza base
-   [ ] Exactly/at least 5 selectable base options must be available
-   [ ] Step 2 --- Choose a sauce
-   [ ] Exactly/at least 5 selectable sauce options must be available
-   [ ] Step 3 --- Choose a cheese type
-   [ ] Step 4 --- Choose vegetables with multiple selection

### Ordering and payment

-   [ ] Order summary page before payment
-   [ ] Razorpay checkout integration
-   [ ] Razorpay must operate in test mode
-   [ ] Test payment success must confirm the order

### Order tracking

-   [ ] User dashboard displays order status
-   [ ] Required status flow:
    -   Order Received
    -   In Kitchen
    -   Sent to Delivery
-   [ ] Status changes must be reflected in real time on the user's
    dashboard

------------------------------------------------------------------------

# 4. ADMIN SIDE --- OFFICIAL REQUIREMENTS

## 4.1 Authentication

-   [ ] Separate admin login
-   [ ] Admin login must not be accessible through the normal user
    registration flow
-   [ ] Admin routes must be protected server-side
-   [ ] A normal user must not be able to access admin APIs by changing
    frontend routes

## 4.2 Inventory dashboard

Display current stock for:

-   [ ] Pizza bases
-   [ ] Sauces
-   [ ] Cheeses
-   [ ] Vegetables

## 4.3 Inventory operations

-   [ ] Stock automatically decremented after each order
-   [ ] Admin can manually update stock for each inventory item

## 4.4 Low-stock notification

-   [ ] Admin receives an automated email when an inventory item falls
    below a configurable threshold
-   [ ] Threshold must be configurable
-   [ ] Scheduled job must be used
-   [ ] `node-cron` is an acceptable implementation
-   [ ] Avoid sending duplicate alerts on every scheduler run for the
    same unchanged low-stock condition

## 4.5 Order management

-   [ ] Admin can view incoming orders
-   [ ] Admin can update order status
-   [ ] Status changes are reflected in real time on the user's
    dashboard
-   [ ] Polling or WebSockets may be used

------------------------------------------------------------------------

# 5. IMPLEMENTATION INTERPRETATION

The sections below define how we should implement the official
requirements without changing them.

Where Oasis gives an implementation choice, choose the simplest reliable
approach.

## 5.1 Real-time updates

Preferred implementation:

**Polling first**, unless WebSockets clearly improve the project without
unnecessary complexity.

Suggested approach:

-   User dashboard polls order status at a reasonable interval.
-   Admin updates the order.
-   User receives the updated status automatically.
-   Polling stops/cleans up when the component unmounts.

If WebSockets are used, keep the implementation documented.

## 5.2 Email

A real email provider may be used for development/demo.

Architecture must isolate email delivery behind a service:

`emailService`

Responsibilities may include:

-   verification email
-   password reset email
-   low-stock alert

Never hardcode credentials.

## 5.3 Payment

Use Razorpay test/sandbox mode only.

The application must clearly distinguish:

-   order creation
-   payment initiation
-   payment verification
-   confirmed order

Do not treat a frontend-only success message as trustworthy payment
verification.

------------------------------------------------------------------------

# 6. RECOMMENDED PROJECT ARCHITECTURE

Use a clean two-application structure.

``` text
OIBSIP/
└── WebDev-L3-PizzaDelivery/
    ├── client/
    ├── server/
    ├── README.md
    ├── .gitignore
    └── docs/
        ├── REQUIREMENTS.md
        ├── API.md
        ├── TESTING.md
        └── DEMO-CHECKLIST.md
```

## 6.1 Frontend

``` text
client/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── context/
│   ├── utils/
│   ├── assets/
│   └── App.*
├── public/
├── package.json
└── README.md
```

Use React.js as required by Oasis.

## 6.2 Backend

``` text
server/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── jobs/
│   ├── utils/
│   ├── validators/
│   └── app.*
├── package.json
└── README.md
```

------------------------------------------------------------------------

# 7. DATABASE DESIGN

Use MongoDB.

Suggested core collections/models:

## User

``` text
User
- _id
- name
- email
- passwordHash
- role
- isEmailVerified
- verificationToken / verification metadata
- passwordResetToken / expiry metadata
- createdAt
- updatedAt
```

Roles:

-   user
-   admin

Do not expose password hashes or security tokens through API responses.

## Pizza

``` text
Pizza
- _id
- name
- description
- image
- price
- available
- createdAt
- updatedAt
```

## Ingredient / InventoryItem

``` text
InventoryItem
- _id
- name
- category
- stock
- lowStockThreshold
- unit
- active
- createdAt
- updatedAt
```

Categories:

-   base
-   sauce
-   cheese
-   vegetable

## Order

``` text
Order
- _id
- userId
- items
- customPizza
- amount
- paymentStatus
- paymentProvider
- paymentReference
- orderStatus
- createdAt
- updatedAt
```

Required order statuses:

``` text
ORDER_RECEIVED
IN_KITCHEN
SENT_TO_DELIVERY
```

The UI may display human-friendly labels:

``` text
Order Received
In Kitchen
Sent to Delivery
```

## Order item/custom pizza structure

Keep enough information to reconstruct exactly what the customer
ordered:

``` text
customPizza:
- base
- sauce
- cheese
- vegetables[]
```

Do not depend on current inventory names to reconstruct historical
orders.

------------------------------------------------------------------------

# 8. AUTHENTICATION DESIGN

## 8.1 Registration

Flow:

1.  User submits registration.
2.  Validate input.
3.  Check whether email already exists.
4.  Hash password.
5.  Create unverified user.
6.  Generate verification token.
7.  Send verification email.
8.  User opens verification link.
9.  Mark account as verified.
10. Allow authenticated access.

## 8.2 Login

Flow:

1.  User submits email/password.
2.  Backend validates credentials.
3.  Verify account status.
4.  Issue JWT.
5.  Frontend stores/uses authentication securely according to chosen
    implementation.
6.  Protected routes require authentication.

## 8.3 Forgot password

Flow:

1.  User submits email.
2.  Generate time-limited reset token.
3.  Send reset email.
4.  User opens reset link.
5.  User submits new password.
6.  Hash new password.
7.  Invalidate reset token.
8.  Confirm successful reset.

Never reveal whether an arbitrary email exists in a way that enables
account enumeration.

## 8.4 Admin authentication

Admin authentication must be separate from public user registration.

For development, create an explicitly documented admin seed/setup
mechanism.

Do not create an open public "register as admin" option.

------------------------------------------------------------------------

# 9. AUTHORIZATION

Authentication is not authorization.

Backend middleware must enforce:

``` text
authenticateUser
requireAdmin
```

Examples:

-   User can read their own orders.
-   User cannot read another user's order.
-   User cannot update inventory.
-   User cannot change order status.
-   User cannot access admin APIs.
-   Admin can view/manage inventory.
-   Admin can view/update orders.

Authorization must be enforced on the backend, not only in React.

------------------------------------------------------------------------

# 10. PIZZA BUILDER

## Step 1 --- Base

Provide at least 5 options.

Example data:

-   Classic
-   Thin Crust
-   Cheese Burst
-   Whole Wheat
-   Stuffed Crust

## Step 2 --- Sauce

Provide at least 5 options.

Example data:

-   Classic Tomato
-   Spicy Marinara
-   Garlic Herb
-   BBQ
-   Pesto

## Step 3 --- Cheese

Provide cheese choices.

Examples may include:

-   Mozzarella
-   Cheddar
-   Parmesan
-   Four Cheese

## Step 4 --- Vegetables

Multiple selections.

Examples:

-   Bell Pepper
-   Onion
-   Mushroom
-   Olive
-   Jalapeño
-   Sweet Corn
-   Tomato

These are example seed data, not additional Oasis requirements.

## Builder UX

Requirements:

-   clear current step
-   visible progress
-   selected state
-   back/next controls
-   validation before proceeding
-   final summary
-   responsive layout
-   accessible controls
-   no lost selections when moving backward

------------------------------------------------------------------------

# 11. ORDER FLOW

Recommended flow:

``` text
Dashboard
   ↓
Pizza Builder
   ↓
Order Summary
   ↓
Create Payment Order
   ↓
Razorpay Checkout
   ↓
Payment Verification
   ↓
Confirm Order
   ↓
Order Received
   ↓
In Kitchen
   ↓
Sent to Delivery
```

Important:

The backend must be the source of truth for order state.

Do not create a paid/confirmed order solely because the frontend says
payment succeeded.

------------------------------------------------------------------------

# 12. INVENTORY LOGIC

Inventory categories:

``` text
base
sauce
cheese
vegetable
```

When an order is confirmed:

1.  Validate requested ingredients.
2.  Verify sufficient stock.
3.  Perform stock decrement atomically where practical.
4.  Persist order.
5.  Return confirmed result.
6.  Trigger/queue low-stock evaluation.

Avoid allowing stock to become negative.

If there is insufficient stock:

-   reject the order
-   show a clear user-facing message
-   do not partially decrement stock

------------------------------------------------------------------------

# 13. LOW-STOCK SCHEDULER

Use a scheduled backend job.

Concept:

``` text
Every N minutes
    ↓
Read active inventory
    ↓
Find items where stock < lowStockThreshold
    ↓
Check whether alert is already active/recent
    ↓
Send admin email when required
    ↓
Record alert state/log
```

The threshold must be configurable per inventory item.

The scheduler must not cause an email storm.

------------------------------------------------------------------------

# 14. ADMIN DASHBOARD

Minimum areas:

## Overview

Show useful operational information such as:

-   incoming orders
-   current order statuses
-   low-stock items

## Inventory

For each item:

-   name
-   category
-   current stock
-   threshold
-   status
-   update control

Admin can manually update stock.

## Orders

Admin can:

-   view orders
-   inspect customer/order details
-   see payment state
-   update order status

Required status transitions:

``` text
Order Received
→ In Kitchen
→ Sent to Delivery
```

------------------------------------------------------------------------

# 15. API DESIGN

Use REST APIs with clear separation of concerns.

Suggested endpoints:

## Auth

``` text
POST /api/auth/register
GET  /api/auth/verify-email
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

## Pizzas

``` text
GET /api/pizzas
GET /api/pizzas/:id
```

## Inventory

``` text
GET   /api/admin/inventory
PATCH /api/admin/inventory/:id
```

## Orders

``` text
POST  /api/orders
GET   /api/orders
GET   /api/orders/:id
PATCH /api/admin/orders/:id/status
```

## Payments

``` text
POST /api/payments/create-order
POST /api/payments/verify
```

These are recommended routes, not source requirements. Adjust them if
the final architecture benefits from another clean REST structure.

------------------------------------------------------------------------

# 16. API RESPONSE STANDARD

Prefer a consistent response structure.

Success:

``` json
{
  "success": true,
  "data": {}
}
```

Error:

``` json
{
  "success": false,
  "message": "Human-readable message"
}
```

Do not leak:

-   stack traces
-   database internals
-   password hashes
-   tokens
-   secret keys

------------------------------------------------------------------------

# 17. VALIDATION

Validate on both client and server.

Minimum validation areas:

-   registration
-   login
-   password reset
-   pizza builder
-   order payload
-   inventory updates
-   admin order status
-   payment verification

Server-side validation is mandatory even if the frontend validates the
same fields.

------------------------------------------------------------------------

# 18. ERROR HANDLING

Implement centralized backend error handling.

Handle at least:

-   invalid request
-   authentication failure
-   authorization failure
-   missing resource
-   duplicate account
-   invalid verification token
-   expired reset token
-   insufficient inventory
-   invalid order
-   payment failure
-   payment verification failure
-   database failure
-   email delivery failure

Frontend must display understandable messages rather than raw API
errors.

------------------------------------------------------------------------

# 19. SECURITY BASELINE

At minimum:

-   password hashing
-   JWT authentication
-   role-based authorization
-   input validation
-   environment variables for secrets
-   secure CORS configuration
-   no credentials in Git
-   no sensitive information in logs
-   rate limiting on sensitive auth endpoints if practical
-   token expiry
-   reset-token expiry
-   payment signature verification
-   backend authorization for admin actions

Do not claim the application is fully production-secure merely because
these controls exist.

------------------------------------------------------------------------

# 20. ENVIRONMENT VARIABLES

Create a `.env.example`.

Example categories:

``` text
PORT=
MONGODB_URI=
JWT_SECRET=

CLIENT_URL=

EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Never commit real `.env` files containing credentials.

------------------------------------------------------------------------

# 21. UI / UX DIRECTION

Oasis requires a visually functional web application. We should make the
implementation polished without adding unnecessary scope.

Target:

-   premium modern food-delivery interface
-   responsive desktop/tablet/mobile
-   clear navigation
-   strong visual hierarchy
-   accessible contrast
-   consistent spacing
-   loading states
-   empty states
-   error states
-   success states
-   disabled states
-   confirmation states
-   clear form validation

Avoid:

-   excessive animations
-   unreadable text
-   giant unnecessary dependencies
-   fake functionality
-   placeholder buttons that do nothing
-   unfinished screens

------------------------------------------------------------------------

# 22. REQUIRED USER SCREENS

Minimum suggested screens:

``` text
/
├── Landing/Home
├── Register
├── Verify Email
├── Login
├── Forgot Password
├── Reset Password
├── User Dashboard
├── Pizza Builder
├── Order Summary
└── Order Tracking
```

Admin:

``` text
/admin/login
/admin/dashboard
/admin/inventory
/admin/orders
```

Route names may differ if the architecture is cleaner.

------------------------------------------------------------------------

# 23. STATE MANAGEMENT

Use a simple predictable state-management approach.

Do not introduce Redux/Zustand/etc. unless complexity actually requires
it.

At minimum manage:

-   authentication state
-   current user
-   pizza builder selections
-   order state
-   admin inventory
-   admin orders
-   loading/error/success state

------------------------------------------------------------------------

# 24. TESTING REQUIREMENTS

Claude must test the application before completion.

## Authentication

-   [ ] Register valid user
-   [ ] Reject invalid registration
-   [ ] Verify email
-   [ ] Login verified user
-   [ ] Reject invalid credentials
-   [ ] Forgot password
-   [ ] Reset password
-   [ ] Protected user route
-   [ ] Admin route rejects normal user

## Pizza builder

-   [ ] Select base
-   [ ] Select sauce
-   [ ] Select cheese
-   [ ] Select multiple vegetables
-   [ ] Prevent invalid/incomplete submission
-   [ ] Summary reflects selected choices

## Payment

-   [ ] Razorpay test checkout opens
-   [ ] Test success works
-   [ ] Payment verification works
-   [ ] Failed payment does not create a falsely confirmed order

## Orders

-   [ ] Order is created after valid payment flow
-   [ ] User can view own order
-   [ ] User cannot view another user's order
-   [ ] Admin can view orders
-   [ ] Admin can update status
-   [ ] User receives updated status

## Inventory

-   [ ] Inventory displays
-   [ ] Manual stock update works
-   [ ] Order decrements stock
-   [ ] Insufficient stock is rejected
-   [ ] Stock never becomes negative

## Low-stock alerts

-   [ ] Threshold is configurable
-   [ ] Scheduler executes
-   [ ] Low-stock item is detected
-   [ ] Email is sent
-   [ ] Duplicate alert spam is prevented

------------------------------------------------------------------------

# 25. MANUAL DEMO TEST SCENARIO

Before recording the Oasis video, execute this exact scenario where
possible.

### Part A --- User

1.  Open application.
2.  Register.
3.  Verify email.
4.  Login.
5.  Open pizza dashboard.
6.  Select a pizza.
7.  Open custom pizza builder.
8.  Select base.
9.  Select sauce.
10. Select cheese.
11. Select multiple vegetables.
12. Review order summary.
13. Start Razorpay test checkout.
14. Complete test payment.
15. Show order confirmation.
16. Show `Order Received`.

### Part B --- Admin

17. Open admin login.
18. Login separately.
19. Show inventory dashboard.
20. Show current inventory.
21. Show incoming order.
22. Update order to `In Kitchen`.
23. Update order to `Sent to Delivery`.

### Part C --- User real-time tracking

24. Return to user dashboard.
25. Show the order status updated automatically.
26. Demonstrate the complete status progression.

### Part D --- Inventory

27. Demonstrate manual inventory update.
28. Demonstrate stock decrement caused by order.
29. If possible, demonstrate low-stock threshold behavior.

------------------------------------------------------------------------

# 26. GITHUB / OASIS SUBMISSION STRUCTURE

Oasis requires the repository name:

``` text
OIBSIP
```

Do not rename it to a custom project name.

Recommended structure:

``` text
OIBSIP/
└── WebDev-L3-PizzaDelivery/
    ├── client/
    ├── server/
    ├── docs/
    ├── README.md
    └── screenshots/
```

The task folder should contain:

-   source code
-   README.md
-   relevant screenshots/output files

------------------------------------------------------------------------

# 27. README REQUIREMENTS

The project README must clearly explain:

## Project

-   Project name
-   Oasis Infobyte track
-   Level
-   Task
-   Short description

## Features

Separate:

-   User features
-   Admin features
-   Payment
-   Inventory
-   Real-time tracking

## Tech stack

Explicitly mention:

-   React.js
-   Node.js
-   Express.js
-   MongoDB
-   Razorpay test mode

## Architecture

Explain:

``` text
React frontend
      ↓
Express API
      ↓
MongoDB
      ↓
External services
```

## Setup

Document:

1.  prerequisites
2.  clone repository
3.  install frontend dependencies
4.  install backend dependencies
5.  configure `.env`
6.  start MongoDB
7.  start backend
8.  start frontend

## Test account

If a demo account is provided, document it safely.

Never commit private credentials.

## Screenshots

Include screenshots of:

-   login
-   user dashboard
-   pizza builder
-   order summary
-   Razorpay test checkout
-   admin dashboard
-   inventory
-   order management
-   order tracking

------------------------------------------------------------------------

# 28. OASIS DEMO VIDEO REQUIREMENTS

The video must be an actual screen-recorded walkthrough.

The first 2 seconds must show:

``` text
Full Name: Zaira Shahid
Track: Web Development & Designing
Task: Pizza Delivery Full-Stack Application
```

Then show the application functioning end-to-end.

Do not make the video only a slideshow of screenshots.

Recommended video order:

1.  Title card
2.  User registration/login
3.  Pizza dashboard
4.  Pizza builder
5.  Order summary
6.  Razorpay test checkout
7.  Order confirmation
8.  Admin login
9.  Inventory
10. Admin order management
11. Status update
12. User real-time tracking
13. Low-stock notification/inventory behavior

------------------------------------------------------------------------

# 29. LINKEDIN REQUIREMENT

Oasis requires a LinkedIn post for the task demo.

The post should:

-   include/link the demo video
-   tag Oasis Infobyte
-   include `#oasisinfobyte`
-   include relevant domain hashtags such as `#webdevelopment`
-   accurately describe what was built
-   never claim features that are not implemented

------------------------------------------------------------------------

# 30. PEER EVALUATION REQUIREMENT

Oasis requires substantive comments on demo videos from at least two
other interns.

Do not leave generic comments such as:

> Great work!

A substantive comment should mention something specific about their
implementation, ask a relevant question, or provide a constructive
observation.

This is a completion requirement, not an application feature.

------------------------------------------------------------------------

# 31. DEVELOPMENT WORKFLOW FOR CLAUDE

Claude must work incrementally.

## Phase 0 --- Read and audit

Before coding:

1.  Read this entire MD.
2.  Extract mandatory requirements.
3.  Create an internal requirement matrix.
4.  Inspect the existing workspace.
5.  Do not overwrite unrelated user work.
6.  Ask Zaira if a critical ambiguity blocks implementation.

## Phase 1 --- Project foundation

Implement:

-   repository structure
-   client
-   server
-   environment setup
-   MongoDB connection
-   basic API health check
-   basic frontend routing

Acceptance:

-   frontend starts
-   backend starts
-   database connection works
-   health endpoint works

## Phase 2 --- Authentication

Implement:

-   registration
-   email verification
-   login
-   JWT
-   protected routes
-   forgot password
-   reset password
-   admin authentication

Acceptance:

Run authentication test checklist.

## Phase 3 --- Pizza catalog + builder

Implement:

-   pizza dashboard
-   pizza data
-   base options
-   sauce options
-   cheese
-   vegetables
-   builder state
-   validation
-   order summary

Acceptance:

Full builder test.

## Phase 4 --- Orders

Implement:

-   order API
-   order persistence
-   user order history
-   order detail
-   required statuses

Acceptance:

Create/view/update order through valid flows.

## Phase 5 --- Razorpay

Implement:

-   test-mode Razorpay order creation
-   checkout
-   payment verification
-   confirmed order logic

Acceptance:

Successful and failed payment scenarios.

## Phase 6 --- Inventory

Implement:

-   inventory models
-   inventory dashboard
-   manual updates
-   stock decrement
-   insufficient-stock protection

Acceptance:

Inventory test checklist.

## Phase 7 --- Low-stock scheduler

Implement:

-   configurable thresholds
-   scheduled job
-   email notification
-   duplicate-alert prevention

Acceptance:

Controlled low-stock test.

## Phase 8 --- Real-time order status

Implement:

-   polling or WebSockets
-   admin status update
-   user status refresh

Acceptance:

Show status change without manually refreshing the user page if using
polling/WebSockets.

## Phase 9 --- UI polish

Implement:

-   responsive design
-   loading states
-   error states
-   empty states
-   accessibility basics
-   consistent visual system

Do not use visual polish to hide missing functionality.

## Phase 10 --- Testing + documentation

Complete:

-   test suite/manual test checklist
-   README
-   API documentation
-   screenshots
-   demo checklist
-   requirement matrix

## Phase 11 --- Final audit

Before completion:

-   run build
-   run tests
-   inspect console
-   inspect backend logs
-   verify environment handling
-   verify Git status
-   verify no secrets
-   verify all Oasis requirements
-   verify README
-   verify demo flow

Only then declare the project complete.

------------------------------------------------------------------------

# 32. REQUIREMENT TRACEABILITY MATRIX

Claude must maintain this matrix during development.

  ---------------------------------------------------------------------------------
  ID             Requirement      Implementation      Test           Status
  -------------- ---------------- ------------------- -------------- --------------
  U1             User             Auth module         Auth test      ☐
                 registration +                                      
                 email                                               
                 verification                                        

  U2             JWT login        Auth module         Auth test      ☐

  U3             Forgot password  Auth module         Reset test     ☐

  U4             Pizza dashboard  Pizza module        UI test        ☐

  U5             5 base options   Builder/catalog     Builder test   ☐

  U6             5 sauce options  Builder/catalog     Builder test   ☐

  U7             Cheese selection Builder             Builder test   ☐

  U8             Multiple         Builder             Builder test   ☐
                 vegetables                                          

  U9             Order summary    Order module        Order test     ☐

  U10            Razorpay test    Payment module      Payment test   ☐
                 checkout                                            

  U11            Required order   Order module        Status test    ☐
                 statuses                                            

  U12            Real-time status Polling/WebSocket   Live status    ☐
                                                      test           

  A1             Separate admin   Admin auth          Auth test      ☐
                 login                                               

  A2             Inventory        Inventory module    Inventory test ☐
                 dashboard                                           

  A3             Automatic stock  Inventory/order     Inventory test ☐
                 decrement        service                            

  A4             Manual stock     Admin inventory     Inventory test ☐
                 update                                              

  A5             Configurable     Inventory           Scheduler test ☐
                 low-stock                                           
                 threshold                                           

  A6             Scheduled email  Cron/email service  Alert test     ☐
                 notification                                        

  A7             Admin order      Admin orders        Admin test     ☐
                 management                                          
  ---------------------------------------------------------------------------------

------------------------------------------------------------------------

# 33. DEFINITION OF DONE

The project is **NOT DONE** if any mandatory item remains unchecked.

Done means:

-   [ ] Application runs locally
-   [ ] Frontend builds successfully
-   [ ] Backend runs successfully
-   [ ] MongoDB works
-   [ ] User registration works
-   [ ] Email verification works
-   [ ] JWT login works
-   [ ] Forgot password works
-   [ ] Pizza dashboard works
-   [ ] Pizza builder works
-   [ ] 5 base options exist
-   [ ] 5 sauce options exist
-   [ ] Cheese selection exists
-   [ ] Multiple vegetable selection exists
-   [ ] Order summary works
-   [ ] Razorpay test payment works
-   [ ] Payment verification works
-   [ ] Order confirmation works
-   [ ] Required order statuses work
-   [ ] Admin login is separate
-   [ ] Inventory dashboard works
-   [ ] Manual stock update works
-   [ ] Automatic stock decrement works
-   [ ] Low-stock threshold works
-   [ ] Scheduled email alert works
-   [ ] Admin order management works
-   [ ] Real-time/polling status update works
-   [ ] User/admin authorization is enforced server-side
-   [ ] Responsive UI works
-   [ ] Error/loading/empty states exist
-   [ ] README is complete
-   [ ] Screenshots are captured
-   [ ] Demo checklist passes
-   [ ] No secrets are committed
-   [ ] Git repository structure matches OIBSIP requirements

------------------------------------------------------------------------

# 34. GIT WORKFLOW

Use meaningful commits.

Suggested commit sequence:

``` text
chore: initialize OIBSIP Level 3 pizza project
feat: add full-stack project foundation
feat: implement user authentication
feat: implement email verification
feat: implement password reset
feat: add pizza catalog and builder
feat: implement order workflow
feat: integrate Razorpay test payments
feat: implement inventory management
feat: add low-stock scheduled notifications
feat: implement admin order management
feat: implement real-time order tracking
feat: polish responsive UI
test: complete acceptance testing
docs: finalize README and submission documentation
```

Do not create meaningless commits such as:

``` text
changes
update
fix stuff
final
final-final
```

------------------------------------------------------------------------

# 35. CLAUDE BEHAVIOR RULES

Claude must follow these rules throughout the project.

### Rule 1 --- Source of truth

This MD is the primary project specification.

### Rule 2 --- No hallucination

If Claude does not know:

-   ask
-   inspect the code
-   inspect configuration
-   inspect documentation

Do not invent.

### Rule 3 --- No silent scope changes

If a feature requires a significant architectural decision not specified
here, explain the decision before implementing it.

### Rule 4 --- Keep working software

Do not leave the repository in a permanently broken state after a
module.

### Rule 5 --- Verify before claiming

Never say:

> Done

unless the implementation has been checked.

### Rule 6 --- Security

Never expose or commit secrets.

### Rule 7 --- Requirements first

Do not spend excessive time on animations or cosmetic details while
mandatory features remain incomplete.

### Rule 8 --- Reuse

Prefer reusable components, services, validators, middleware, and
utilities.

### Rule 9 --- Documentation

Update documentation when architecture or setup changes.

### Rule 10 --- Ask when blocked

If a decision could materially affect:

-   architecture
-   database design
-   authentication
-   payment
-   security
-   Oasis compliance

ask Zaira before proceeding if the correct answer cannot be determined
from this specification.

------------------------------------------------------------------------

# 36. FIRST PROMPT TO GIVE CLAUDE

Paste this after placing this file in the project:

``` text
Read the complete OIBSIP Web Development & Designing Level 3 master specification before doing anything.

This MD is the single source of truth for the Pizza Delivery Full-Stack Application.

Do not start by blindly writing code.

First:
1. Read the entire specification.
2. Inspect the current workspace.
3. Identify the current project state.
4. Create a requirement traceability matrix from the specification.
5. Separate mandatory Oasis requirements from optional implementation choices.
6. Propose the implementation phases and architecture.
7. Check for anything that is genuinely ambiguous or requires my decision.
8. Do not hallucinate missing requirements.

After the audit, show me:
- current workspace state
- proposed architecture
- database models
- API structure
- implementation phases
- mandatory Oasis checklist
- any questions/blockers

Then wait for my approval before making major architectural changes.

Throughout development:
- keep the app runnable
- test each completed module
- update the requirement matrix
- do not claim a feature is complete until verified
- never commit secrets
- follow the exact OIBSIP repository/folder requirements
- ask me when a consequential decision is unclear
```

------------------------------------------------------------------------

# 37. FINAL OASIS SUBMISSION CHECKLIST

## Repository

-   [ ] GitHub repository is named `OIBSIP`
-   [ ] Repository is public
-   [ ] Correct task folder exists
-   [ ] Source code is present
-   [ ] README.md is present
-   [ ] Screenshots/output files are present

## Application

-   [ ] User flow works end-to-end
-   [ ] Admin flow works end-to-end
-   [ ] Payment test flow works
-   [ ] Inventory works
-   [ ] Low-stock notification works
-   [ ] Real-time order tracking works

## Video

-   [ ] Screen recording
-   [ ] First 2 seconds contain full name
-   [ ] First 2 seconds contain assigned track
-   [ ] First 2 seconds contain task title
-   [ ] End-to-end functionality demonstrated

## LinkedIn

-   [ ] Demo video uploaded/linked
-   [ ] Oasis Infobyte tagged
-   [ ] `#oasisinfobyte`
-   [ ] Relevant domain hashtag

## Peer evaluation

-   [ ] Substantive comment on intern #1
-   [ ] Substantive comment on intern #2

## Final quality

-   [ ] No obvious console errors
-   [ ] No exposed credentials
-   [ ] No broken routes
-   [ ] No fake/unfinished buttons
-   [ ] Responsive
-   [ ] README accurate
-   [ ] Requirement matrix fully checked

------------------------------------------------------------------------

# 38. IMPORTANT SCOPE BOUNDARY

The Oasis task specifically requires the functionality documented above.

Do **not** automatically add:

-   delivery-driver application
-   maps/GPS tracking
-   coupons
-   loyalty points
-   reviews
-   chat
-   AI recommendations
-   social login
-   multi-restaurant marketplace
-   advanced analytics
-   production payment settlement
-   mobile applications
-   microservices
-   Kubernetes
-   unnecessary cloud infrastructure

These may be future enhancements, but they are not required for this
internship task.

The goal is a **complete, reliable, polished Level 3 submission**, not
an unnecessarily oversized product.

------------------------------------------------------------------------

# 39. FINAL PRINCIPLE

Build the smallest architecture that can convincingly demonstrate every
required Oasis Level 3 capability:

``` text
React
  ↓
Express API
  ↓
MongoDB

Authentication
      +
Pizza Builder
      +
Orders
      +
Razorpay Test Payment
      +
Inventory
      +
Scheduled Low-Stock Email
      +
Admin Order Management
      +
Real-Time/Polling Order Tracking
```

Every mandatory requirement must be implemented, tested, documented, and
demonstrated.

**Do not optimize for number of features. Optimize for complete,
working, explainable implementation.**
