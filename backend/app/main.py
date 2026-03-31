from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from pathlib import Path
from .db.repository import Repository

# --------------------------------------------------------------------------- #
#  DB Initialization
# --------------------------------------------------------------------------- #

DATABASE_URL = os.getenv("DATABASE_URL")
repo = Repository(DATABASE_URL)

app = FastAPI(title="TOP-PROPHETS API - PROTOTYPE")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------- #
#  Startup
# --------------------------------------------------------------------------- #

@app.on_event("startup")
def on_startup():
    print(f"[STARTUP] Initializing... DATABASE_URL present: {bool(DATABASE_URL)}")
    try:
        if DATABASE_URL:
            migration_path = Path(__file__).parent.parent / "db" / "migrations" / "001_init.sql"
            repo.init_db(str(migration_path))
        else:
            print("[INFO] No DATABASE_URL set. Running in local fallback (not recommended for prod)")
    except Exception as e:
        print(f"[CRITICAL] Startup failed: {e}")

# --------------------------------------------------------------------------- #
#  Routes
# --------------------------------------------------------------------------- #

class PredictRequest(BaseModel):
    matchId: str
    eventType: str
    predictedMinute: int
    username: str

@app.get("/api/matches")
async def get_matches():
    return {"matches": repo.get_matches()}

@app.post("/api/predict")
async def make_prediction(req: PredictRequest):
    match = repo.get_match(req.matchId)

    if not match:
        return {"success": False, "message": "Match not found", "score": 0}

    validation_passed = False
    event_id = f"{req.matchId}_{req.predictedMinute}_{req.eventType.lower()}"

    for event in match.get("timeline", []):
        if event.get("type", "").lower() == req.eventType.lower():
            if event.get("minute") == req.predictedMinute:
                validation_passed = True
                break

    user = req.username.strip() or "guest"
    user_data = repo.get_user(user)

    if validation_passed:
        if event_id in user_data.get("guessed", []):
            return {
                "success": False,
                "message": "Ты уже получал очки за это событие!",
                "score": user_data.get("score", 0),
            }

        user_data["score"] = user_data.get("score", 0) + 5
        user_data["guessed"].append(event_id)

        repo.save_user(user, user_data["score"], user_data["guessed"])
        return {"success": True, "message": "Угадал!", "score": user_data["score"]}
    else:
        return {
            "success": False,
            "message": "Мимо!",
            "score": user_data.get("score", 0),
        }

@app.get("/api/user/{username}")
async def get_user_profile(username: str):
    user_data = repo.get_user(username)
    return {
        "username": username,
        "score": user_data.get("score", 0),
        "guessed": user_data.get("guessed", [])
    }

@app.get("/api/leaderboard")
async def get_leaderboard():
    raw_entries = repo.get_leaderboard(20)
    entries = []
    for r in raw_entries:
        entries.append({
            "id": f"u_{r['username']}",
            "username": r['username'],
            "score": r['score'],
        })
    return {"entries": entries}
