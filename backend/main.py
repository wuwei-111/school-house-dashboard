import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import fetch_all, init_db, read_model_metrics, load_dbjson_to_sqlite, get_conn


ROOT = Path(__file__).resolve().parents[1]

app = FastAPI(title="School House Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db(load_json=True)


@app.get("/districts")
def districts() -> list[dict[str, Any]]:
    return fetch_all("districts")


@app.get("/communities")
def communities() -> list[dict[str, Any]]:
    return fetch_all("communities")


@app.get("/priceTrend")
def price_trend() -> list[dict[str, Any]]:
    return fetch_all("priceTrend")


@app.get("/featureImportance")
def feature_importance() -> list[dict[str, Any]]:
    return fetch_all("featureImportance")


@app.get("/modelMetrics")
def model_metrics() -> dict[str, Any] | None:
    return read_model_metrics()


def _run_feature_pipeline() -> None:
    # 复用你现有脚本：清洗/宽表/建模/回写 db.json
    # 然后再把 db.json 重新落库到 SQLite。
    cmds = [
        [sys.executable, "scripts/build_feature_table.py"],
        [sys.executable, "scripts/train_model.py"],
        [sys.executable, "scripts/update_db_feature_importance.py"],
    ]
    for cmd in cmds:
        subprocess.run(cmd, cwd=str(ROOT), check=True)

    conn = get_conn()
    try:
        load_dbjson_to_sqlite(conn)
    finally:
        conn.close()


@app.post("/refresh")
def refresh_from_json(recompute: bool = False) -> dict[str, Any]:
    """
    recompute=False: 仅把 db.json 重新落库到 SQLite
    recompute=True: 运行 Python 特征工程/建模管线，再落库
    """
    if recompute:
        _run_feature_pipeline()
    else:
        conn = get_conn()
        try:
            load_dbjson_to_sqlite(conn)
        finally:
            conn.close()
    return {"ok": True, "recompute": recompute}


@app.get("/")
def health() -> dict[str, Any]:
    return {"ok": True}

