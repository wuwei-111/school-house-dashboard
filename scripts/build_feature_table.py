import json
from pathlib import Path

import numpy as np
import pandas as pd
from geopy.distance import geodesic


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "db.json"
OUT_CSV = ROOT / "artifacts" / "feature_wide_table.csv"


DISTRICT_CENTER = {
    "武昌区": (30.5460, 114.3162),
    "江汉区": (30.6052, 114.2706),
    "洪山区": (30.5062, 114.3858),
    "硚口区": (30.5836, 114.2146),
    "青山区": (30.6406, 114.3979),
    "江岸区": (30.6172, 114.3030),
}


def _attach_coords(row: pd.Series) -> pd.Series:
    base_lat, base_lon = DISTRICT_CENTER.get(row["district"], (30.58, 114.30))
    # 用社区 id 做稳定扰动，避免硬编码随机数。
    offset = (int(row["id"]) % 7) * 0.003
    row["lat"] = base_lat + offset
    row["lon"] = base_lon - offset
    return row


def _nearest_distance_km(origin: tuple[float, float], points: list[tuple[float, float]]) -> float:
    return min(geodesic(origin, p).km for p in points)


def load_data() -> pd.DataFrame:
    with DB_PATH.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    df = pd.DataFrame(payload["communities"]).copy()
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    # 1) 去重：同名同区算重复
    df = df.drop_duplicates(subset=["name", "district"], keep="first").copy()
    # 2) 缺失值：按同小区名称均值填充，再回退全局中位数
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        df[col] = df.groupby("name")[col].transform(lambda s: s.fillna(s.mean()))
        df[col] = df[col].fillna(df[col].median())
    # 3) 异常值剔除：IQR
    for col in ["price", "premium", "distance", "subway"]:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        df = df[(df[col] >= lower) & (df[col] <= upper)]
    return df.reset_index(drop=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.apply(_attach_coords, axis=1)

    # 重点学校坐标（按学校名聚合）
    key_schools = (
        df[df["schoolLevel"] == "重点"][["school", "lat", "lon"]]
        .drop_duplicates(subset=["school"])
        .copy()
    )
    school_points = list(zip(key_schools["lat"], key_schools["lon"]))

    # 地铁站坐标：以小区点位平移构造演示数据，后续可替换真实站点
    subway_points = [(r.lat + 0.004, r.lon + 0.004) for r in df.itertuples()]
    # 医院坐标：同理构造邻近点
    hospital_points = [(r.lat - 0.005, r.lon + 0.003) for r in df.itertuples()]

    df["distance_to_key_school_km"] = df.apply(
        lambda r: _nearest_distance_km((r["lat"], r["lon"]), school_points), axis=1
    )
    df["distance_to_subway_km"] = df.apply(
        lambda r: _nearest_distance_km((r["lat"], r["lon"]), subway_points), axis=1
    )

    def hospital_count_1km(row: pd.Series) -> int:
        origin = (row["lat"], row["lon"])
        return int(sum(1 for h in hospital_points if geodesic(origin, h).km <= 1.0))

    df["hospital_count_within_1km"] = df.apply(hospital_count_1km, axis=1)
    df["is_school_house"] = (df["schoolLevel"] == "重点").astype(int)
    # 当前无房龄字段，先用稳定规则生成，后续可替换真实值
    df["house_age"] = (2026 - (2000 + (df["id"] % 20))).astype(int)

    wide_df = df[
        [
            "id",
            "name",
            "district",
            "price",
            "house_age",
            "distance_to_key_school_km",
            "distance_to_subway_km",
            "hospital_count_within_1km",
            "is_school_house",
            "schoolLevel",
            "premium",
        ]
    ].rename(columns={"id": "community_id", "price": "avg_price"})
    return wide_df


def main() -> None:
    df = load_data()
    df = clean_data(df)
    wide_df = build_features(df)
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    wide_df.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"Saved: {OUT_CSV}")


if __name__ == "__main__":
    main()
