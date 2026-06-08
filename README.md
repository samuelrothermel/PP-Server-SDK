# PP-Server-SDK Demo

A plug-and-play PayPal integration reference built on the **[PayPal Server SDK v2.x](https://www.npmjs.com/package/@paypal/paypal-server-sdk)** and **Express.js**. Clone the repo, drop in your Client ID and Secret, and you have a fully functional sandbox environment covering the most common PayPal integration patterns — all in one place.

> **Live demo dashboard:** browse every integration at `http://localhost:8888` after setup.

---

## Quick Start

```bash
git clone https://github.com/samuelrothermel/PP-Server-SDK.git
cd PP-Server-SDK
npm install
```

Rename `.env.example` to `.env` and fill in your credentials:

```env
CLIENT_ID=your_paypal_client_id_here
APP_SECRET=your_paypal_app_secret_here
BASE_URL=http://localhost:8888
PORT=8888
NODE_ENV=development
```

Then start the server:

```bash
npm start          # standard start
npm run dev        # nodemon auto-restart (recommended during development)
```

Open **http://localhost:8888** — the dashboard links to every integration demo.

### HTTPS (required for Google Pay & Apple Pay)

```bash
npm run generate-certs   # generates key.pem + cert.pem
npm run start:https      # starts HTTPS server on the configured port
```

---

## Prerequisites

- **Node.js** ≥ 18 / **npm** ≥ 9
- A [PayPal Developer](https://developer.paypal.com/dashboard/applications) account with a Sandbox app — grab the **Client ID** and **Secret Key** from the app's API credentials page.

---

## Optional Setup

Certain features need a bit more configuration beyond the basic credentials.

### Webhook Testing

Add your webhook details to `.env`:

```env
WEBHOOK_ID=your_webhook_id_here
WEBHOOK_URL=https://your-deployed-app.example.com/api/webhooks
```

Register the following event types in the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/webhooks):

| Event | Used by |
|---|---|
| `PAYMENT.CAPTURE.COMPLETED` | Checkout, Orders |
| `PAYMENT.CAPTURE.DENIED` | Checkout, Orders |
| `VAULT.PAYMENT-TOKEN.CREATED` | Save Without Purchase, MIT |
| `VAULT.PAYMENT-TOKEN.DELETED` | Vault Dashboard |
| `BILLING.SUBSCRIPTION.ACTIVATED` | Subscriptions |
| `BILLING.SUBSCRIPTION.CANCELLED` | Subscription Management |
| `INVOICING.INVOICE.PAID` | Invoicing / CPQ Pay-by-Link |

### Google Pay

Requires HTTPS — run `npm run generate-certs` then `npm run start:https`. Google Pay shows an informational message on plain HTTP.

### Apple Pay

Requires Safari on a Mac or iOS device. Works on HTTP localhost for development. Requires HTTPS and a verified merchant domain for production.

### ACH & Venmo Sandbox

These features require explicit account provisioning by PayPal and cannot be self-enabled through the developer dashboard. Contact your PayPal account team to enable:

- **ACH Direct Debit** — requires `EXPANDED_CHECKOUT` capability on your sandbox merchant ID
- **ACH — Pay with Bank (JS SDK v6)** — same provisioning + `bank-ach-payments` component scope
- **Venmo vaulting** — only available in production; vaulting does not work in PayPal Sandbox

---

## What's Inside

The dashboard is organized into five sections.

### 1. Checkout Integrations

The three most common page patterns — **Product**, **Cart**, and **Checkout** — demonstrated across three SDK approaches. All patterns support returning customers, vault/tokenize on purchase, and authorize vs. capture.

| Sub-group | Routes | Stack |
|---|---|---|
| **JS SDK v5** | `/product` `/cart` `/checkout` | JS SDK v5 + PayPal Server SDK |
| **JS SDK v6** | `/js-sdk-v6/product` `/js-sdk-v6/cart` `/js-sdk-v6/standard` | JS SDK v6 + PayPal Server SDK |
| **API-Only** | `/api-only/checkout` (tabbed: Product / Cart / Checkout) | Direct REST, no JS SDK |

Additional variants: **Wallets Checkout** (`/checkout-wallets`) for Apple Pay & Google Pay only, and **Fastlane** (`/fastlane`) for accelerated guest checkout.

### 2. Merchant Initiated Transactions (MIT)

Off-session charges against previously vaulted payment tokens using `stored_credential` fields (`payment_initiator: MERCHANT`). Three demos covering each integration approach.

| Page | Route |
|---|---|
| MIT — JS SDK v5 | `/mit/v5` |
| MIT — JS SDK v6 | `/mit/v6` |
| MIT — Direct REST API | `/mit/api` |

### 3. Subscriptions & Recurring Payments

| Page | Route | Notes |
|---|---|---|
| Subscriptions | `/subscriptions` | Create plans and subscribe customers |
| Subscription Management | `/subscription-management` | Cancel, pause, update |
| Save Without Purchase | `/save-wo-purchase` | Vault a payment method with no immediate charge |
| Products Management | `/products-management` | Catalog products required for billing plans |

### 4. Tools, Payouts & Admin

| Page | Route |
|---|---|
| Orders Dashboard | `/orders` |
| Vault Dashboard | `/vault` |
| Vault 3D Secure | `/vault-3ds` |
| Payee Test | `/payee-test` |
| Invoicing / CPQ Pay-by-Link | `/invoicing` |
| Webhook Dashboard | `/webhook-testing` |
| Payouts | `/payouts` |
| Transaction Reports | `/transaction-reports` |
| JS SDK v6 — Advanced Configuration | `/js-sdk-v6/advanced` |
| JS SDK v6 — Sandboxed iFrame | `/js-sdk-v6/iframe` |

### 5. In Development & Limited Release

Features that require special provisioning, are sandbox-only, or are in early release.

| Page | Route | Status |
|---|---|---|
| Venmo Sandbox | `/venmo` | Sandbox-only; vaulting production-only |
| ACH Direct Debit | `/ach` | Requires PayPal approval |
| ACH — Pay with Bank (JS SDK v6) | `/ach-sdk` | Requires Expanded Checkout provisioning |
| Pay with Crypto | `/crypto` | Limited release |
| Card Eligibility Testing | `/js-sdk-v6/card-eligibility` | Dev/debug tool |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js / Express 4 |
| Templating | EJS |
| PayPal (server-side) | [@paypal/paypal-server-sdk](https://www.npmjs.com/package/@paypal/paypal-server-sdk) v2.1.0 |
| PayPal (client-side) | JS SDK v5 (`paypal.com/sdk/js`) and JS SDK v6 (`sandbox.paypal.com/web-sdk/v6/core`) |
| Dev tooling | nodemon |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLIENT_ID` | Yes | PayPal app Client ID |
| `APP_SECRET` | Yes | PayPal app Secret Key |
| `BASE_URL` | Yes | Server base URL (e.g. `http://localhost:8888`) |
| `PORT` | Yes | Port to listen on |
| `NODE_ENV` | No | `development` for sandbox, `production` for live |
| `WEBHOOK_ID` | No | PayPal webhook ID (for webhook testing page) |
| `WEBHOOK_URL` | No | Public URL PayPal posts webhook events to |

---

## Project Structure

```
PP-Server-SDK/
├── app.js                        # Express entry point
├── .env.example                  # Environment variable template
├── public/
│   ├── styles/custom.css         # Shared styles and SDK badge system
│   └── *.js                      # Client-side JS for each integration
├── views/                        # EJS page templates (one per route)
└── src/
    ├── config/                   # Constants and error handling
    ├── controllers/              # Page render and API request handlers
    ├── routes/
    │   ├── pages.js              # GET routes for all pages
    │   └── api.js                # POST/GET API endpoints
    └── services/                 # PayPal API wrappers (orders, vault, subscriptions, etc.)
```

---

## Current Status

| Area | Status |
|---|---|
| JS SDK v5 — Product, Cart, Checkout | Stable |
| JS SDK v6 — Product, Cart, Standard Checkout | Stable |
| JS SDK v6 — Advanced / iFrame | Stable |
| API-Only Checkout | In progress |
| Merchant Initiated Transactions (MIT) | In progress |
| Subscriptions & Recurring Payments | Stable |
| Vault & 3D Secure | Stable |
| Payouts | Stable |
| Invoicing / CPQ Pay-by-Link | Stable |
| Webhooks | Stable |
| ACH Direct Debit (API + JS SDK v6) | Limited release — requires provisioning |
| Venmo | Limited release — sandbox only |
| Pay with Crypto | Limited release |
| iOS / Android | Planned |
