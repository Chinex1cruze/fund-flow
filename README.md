# FundFlow

FundFlow is a simple investment platform frontend backed by a lightweight Express server.

## Features
- Mobile-first fintech UI with dark theme and blue primary branding from the site logo
- Registration / login with cookie-based sessions
- Wallet balance, welcome bonus, and VIP investment plans
- Deposit and withdrawal endpoints
- Active VIP plan support with server-managed 24-hour countdown payout logic
- Data persisted in a local JSON database at `data/store.json`

## Run locally
1. Install Node.js
2. In the project root:
   ```bash
   npm install
   npm start
   ```
3. Open `http://localhost:3000`

## Backend
- Server entry: `server.js`
- Data store: `data/store.json`
- API routes under `/api`
- Uses `express`, `cookie-parser`, `cors`, `helmet`, `express-rate-limit`, `bcryptjs`, and `jsonwebtoken`

## Frontend
- HTML pages: `index.html`, `register.html`, `login.html`, `dashboard.html`, `vip.html`, `deposit.html`, `withdraw.html`, `referral.html`, `profile.html`
- JS files in `js/`
- Styles in `css/`
- Reusable components in `components/`

## Notes
- The site is ready for a real backend and uses API integration by default (`USE_API = true` in `js/utils.js`).
- Data is persisted locally in `data/store.json` and should be replaced by a real database for production.

## Launch checklist (testing mode)
Before launching this evening in testing mode, complete these steps:

1. Use the example env file
   - Copy `.env.example` to `.env` and set any overrides you need (you can keep PAYMENT_MODE=testing for now).
   - Set strong values for `JWT_SECRET` and `ADMIN_TOKEN` before public launch. Do NOT commit `.env` to source control.

2. Start the server in the project root
   - npm install
   - node server.js
   - Or set env vars inline on Windows PowerShell:
     $env:ADMIN_TOKEN='your-token'; $env:JWT_SECRET='your-secret'; node server.js

3. Testing mode behavior (safe defaults)
   - PAYMENT_MODE=testing uses a mock account verification flow (no external provider calls).
   - Deposits submitted by users will be stored as pending and must be approved by an admin (use the admin endpoints).
   - Withdrawals require account verification (mock in testing mode) and are created as pending; admin must approve to deduct funds.

4. Admin API access (for quick launch)
   - Use the admin token in the request header `x-admin-token` or `?adminToken=...` when calling admin endpoints.
   - Default admin token (if no ADMIN_TOKEN env var is set) is `fundflow-admin-token`. Change this before any public launch.

5. Minimal security notes
   - The current demo uses a JSON file (`data/store.json`) for persistence and a simple admin token. For public production use, plan to migrate to a proper database (SQLite/Postgres), HTTPS, and robust admin authentication.

## How to switch to production later
- Set PAYMENT_MODE=production in your environment and configure the licensed payment provider credentials using `PAYMENT_PROVIDER_API_URL` and `PAYMENT_PROVIDER_API_KEY` in your environment.
- Implement provider-specific account verification in `server.js` where the code currently returns 501 for production placeholder.
- Migrate screenshots/outbound files to an object store or filesystem rather than embedding in the JSON store.

If you'd like, I can:
- Add a small admin UI for approving deposits/withdrawals and editing payment settings.
- Migrate the JSON store to SQLite and add simple migrations.
- Integrate a specific payment provider if you provide provider docs/credentials.
