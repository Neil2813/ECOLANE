# EcoLens Backend

FastAPI backend scaffold for EcoLens.

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

## Notes
- Uses PostgreSQL + PostGIS in production.
- Includes demo-safe fallbacks for graph/data heavy paths.
- Create the database tables on startup via SQLAlchemy `create_all`.
