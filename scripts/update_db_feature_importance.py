import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "db.json"
FEATURE_IMPORTANCE_PATH = ROOT / "artifacts" / "feature_importance.json"


def main() -> None:
    db = json.loads(DB_PATH.read_text(encoding="utf-8"))
    feature_importance = json.loads(FEATURE_IMPORTANCE_PATH.read_text(encoding="utf-8"))
    db["featureImportance"] = feature_importance
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated: {DB_PATH}")


if __name__ == "__main__":
    main()
