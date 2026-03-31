from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from pathlib import Path

app = FastAPI(title="TOP-PROPHETS API - PROTOTYPE")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://top-prophets-panel.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LEADERBOARD_FILE = Path(__file__).parent.parent / "data" / "leaderboard.json"

def load_leaderboard():
    if not LEADERBOARD_FILE.exists():
        return {}
    try:
        return json.loads(LEADERBOARD_FILE.read_text(encoding="utf-8"))
    except:
        return {}

def save_leaderboard(data):
    LEADERBOARD_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def get_user_score_data(name, board):
    if name not in board:
        board[name] = {"score": 0, "guessed": []}
    return board[name]

class PredictRequest(BaseModel):
    matchId: str
    eventType: str
    predictedMinute: int
    username: str

def load_matches():
    data_path = Path(__file__).parent.parent / "data" / "demo_matches.json"
    if not data_path.exists():
        return []
    try:
        return json.loads(data_path.read_text(encoding="utf-8"))
    except:
        return []

@app.get("/api/matches")
async def get_matches():
    raw_matches = load_matches()
    # Map snake_case to camelCase for frontend
    formatted = []
    for m in raw_matches:
        fm = dict(m)
        if "stream_url" in fm:
            fm["streamUrl"] = fm.pop("stream_url")
        if "startTimeUnix" not in fm:
            fm["startTimeUnix"] = 1711891200
        formatted.append(fm)
    return {"matches": formatted}

@app.post("/api/predict")
async def make_prediction(req: PredictRequest):
    matches = load_matches()
    match = next((m for m in matches if m["id"] == req.matchId), None)
    
    if not match:
        return {"success": False, "message": "Match not found", "score": 0}
        
    validation_passed = False
    event_id = f"{req.matchId}_{req.predictedMinute}_{req.eventType.lower()}"
    
    # Validation logic (Exact match for minute and type)
    for event in match.get("timeline", []):
        if event.get("type", "").lower() == req.eventType.lower():
            if event.get("minute") == req.predictedMinute:
                validation_passed = True
                break
                
    board = load_leaderboard()
    user = req.username.strip() or "guest"
    user_data = get_user_score_data(user, board)

    if validation_passed:
        print(f"Validation successful for {user}. Event: {event_id}. Current guessed: {user_data.get('guessed', [])}")
        if event_id in user_data.get("guessed", []):
            print(f"Duplicate prevented for {user}: {event_id}")
            return {
                "success": False, # Treat as false so they know they didn't get points
                "message": "Ты уже получал очки за это событие!",
                "score": user_data.get("score", 0)
            }
        
        user_data["score"] = user_data.get("score", 0) + 5
        if "guessed" not in user_data:
            user_data["guessed"] = []
        user_data["guessed"].append(event_id)
        board[user] = user_data
        
        print(f"Assigning +5 to {user}. New score: {user_data['score']}")
        save_leaderboard(board)
        
        return {
            "success": True,
            "message": "Угадал!",
            "score": user_data["score"]
        }
    else:
        print(f"Validation failed for {user} on event {req.eventType} at {req.predictedMinute}")
        return {
            "success": False,
            "message": "Мимо!",
            "score": user_data.get("score", 0)
        }

@app.get("/api/leaderboard")
async def get_leaderboard():
    board = load_leaderboard()
    entries = []
    for user, data in board.items():
        if user == "guest":
            continue
        entries.append({
            "id": f"u_{user}",
            "username": user,
            "score": data.get("score", 0)
        })
    # Sort by score descending
    entries.sort(key=lambda x: x["score"], reverse=True)
    return {"entries": entries[:10]}
