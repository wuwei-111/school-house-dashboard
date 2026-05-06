# school-house-dashboard

学区房可视化看板（Vite + React + Recharts）。数据以 `db.json` 为真值，FastAPI 落库 SQLite 后提供与前端一致的 REST 接口；Python 脚本离线完成特征宽表、建模、特征重要性及溢价结果，并可经后端一键刷新回写。

当前版本已贯通：**前端展示 → 后端接口 → 数据与可选重算管线**，本地按下方步骤即可完整运行。

## 快速开始

### 1) 启动前端

```powershell
npm install
npm run dev
```

### 2) 启动后端 API

后端将 `db.json` 同步到 SQLite，并提供：`/districts`、`/communities`、`/priceTrend`、`/featureImportance`、`/modelMetrics`。

```powershell
py -3.10 -m pip install -r backend/requirements.txt
py -3.10 -m uvicorn backend.main:app --host 0.0.0.0 --port 3001
```

前端默认请求：`http://localhost:3001`

### 3) 生成并回写模型结果（可选）

依赖安装：

```powershell
py -3.10 -m pip install -r scripts/requirements.txt
```

或在后端已启动时触发重算并落库：

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/refresh?recompute=true"
```

---

## 项目说明

### 目标

- 基于城市房产与教育资源相关数据，分析学区房溢价结构并可视化。
- 支持离线建模，将特征重要性等结果回写到数据源供看板读取。

### 技术架构

- **前端**：React + Recharts（热力、雷达、趋势、散点、推荐与表格等）。
- **后端**：FastAPI + SQLite，读 `db.json` / `artifacts`，对外提供同名 JSON 接口。
- **数据与建模**：pandas、scikit-learn、geopy；脚本见 `scripts/`。

### 功能概览

- **宏观概览**：区域热力、综合雷达、学区/非学区价格趋势。
- **溢价分析**：特征重要性、区域溢价对比、学校距离与价格散点等。
- **智能推荐**：按预算/通勤/学区偏好给出匹配房源。
- **工具**：数据刷新、**演示用自动轮播**（切换主要页签）、搜索/筛选/排序、导出当前筛选为 CSV。

### 目录与数据流

- `db.json`：业务与展示用主数据文件。
- `scripts/build_feature_table.py`：清洗与宽表。
- `scripts/train_model.py`：训练与指标、溢价摘要写入 `artifacts/`。
- `scripts/update_db_feature_importance.py`：将特征重要性回写 `db.json`。
- `artifacts/*`：模型指标与中间表（`recompute=true` 时会更新）。

---

## 项目分工表

本仓库四人组的**具体职责与负责边界**（字段或接口变更时，由数据负责人发起，其余角色确认后改代码）。

### 分工总览


| 姓名      | 角色      | 负责范围（主要文件/目录）                                                                                                                                | 协作对象                                             |
| ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **林知博** | 数据      | `db.json` 业务数据；字段口径与样本质量；字段说明文档（组内约定存放位置即可）                                                                                                  | 吕恺涛（建模入参列）、巫威（列表/图表所需列）                          |
| **吕恺涛** | 算法 / 建模 | `scripts/build_feature_table.py`、`scripts/train_model.py`、`scripts/update_db_feature_importance.py`、`artifacts/*`、`scripts/requirements.txt` | 林知博（字段含义）、陈宇欣（`/refresh?recompute=true` 调用的脚本顺序） |
| **陈宇欣** | 后端      | `backend/main.py`、`backend/db.py`、`backend/requirements.txt`；README 中与端口、启动方式相关说明                                                            | 吕恺涛（脚本产物路径）、巫威（`API_BASE_URL` 与 3001 端口）         |
| **巫威**  | 前端      | `src/`（含 `App.jsx` 等）、`package.json` 侧依赖与联调配置                                                                                                | 陈宇欣（接口基址与可用性）、林知博（枚举与筛选维度）                       |


### 接口与主责对照


| 方法   | 路径                         | 说明                   | 实现 / 数据主责                           |
| ---- | -------------------------- | -------------------- | ----------------------------------- |
| GET  | `/districts`               | 区维度                  | 陈宇欣；数据结构对齐林知博                       |
| GET  | `/communities`             | 小区列表                 | 陈宇欣；林知博                             |
| GET  | `/priceTrend`              | 价格走势                 | 陈宇欣；林知博                             |
| GET  | `/featureImportance`       | 特征重要性                | 陈宇欣读库；吕恺涛回写 `db.json` 后需 refresh    |
| GET  | `/modelMetrics`            | 模型指标                 | 陈宇欣读 `artifacts/model_metrics.json` |
| POST | `/refresh?recompute=false` | 仅 `db.json` → SQLite | 陈宇欣                                 |
| POST | `/refresh?recompute=true`  | 跑建模脚本链再落库            | 陈宇欣 + 吕恺涛（脚本）                       |


### 协作约定

- **林知博** 维护 `id`、`name` 等主键与业务字段一致性；`featureImportance` 条目由吕恺涛管线生成后回写。
- **吕恺涛** 保证三条脚本在项目根目录可执行，产出与 `train_model.py` 中路径一致。
- **陈宇欣** 保证 `recompute=false` / `recompute=true` 行为与 README 描述一致；组内统一 Python 版本与 API 端口（默认 **3001**）。
- **巫威** 所有请求走可配置的 `**API_BASE_URL`**（默认 `http://localhost:3001`），空数据与请求失败时提示文案与数据/后端对齐。

### 说明

- `**featureImportance` 数值**：吕恺涛生成并写回 `db.json` → 陈宇欣刷新后进库 → 巫威仅展示。
- **全员**：至少应能本地启动前端与后端，便于联调与演示环境一致。

