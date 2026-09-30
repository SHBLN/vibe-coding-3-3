# Vibe Coding — Python backend

FastAPI + Postgres. Auth via Supabase JWT.

## Setup

```powershell
cd backend
copy .env.example .env
python -m pip install -r requirements.txt
alembic upgrade head
.\run.ps1
```

API: `http://localhost:8000/api/v1`  
Health: `http://localhost:8000/health`

## Env

See `.env.example`. Point `DATABASE_URL` at Postgres (including Supabase connection string if you reuse that DB).

## GitHub

Standalone repo: [https://github.com/SHBLN/123](https://github.com/SHBLN/123)

From the monorepo root, after changing `backend/`:

```powershell
git add backend/
git commit -m "your message"
git subtree split --prefix=backend -b backend-main
git push backend-123 backend-main:main
```
