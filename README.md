# school-house-dashboard

学区房可视化看板（Vite + React + Recharts）。数据来源为 `db.json`，由 FastAPI 后端加载进 SQLite，并通过与前端同名接口提供数据；Python 脚本完成“特征宽表/特征重要性/学区溢价”的离线计算与回写。

## 快速开始

### 1) 启动前端

```powershell
npm install
npm run dev
```

### 2) 启动后端 API（替代 Mock）

后端会把 `db.json` 落库到 SQLite，并提供：
`/districts`、`/communities`、`/priceTrend`、`/featureImportance`、`/modelMetrics`。

```powershell
py -3.10 -m pip install -r backend/requirements.txt
py -3.10 -m uvicorn backend.main:app --host 0.0.0.0 --port 3001
```

前端默认读取：`http://localhost:3001`

### 3) 生成并回写模型结果（可选，推荐）

依赖安装：

```powershell
py -3.10 -m pip install -r scripts/requirements.txt
```

或者：调用后端重算并刷新 SQLite（推荐）：

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/refresh?recompute=true"
```

---

## 项目详细说明

### 1. 项目目标

- 基于城市房产与教育资源数据，分析学区房溢价结构。
- 输出可视化看板与推荐结果，支持课程汇报展示。
- 支持用 Python 离线建模，将特征重要性回写到前端数据源。

### 2. 技术架构

- **前端展示层**：`React + Recharts`，负责热力图、雷达图、趋势图、散点图、推荐与数据表。
- **数据服务层**：`FastAPI`，将 `db.json` 加载进 SQLite，并提供与前端同名 REST 接口。
- **数据处理层**：`pandas + scikit-learn + geopy`，完成清洗、特征工程、建模与溢价计算。

### 3. 当前功能

- **宏观概览**：区域热力格 + 综合雷达 + 学区/非学区价格趋势。
- **溢价分析**：特征重要性排名、区域溢价对比、学校距离与价格散点关系。
- **智能推荐**：预算/通勤/学区偏好输入，输出 TOP3 匹配房源。
- **实用工具**：
  - 手动刷新数据；
  - 答辩轮播模式（自动切换三大页签）；
  - 样本搜索/筛选/排序；
  - 导出当前筛选结果为 CSV。

### 4. 数据与脚本目录

- `db.json`：前端直接消费的数据源。
- `scripts/build_feature_table.py`：清洗 + 距离特征 + 宽表生成。
- `scripts/train_model.py`：模型训练、评估、溢价测算。
- `scripts/update_db_feature_importance.py`：回写 `featureImportance` 到 `db.json`。
- `artifacts/*`：模型指标与中间产物。

---

## 变更记录

### 2026-04-25

- 新增数据处理与建模脚本链路：宽表构建、模型训练、溢价计算、特征回写。
- 增强前端交互：搜索/筛选/排序、CSV 导出、数据刷新、答辩轮播模式。
- KPI 与分析洞察改为基于实时数据计算，不再硬编码固定值。
- 新增宏观指标：溢价-房价相关系数、居住性价比榜、溢价分布直方图。
- 新增分析能力：模型对比表、控制变量溢价剥离演示器、异常值清洗前后散点对照。
- 新增推荐增强：学区额外花费拆分说明与双小区并排对比模式。

### 2026-04-29

- 新增后端：FastAPI + SQLite，将 `db.json` 落库并提供与前端同名接口。
- 新增刷新接口：`POST /refresh?recompute=false`（仅落库）与 `POST /refresh?recompute=true`（重跑建模并落库）。
