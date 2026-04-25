import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split


ROOT = Path(__file__).resolve().parents[1]
WIDE_TABLE_PATH = ROOT / "artifacts" / "feature_wide_table.csv"
MODEL_METRICS_PATH = ROOT / "artifacts" / "model_metrics.json"
FEATURE_IMPORTANCE_PATH = ROOT / "artifacts" / "feature_importance.json"
PREMIUM_REPORT_PATH = ROOT / "artifacts" / "premium_report.json"


def load_features() -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(WIDE_TABLE_PATH)
    y = df["avg_price"]
    X = df.drop(columns=["avg_price", "name", "community_id", "premium"])
    X = pd.get_dummies(X, columns=["district", "schoolLevel"], drop_first=False)
    return X, y


def train_and_select(X: pd.DataFrame, y: pd.Series):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42
    )

    lr = LinearRegression()
    rf = RandomForestRegressor(n_estimators=300, random_state=42)

    lr.fit(X_train, y_train)
    rf.fit(X_train, y_train)

    lr_pred = lr.predict(X_test)
    rf_pred = rf.predict(X_test)

    metrics = {
        "linear_regression": {
            "r2": float(r2_score(y_test, lr_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, lr_pred))),
        },
        "random_forest": {
            "r2": float(r2_score(y_test, rf_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, rf_pred))),
        },
    }
    best_name = "random_forest" if metrics["random_forest"]["r2"] >= metrics["linear_regression"]["r2"] else "linear_regression"
    best_model = rf if best_name == "random_forest" else lr
    return best_model, best_name, metrics, X


def build_feature_importance(model_name: str, model, X: pd.DataFrame) -> list[dict]:
    if model_name == "random_forest":
        raw_scores = model.feature_importances_
    else:
        raw_scores = np.abs(model.coef_)

    series = pd.Series(raw_scores, index=X.columns)
    # 将 one-hot 拆分特征聚合成可解释维度
    grouped = {
        "行政区位": [c for c in series.index if c.startswith("district_")],
        "学区等级": [c for c in series.index if c.startswith("schoolLevel_")],
    }
    for group_name, cols in grouped.items():
        if cols:
            series[group_name] = series[cols].sum()
            series = series.drop(index=cols)
    series = series.sort_values(ascending=False)
    series = series / series.sum()

    rename_map = {
        "distance_to_key_school_km": "学校距离",
        "distance_to_subway_km": "地铁距离",
        "house_age": "建筑年代",
        "hospital_count_within_1km": "医疗资源",
        "is_school_house": "是否学区房",
    }
    colors = ["#2563eb", "#0891b2", "#7c3aed", "#16a34a", "#f59e0b", "#db2777"]

    out = []
    for i, (k, v) in enumerate(series.head(6).items(), start=1):
        out.append(
            {
                "id": i,
                "feature": rename_map.get(k, k),
                "importance": round(float(v), 4),
                "color": colors[(i - 1) % len(colors)],
            }
        )
    return out


def estimate_school_premium(model, X: pd.DataFrame) -> dict:
    on = X.copy()
    off = X.copy()
    if "is_school_house" in on.columns:
        on["is_school_house"] = 1
        off["is_school_house"] = 0

    pred_on = model.predict(on)
    pred_off = model.predict(off)
    diff = pred_on - pred_off
    base = np.where(pred_off == 0, 1, pred_off)

    return {
        "avg_premium_yuan": round(float(np.mean(diff)), 2),
        "avg_premium_wan": round(float(np.mean(diff) / 10000), 2),
        "avg_premium_pct": round(float(np.mean(diff / base) * 100), 2),
    }


def main() -> None:
    X, y = load_features()
    model, model_name, metrics, X_all = train_and_select(X, y)
    feature_importance = build_feature_importance(model_name, model, X_all)
    premium_report = estimate_school_premium(model, X_all)

    MODEL_METRICS_PATH.write_text(
        json.dumps({"best_model": model_name, "metrics": metrics}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    FEATURE_IMPORTANCE_PATH.write_text(
        json.dumps(feature_importance, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    PREMIUM_REPORT_PATH.write_text(
        json.dumps(premium_report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Saved: {MODEL_METRICS_PATH}")
    print(f"Saved: {FEATURE_IMPORTANCE_PATH}")
    print(f"Saved: {PREMIUM_REPORT_PATH}")


if __name__ == "__main__":
    main()
