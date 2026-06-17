"""Cola local SQLite para operaciones pendientes de enviar a Supabase."""
import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_attempt_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
"""


class QueueDB:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init()

    def _init(self):
        with self._conn() as conn:
            conn.executescript(SCHEMA)

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def enqueue(self, operation_type: str, payload: dict, idempotency_key: str | None = None) -> int | None:
        try:
            with self._conn() as conn:
                cur = conn.execute(
                    "INSERT OR IGNORE INTO queue (operation_type, payload, idempotency_key) VALUES (?, ?, ?)",
                    (operation_type, json.dumps(payload), idempotency_key),
                )
                return cur.lastrowid
        except sqlite3.Error as e:
            logger.error("Error encolando operación %s: %s", operation_type, e)
            return None

    def get_pending(self, limit: int = 50) -> list[sqlite3.Row]:
        with self._conn() as conn:
            return conn.execute(
                "SELECT * FROM queue WHERE status = 'pending' ORDER BY id ASC LIMIT ?",
                (limit,),
            ).fetchall()

    def mark_synced(self, row_id: int):
        with self._conn() as conn:
            conn.execute(
                "UPDATE queue SET status = 'synced', last_attempt_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), row_id),
            )

    def mark_failed(self, row_id: int):
        with self._conn() as conn:
            conn.execute(
                "UPDATE queue SET status = 'failed', attempts = attempts + 1, last_attempt_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), row_id),
            )

    def increment_attempt(self, row_id: int):
        with self._conn() as conn:
            conn.execute(
                "UPDATE queue SET attempts = attempts + 1, last_attempt_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), row_id),
            )

    def reset_failed_to_pending(self):
        """Reencola fallos al reiniciar el agente."""
        with self._conn() as conn:
            conn.execute("UPDATE queue SET status = 'pending' WHERE status = 'failed' AND attempts < 5")

    def pending_count(self) -> int:
        with self._conn() as conn:
            row = conn.execute("SELECT COUNT(*) FROM queue WHERE status = 'pending'").fetchone()
            return row[0]
