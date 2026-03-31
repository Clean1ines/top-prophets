import json
import os
import psycopg2
import psycopg2.extras
from typing import List, Optional, Dict

class Repository:
    def __init__(self, db_url: str):
        self.db_url = db_url
        if self.db_url and self.db_url.startswith("postgres://"):
            self.db_url = self.db_url.replace("postgres://", "postgresql://", 1)

    def _connect(self):
        conn = psycopg2.connect(self.db_url)
        psycopg2.extras.register_json(conn)
        return conn

    def init_db(self, migration_path: str):
        """Run initial migration if needed."""
        try:
            conn = self._connect()
            cur = conn.cursor()
            with open(migration_path, "r", encoding="utf-8") as f:
                cur.execute(f.read())
            conn.commit()
            cur.close()
            conn.close()
            print("[REPO] Migration applied successfully")
        except Exception as e:
            print(f"[REPO] Migration error: {e}")

    # --- Match Data ---
    
    def get_matches(self) -> List[Dict]:
        try:
            conn = self._connect()
            cur = conn.cursor()
            cur.execute("SELECT id, title, type, stream_url, start_time_unix, timeline FROM matches")
            rows = cur.fetchall()
            cur.close()
            conn.close()
            return [{
                "id": r[0],
                "title": r[1],
                "type": "youtube",
                "sport": r[2],
                "category": r[2],
                "streamUrl": r[3],
                "startTimeUnix": r[4],
                "timeline": r[5] or []
            } for r in rows]
        except Exception as e:
            print(f"[REPO] get_matches error: {e}")
            return []

    def get_match(self, match_id: str) -> Optional[Dict]:
        try:
            conn = self._connect()
            cur = conn.cursor()
            cur.execute("SELECT id, title, type, stream_url, start_time_unix, timeline FROM matches WHERE id = %s", (match_id,))
            r = cur.fetchone()
            cur.close()
            conn.close()
            if r:
                return {
                    "id": r[0],
                    "title": r[1],
                    "type": "youtube",
                    "sport": r[2],
                    "category": r[2],
                    "streamUrl": r[3],
                    "startTimeUnix": r[4],
                    "timeline": r[5] or []
                }
            return None
        except Exception as e:
            print(f"[REPO] get_match error: {e}")
            return None

    # --- User Data ---

    def get_user(self, username: str) -> Dict:
        try:
            conn = self._connect()
            cur = conn.cursor()
            cur.execute("SELECT score, guessed FROM leaderboard WHERE username = %s", (username,))
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row:
                return {"score": row[0], "guessed": row[1] or []}
            return {"score": 0, "guessed": []}
        except Exception as e:
            print(f"[REPO] get_user error: {e}")
            return {"score": 0, "guessed": []}

    def save_user(self, username: str, score: int, guessed: List):
        try:
            conn = self._connect()
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO leaderboard (username, score, guessed)
                VALUES (%s, %s, %s)
                ON CONFLICT (username) DO UPDATE
                    SET score   = EXCLUDED.score,
                        guessed = EXCLUDED.guessed
                """,
                (username, score, json.dumps(guessed))
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"[REPO] save_user error: {e}")

    # --- Leaderboard ---

    def get_leaderboard(self, limit: int = 20) -> List[Dict]:
        try:
            conn = self._connect()
            cur = conn.cursor()
            cur.execute("SELECT username, score FROM leaderboard ORDER BY score DESC LIMIT %s", (limit,))
            rows = cur.fetchall()
            cur.close()
            conn.close()
            return [{"username": r[0], "score": r[1]} for r in rows]
        except Exception as e:
            print(f"[REPO] get_leaderboard error: {e}")
            return []
