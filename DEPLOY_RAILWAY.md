Railway deployment checklist for FundFlow

1. Connect repository
- In Railway, create a new project and choose "Deploy from GitHub". Select the repository Chinex1cruze/fund-flow and the branch main.

2. Build and start
- Railway will detect Node.js because package.json exists.
- Ensure the start command is: npm start (Procfile exists: web: npm start)

3. Environment variables (set in Railway > Variables)
- JWT_SECRET: <strong random secret>
- ADMIN_TOKEN: <strong admin token>
- BASE_URL: https://<your-deployed-domain> (optional but recommended)
- PAYMENT_MODE: testing (or production)
- PAYMENT_BANK_NAME: Sterling Bank
- PAYMENT_ACCOUNT_NUMBER: 0142489003
- PAYMENT_ACCOUNT_NAME: "Chinedu Chima"

Optional provider keys (only if integrating a provider):
- PAYSTACK_PUBLIC_KEY
- PAYSTACK_SECRET_KEY
- PAYMENT_PROVIDER_API_URL
- PAYMENT_PROVIDER_API_KEY

4. Persistent storage
- The app writes runtime data to ./data/store.json. To persist data across deploys, configure Railway Persistent Storage and mount it to the project path ./data (container path: /home/railway/project/data or similar). Ensure the mount path maps to the repo's ./data directory.

5. Logging & health
- Railway will show logs (npm install output and node server.js startup message). Confirm the server starts and logs: "FundFlow backend running on http://localhost:3000"

6. Post-deploy verification
- Register a test user and confirm deposit flow works (generate paymentReference, submit deposit, approve as admin). See README for test steps.

7. Security
- Do NOT commit real secrets to the repo. Use Railway variables and mark them as secrets.

If you’d like, I can also create a small script to seed an initial admin user or back up store.json to a remote location — ask and I will add it.
