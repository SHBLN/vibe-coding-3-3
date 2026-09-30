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
