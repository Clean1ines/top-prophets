# TOP-PROPHETS (Prototype)

Prototype of the game described in the spec, organized in FSD-like layers.

## Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API:
- `GET /api/matches`
- `POST /api/validate`
- `GET /api/leaderboard`

## Frontend (Vite + React)

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

