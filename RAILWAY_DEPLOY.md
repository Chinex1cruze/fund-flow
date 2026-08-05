Railway deployment instructions for FundFlow

This repository can be deployed to Railway (https://railway.app) using the steps below.

Prerequisites
- A Railway account
- Git and a GitHub account (or use Railway's GitHub import)

1) Create a Git repository and push code
- Initialize a repo locally and push to GitHub:
  git init
  git add .
  git commit -m "Prepare app for Railway deployment\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  # create a GitHub repo and push (replace origin URL):
  git remote add origin <your-github-repo-url>
  git branch -M main
  git push -u origin main

2) Create a Railway project
- Go to https://railway.app and create a new project -> Deploy from GitHub
- Connect your GitHub account, select the repository and branch (main)
- Railway will detect a Node app or Dockerfile. If using Dockerfile, choose Docker deploy.

3) Set Environment Variables in Railway
- In the Railway project, go to Settings -> Variables and add:
  ADMIN_TOKEN = Chinex$boy1
  JWT_SECRET = <a strong secret>
  PAYMENT_MODE = production
  PAYSTACK_PUBLIC_KEY = <if needed>
  PAYSTACK_SECRET_KEY = <if needed>
  PORT = 3000

Important: Do NOT commit .env to the repo (it is already in .gitignore). Set secrets in Railway only.

4) Deploy
- Trigger a deploy in Railway. After successful build, Railway will provide a public URL (https://<project>.railway.app)
- Visit:
  - Public user site: https://<project>.railway.app/
  - Admin login: https://<project>.railway.app/admin/login (use ADMIN_TOKEN)

Notes about data persistence
- This app stores data in data/store.json on the filesystem. Railway dynos/filesystem are ephemeral across deployments and restarts.
- For production, replace file-based storage with a proper DB (Postgres, MongoDB) or use Railway plugins for persistent storage.

If you'd like, I can:
- Create a small seed script to create a test admin or user (not committing secrets)
- Provide a GitHub Actions workflow to build and deploy to Railway via CLI (requires Railway API key)
