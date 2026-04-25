# school-house-dashboard

学区房可视化看板（Vite + React + Recharts）。数据来源为 `db.json`（通过 `json-server` 提供接口），并提供 Python 脚本完成“特征宽表/特征重要性/学区溢价”的离线计算与回写。

## 开发启动

```powershell
npm install
npm run dev
```

## Mock 数据接口

```powershell
json-server --watch db.json --port 3001
```

前端默认读取：`http://localhost:3001`

## 数据处理与建模（生成/回写 featureImportance）

依赖安装：

```powershell
python -m pip install -r scripts/requirements.txt
```

依次运行（会产出 `artifacts/*` 并把 `featureImportance` 写回 `db.json`）：

```powershell
python scripts/build_feature_table.py
python scripts/train_model.py
python scripts/update_db_feature_importance.py
```
