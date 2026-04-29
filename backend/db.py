import json
import sqlite3
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "backend.sqlite"
DBJSON_PATH = ROOT / "db.json"
ARTIFACTS_DIR = ROOT / "artifacts"


def get_conn() -> sqlite3.Connection:
    # 每个请求一个连接，避免跨线程问题；sqlite3 默认不开并发控制
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return cur.fetchone() is not None


def init_db(load_json: bool = True) -> None:
    conn = get_conn()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS districts (
              id INTEGER PRIMARY KEY,
              name TEXT UNIQUE,
              avgPrice REAL,
              premium REAL,
              education REAL,
              traffic REAL,
              medical REAL,
              commerce REAL,
              environment REAL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS communities (
              id INTEGER PRIMARY KEY,
              name TEXT UNIQUE,
              district TEXT,
              price REAL,
              premium REAL,
              school TEXT,
              schoolLevel TEXT,
              distance REAL,
              subway REAL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS priceTrend (
              id INTEGER PRIMARY KEY,
              year TEXT,
              school REAL,
              nonSchool REAL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS featureImportance (
              id INTEGER PRIMARY KEY,
              feature TEXT,
              importance REAL,
              color TEXT
            )
            """
        )
        conn.commit()

        if load_json:
            load_dbjson_to_sqlite(conn)
    finally:
        conn.close()


def _read_dbjson() -> dict[str, Any]:
    if not DBJSON_PATH.exists():
        return {}
    return json.loads(DBJSON_PATH.read_text(encoding="utf-8"))


def load_dbjson_to_sqlite(conn: sqlite3.Connection) -> None:
    payload = _read_dbjson()
    districts = payload.get("districts", []) or []
    communities = payload.get("communities", []) or []
    price_trend = payload.get("priceTrend", []) or []
    feature_importance = payload.get("featureImportance", []) or []

    # districts
    for d in districts:
        conn.execute(
            """
            INSERT OR REPLACE INTO districts
            (id, name, avgPrice, premium, education, traffic, medical, commerce, environment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                d.get("id"),
                d.get("name"),
                d.get("avgPrice"),
                d.get("premium"),
                d.get("education"),
                d.get("traffic"),
                d.get("medical"),
                d.get("commerce"),
                d.get("environment"),
            ),
        )

    # communities
    for c in communities:
        conn.execute(
            """
            INSERT OR REPLACE INTO communities
            (id, name, district, price, premium, school, schoolLevel, distance, subway)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                c.get("id"),
                c.get("name"),
                c.get("district"),
                c.get("price"),
                c.get("premium"),
                c.get("school"),
                c.get("schoolLevel"),
                c.get("distance"),
                c.get("subway"),
            ),
        )

    # priceTrend
    for r in price_trend:
        conn.execute(
            """
            INSERT OR REPLACE INTO priceTrend
            (id, year, school, nonSchool)
            VALUES (?, ?, ?, ?)
            """,
            (
                r.get("id"),
                r.get("year"),
                r.get("school"),
                r.get("nonSchool"),
            ),
        )

    # featureImportance
    for f in feature_importance:
        conn.execute(
            """
            INSERT OR REPLACE INTO featureImportance
            (id, feature, importance, color)
            VALUES (?, ?, ?, ?)
            """,
            (
                f.get("id"),
                f.get("feature"),
                f.get("importance"),
                f.get("color"),
            ),
        )

    conn.commit()


def fetch_all(table: str) -> list[dict[str, Any]]:
    conn = get_conn()
    try:
        cur = conn.execute(f"SELECT * FROM {table} ORDER BY id")
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def read_model_metrics() -> dict[str, Any] | None:
    path = ARTIFACTS_DIR / "model_metrics.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

