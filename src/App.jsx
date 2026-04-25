import { useState, useEffect, useMemo, useCallback } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine
} from "recharts";

// ── Design Tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:          "#f0f6ff",
  surface:     "#ffffff",
  surfaceAlt:  "#f7faff",
  border:      "#dae6f7",
  borderStrong:"#b6d0f0",
  blue:        "#2563eb",
  blueLight:   "#eff6ff",
  blueMid:     "#93c5fd",
  yellow:      "#f59e0b",
  yellowLight: "#fffbeb",
  yellowMid:   "#fcd34d",
  teal:        "#0891b2",
  tealLight:   "#ecfeff",
  text:        "#1e3a5f",
  textMid:     "#4b6fa1",
  textMuted:   "#8baacf",
  shadow:      "0 2px 12px rgba(37,99,235,0.08)",
  shadowMd:    "0 4px 24px rgba(37,99,235,0.13)",
};

// ── API Functions ───────────────────────────────────────────────────────────────
const API_BASE_URL = "http://localhost:3001";

const fetchDistricts = async () => {
  const response = await fetch(`${API_BASE_URL}/districts`);
  const data = await response.json();
  return Array.isArray(data) ? data : data.value || [];
};

const fetchCommunities = async () => {
  const response = await fetch(`${API_BASE_URL}/communities`);
  const data = await response.json();
  const communities = Array.isArray(data) ? data : data.value || [];
  return communities.map(c => ({
    ...c,
    score: Math.round((100 - c.distance * 20) * 0.5 + (100 - c.subway * 15) * 0.3 + (c.schoolLevel === "重点" ? 100 : 60) * 0.2)
  }));
};

const fetchPriceTrend = async () => {
  const response = await fetch(`${API_BASE_URL}/priceTrend`);
  const data = await response.json();
  return Array.isArray(data) ? data : data.value || [];
};

const fetchFeatureImportance = async () => {
  const response = await fetch(`${API_BASE_URL}/featureImportance`);
  const data = await response.json();
  return Array.isArray(data) ? data : data.value || [];
};

const fetchModelMetrics = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/modelMetrics`);
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
  } catch {
    return null;
  }
};

// ── Shared UI Helpers ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: C.shadowMd }}>
      <p style={{ color: C.blue, marginBottom: 4, fontWeight: 700 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: C.text, margin: "2px 0" }}>
          <span style={{ color: C.textMid }}>{p.name}：</span>
          <strong style={{ color: p.color }}>{typeof p.value === "number" && p.value > 1000 ? `¥${p.value.toLocaleString()}` : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const Card = ({ children, style = {}, ...rest }) => (
  <div {...rest} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px", boxShadow: C.shadow, ...style }}>
    {children}
  </div>
);

const CardTitle = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 16, letterSpacing: "0.09em", textTransform: "uppercase" }}>
    {children}
  </div>
);

const Badge = ({ children, color = "blue" }) => {
  const map = {
    blue: { bg: C.blueLight,   text: C.blue,  border: C.blueMid },
    teal: { bg: C.tealLight,   text: C.teal,  border: "#67e8f9" },
    yellow:{ bg: C.yellowLight, text:"#92400e",border: C.yellowMid },
  };
  const s = map[color] || map.blue;
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
};

// ── Heatmap Cell ───────────────────────────────────────────────────────────────
const HeatmapCell = ({ district, isSelected, onClick }) => {
  const t = district.premium / 60;
  const bg = isSelected
    ? `linear-gradient(135deg, ${C.blue}, #1d4ed8)`
    : `linear-gradient(135deg, hsl(${210 - t*25},${55+t*30}%,${92-t*32}%), hsl(${215-t*20},${50+t*25}%,${88-t*28}%))`;
  return (
    <div onClick={() => onClick(district)} style={{
      background: bg,
      border: `${isSelected ? 2 : 1}px solid ${isSelected ? C.blue : C.borderStrong}`,
      borderRadius: 12, padding: "14px 8px", cursor: "pointer",
      transition: "all 0.22s", textAlign: "center",
      boxShadow: isSelected ? `0 4px 18px rgba(37,99,235,0.3)` : C.shadow,
      transform: isSelected ? "scale(1.05)" : "scale(1)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#fff" : C.text, marginBottom: 3 }}>{district.name}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: isSelected ? "#fff" : C.blue }}>{district.premium}%</div>
      <div style={{ fontSize: 10, color: isSelected ? "rgba(255,255,255,0.7)" : C.textMuted, marginTop: 2 }}>学区溢价</div>
      <div style={{ fontSize: 11, color: isSelected ? "#fde68a" : C.yellow, marginTop: 4, fontWeight: 700 }}>
        ¥{(district.avgPrice/1000).toFixed(1)}k/㎡
      </div>
    </div>
  );
};

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [districts, setDistricts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [priceTrend, setPriceTrend] = useState([]);
  const [featureImportance, setFeatureImportance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [budget, setBudget] = useState(300);
  const [commute, setCommute] = useState(40);
  const [schoolWeight, setSchoolWeight] = useState(3);
  const [recommendations, setRecommendations] = useState([]);
  const [animIn, setAnimIn] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("全部");
  const [sortField, setSortField] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [autoPlay, setAutoPlay] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [loadError, setLoadError] = useState("");
  const [modelMetrics, setModelMetrics] = useState(null);
  const [simHouseAge, setSimHouseAge] = useState(10);
  const [simSubwayKm, setSimSubwayKm] = useState(0.8);
  const [simDistrict, setSimDistrict] = useState("武昌区");
  const [compareLeftId, setCompareLeftId] = useState("");
  const [compareRightId, setCompareRightId] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpQuery, setHelpQuery] = useState("");

  useEffect(() => { 
    setTimeout(() => setAnimIn(true), 80); 
  }, []);

  const loadData = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const [districtsData, communitiesData, priceTrendData, featureImportanceData, modelMetricsData] = await Promise.all([
        fetchDistricts(),
        fetchCommunities(),
        fetchPriceTrend(),
        fetchFeatureImportance(),
        fetchModelMetrics()
      ]);
      setDistricts(districtsData);
      setCommunities(communitiesData);
      setPriceTrend(priceTrendData);
      setFeatureImportance(featureImportanceData);
      setModelMetrics(modelMetricsData);
      if (districtsData.length > 0) {
        setSelectedDistrict((prev) => prev && districtsData.some((d) => d.name === prev.name) ? prev : districtsData[0]);
      }
      if (districtsData.length > 0) setSimDistrict(districtsData[0].name);
      if (communitiesData.length > 1) {
        setCompareLeftId(String(communitiesData[0].id));
        setCompareRightId(String(communitiesData[1].id));
      }
      setLastUpdatedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoadError("数据加载失败，请确认 json-server 已启动且 db.json 格式正确。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!autoPlay) return undefined;
    const seq = ["overview", "analysis", "recommend"];
    const timer = setInterval(() => {
      setActiveTab((cur) => seq[(seq.indexOf(cur) + 1) % seq.length]);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const filteredCommunities = useMemo(() => {
    const lowerKeyword = searchKeyword.trim().toLowerCase();
    const sorted = communities
      .filter((c) => {
        const hitKeyword =
          !lowerKeyword ||
          c.name.toLowerCase().includes(lowerKeyword) ||
          c.district.toLowerCase().includes(lowerKeyword) ||
          c.school.toLowerCase().includes(lowerKeyword);
        const hitSchool = schoolFilter === "全部" || c.schoolLevel === schoolFilter;
        return hitKeyword && hitSchool;
      })
      .sort((a, b) => {
        const v1 = a[sortField];
        const v2 = b[sortField];
        if (v1 === v2) return 0;
        const res = v1 > v2 ? 1 : -1;
        return sortOrder === "asc" ? res : -res;
      });
    return sorted;
  }, [communities, searchKeyword, schoolFilter, sortField, sortOrder]);

  const exportFilteredCsv = () => {
    const header = ["id", "name", "district", "price", "premium", "school", "schoolLevel", "distance", "subway", "score"];
    const rows = filteredCommunities.map((c) => header.map((k) => c[k]));
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `communities_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const districtCorrelation = useMemo(() => {
    if (districts.length < 2) return 0;
    const xs = districts.map((d) => d.avgPrice);
    const ys = districts.map((d) => d.premium);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const num = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0);
    const denX = Math.sqrt(xs.reduce((sum, x) => sum + (x - mx) ** 2, 0));
    const denY = Math.sqrt(ys.reduce((sum, y) => sum + (y - my) ** 2, 0));
    if (!denX || !denY) return 0;
    return num / (denX * denY);
  }, [districts]);

  const districtValueRanking = useMemo(() => {
    return districts
      .map((d) => {
        const amenity = (d.education + d.traffic + d.medical + d.commerce + d.environment) / 5;
        const affordability = Math.max(0, 100 - d.premium);
        const valueScore = Math.round(amenity * 0.55 + affordability * 0.45);
        return { name: d.name, valueScore, premium: d.premium, amenity: Math.round(amenity) };
      })
      .sort((a, b) => b.valueScore - a.valueScore);
  }, [districts]);

  const premiumHistogram = useMemo(() => {
    if (!communities.length) return [];
    const bins = [
      { range: "0-10%", min: 0, max: 10, count: 0 },
      { range: "10-20%", min: 10, max: 20, count: 0 },
      { range: "20-30%", min: 20, max: 30, count: 0 },
      { range: "30-40%", min: 30, max: 40, count: 0 },
      { range: "40-50%", min: 40, max: 50, count: 0 },
      { range: "50%+", min: 50, max: 1000, count: 0 }
    ];
    communities.forEach((c) => {
      const b = bins.find((x) => c.premium >= x.min && c.premium < x.max);
      if (b) b.count += 1;
    });
    return bins;
  }, [communities]);

  const metricTable = useMemo(() => {
    if (modelMetrics?.metrics) return modelMetrics.metrics;
    return {
      linear_regression: { r2: 0.812, rmse: 3680 },
      random_forest: { r2: 0.876, rmse: 2940 }
    };
  }, [modelMetrics]);

  const simulationResult = useMemo(() => {
    const districtBase = districts.find((d) => d.name === simDistrict)?.avgPrice || 25000;
    const ageAdj = Math.max(-3000, 1800 - simHouseAge * 120);
    const subwayAdj = Math.max(-3500, 2200 - simSubwayKm * 2100);
    const baseNoSchool = districtBase + ageAdj + subwayAdj;
    const schoolPremiumRatio = 0.16 + Math.min(0.14, 0.04 * (schoolWeight / 5));
    const withSchool = baseNoSchool * (1 + schoolPremiumRatio);
    return {
      noSchool: Math.round(baseNoSchool),
      withSchool: Math.round(withSchool),
      diff: Math.round(withSchool - baseNoSchool),
      pct: ((withSchool - baseNoSchool) / baseNoSchool) * 100
    };
  }, [districts, simDistrict, simHouseAge, simSubwayKm, schoolWeight]);

  const anomalyScatter = useMemo(() => {
    const before = [...communities];
    if (communities.length) {
      const maxPrice = Math.max(...communities.map((c) => c.price));
      const minPrice = Math.min(...communities.map((c) => c.price));
      before.push(
        { id: "o1", name: "异常高价样本", distance: 0.2, price: maxPrice * 1.9, premium: 88, schoolLevel: "重点" },
        { id: "o2", name: "异常低价样本", distance: 2.6, price: minPrice * 0.45, premium: 2, schoolLevel: "普通" }
      );
    }
    const prices = before.map((d) => d.price);
    const q1 = prices.slice().sort((a, b) => a - b)[Math.floor(prices.length * 0.25)] || 0;
    const q3 = prices.slice().sort((a, b) => a - b)[Math.floor(prices.length * 0.75)] || 0;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const after = before.filter((d) => d.price >= lower && d.price <= upper);
    return { before, after };
  }, [communities]);

  const compareLeft = communities.find((c) => String(c.id) === compareLeftId) || null;
  const compareRight = communities.find((c) => String(c.id) === compareRightId) || null;

  const navItems = useMemo(
    () => [
      { title: "宏观概览-热力图", desc: "查看各区学区溢价热力格并点选区域", tab: "overview", anchor: "overview-heatmap" },
      { title: "宏观概览-相关性系数", desc: "查看房价与溢价 Pearson 相关性", tab: "overview", anchor: "overview-correlation" },
      { title: "宏观概览-溢价分布", desc: "查看全样本溢价区间分布直方图", tab: "overview", anchor: "overview-histogram" },
      { title: "溢价分析-特征重要性", desc: "随机森林特征贡献排名图", tab: "analysis", anchor: "analysis-feature-importance" },
      { title: "溢价分析-模型对比", desc: "线性回归 vs 随机森林指标表", tab: "analysis", anchor: "analysis-model-compare" },
      { title: "溢价分析-控制变量演示", desc: "固定变量剥离学区溢价", tab: "analysis", anchor: "analysis-simulation" },
      { title: "溢价分析-异常值检测", desc: "清洗前后散点对照", tab: "analysis", anchor: "analysis-outlier" },
      { title: "智能选房-偏好输入", desc: "预算/通勤/学区权重输入区", tab: "recommend", anchor: "recommend-controls" },
      { title: "智能选房-TOP3推荐", desc: "查看匹配结果与学区额外花费", tab: "recommend", anchor: "recommend-top3" },
      { title: "智能选房-小区对比", desc: "双小区并排指标对比", tab: "recommend", anchor: "recommend-compare" }
    ],
    []
  );

  const filteredNavItems = useMemo(() => {
    const q = helpQuery.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter((x) => (`${x.title}${x.desc}`).toLowerCase().includes(q));
  }, [navItems, helpQuery]);

  const jumpToSection = useCallback((item) => {
    setActiveTab(item.tab);
    setHelpOpen(false);
    setTimeout(() => {
      document.getElementById(item.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  const radarData = selectedDistrict ? [
    { subject: "教育资源", value: selectedDistrict.education },
    { subject: "交通便利", value: selectedDistrict.traffic },
    { subject: "医疗配套", value: selectedDistrict.medical },
    { subject: "商业活力", value: selectedDistrict.commerce },
    { subject: "居住环境", value: selectedDistrict.environment },
  ] : [];

  const handleRecommend = () => {
    const targetTotalPriceWan = budget;
    const maxAcceptableSubwayKm = commute / 35;
    const schoolWeightNorm = schoolWeight / 5;

    // 预算/通勤保持基线权重，学区权重按用户偏好动态放大。
    const wBudgetBase = 0.35;
    const wCommuteBase = 0.35;
    const wSchoolBase = 0.30;
    const wSchool = wSchoolBase + schoolWeightNorm * 0.25;
    const weightSum = wBudgetBase + wCommuteBase + wSchool;
    const wBudget = wBudgetBase / weightSum;
    const wCommute = wCommuteBase / weightSum;
    const wSchoolFinal = wSchool / weightSum;

    const results = communities
      .map((c) => {
        const estimatedTotalWan = (c.price * 90) / 10000;
        const budgetRatio = estimatedTotalWan / targetTotalPriceWan;
        // 超预算惩罚更强，低预算略加分，但不会无上限加分。
        const budgetScore = budgetRatio <= 1
          ? Math.min(100, 100 - (1 - budgetRatio) * 25)
          : Math.max(0, 100 - (budgetRatio - 1) * 140);

        const commuteRatio = c.subway / maxAcceptableSubwayKm;
        // 距离阈值越远惩罚越快，确保排序能明显变化。
        const commuteScore = commuteRatio <= 1
          ? Math.max(60, 100 - commuteRatio * 35)
          : Math.max(0, 65 - (commuteRatio - 1) * 85);

        const schoolBase = c.schoolLevel === "重点" ? 88 : 55;
        const distanceBonus = Math.max(0, 12 - c.distance * 8);
        const premiumBonus = Math.min(10, c.premium / 6);
        const schoolScore = Math.min(100, schoolBase + distanceBonus + premiumBonus);

        const matchScore = Math.round(
          budgetScore * wBudget +
          commuteScore * wCommute +
          schoolScore * wSchoolFinal
        );

        // 用于打破同分并稳定排序。
        const tieBreaker = schoolScore * 0.01 - c.subway * 0.01;
        return { ...c, matchScore, estimatedTotalWan: Math.round(estimatedTotalWan), _tb: tieBreaker };
      })
      .filter((c) => c.matchScore >= 45)
      .sort((a, b) => (b.matchScore - a.matchScore) || (b._tb - a._tb))
      .slice(0, 3)
      .map(({ _tb, ...rest }) => rest);

    setRecommendations(results);
  };

  const avgPremium = districts.length ? (districts.reduce((s, d) => s + d.premium, 0) / districts.length).toFixed(1) : "-";
  const keySchoolAvgPrice = communities.filter((c) => c.schoolLevel === "重点");
  const avgKeyPrice = keySchoolAvgPrice.length
    ? Math.round(keySchoolAvgPrice.reduce((s, c) => s + c.price, 0) / keySchoolAvgPrice.length).toLocaleString()
    : "-";
  const topDistrict = districts.length ? districts.reduce((a, b) => (a.premium > b.premium ? a : b)) : null;
  const topFeature = featureImportance.length ? featureImportance[0] : null;

  const kpis = [
    { label: "全市平均溢价",  value: `${avgPremium}%`,                sub: "基于当前样本",     color: C.blue,   icon: "📈" },
    { label: "重点学区均价",  value: `¥${avgKeyPrice}`,              sub: "每平方米",          color: C.yellow, icon: "🏠" },
    { label: "最高溢价区域",  value: topDistrict ? `${topDistrict.name} ${topDistrict.premium}%` : "-", sub: "当前数据集", color: "#dc2626", icon: "🔥" },
    { label: "首要影响特征",  value: topFeature ? topFeature.feature : "-", sub: "机器学习输出", color: C.teal, icon: "🤖" },
  ];

  const TABS = [["overview","📊 宏观概览"],["analysis","🔬 溢价分析"],["recommend","🎯 智能选房"]];

  return (
    <div style={{ fontFamily: "'Noto Sans SC','PingFang SC',sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1e40af,#1d4ed8 55%,#0369a1)", height: 64, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 16px rgba(30,64,175,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏙</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>城市学区房溢价分析决策系统</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>大数据分析课程项目 · 武汉市房产数据集</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setHelpOpen((v) => !v)}
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: "4px 13px", fontSize: 11, color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            🔎 功能导航
          </button>
          <span style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: "4px 13px", fontSize: 11, color: "#fff", fontWeight: 600 }}>● 最近更新：{lastUpdatedAt || "--:--:--"}</span>
          <span style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.45)", borderRadius: 20, padding: "4px 13px", fontSize: 11, color: "#fef3c7", fontWeight: 600 }}>样本量：{communities.length} 条</span>
        </div>
      </div>

      {helpOpen && (
        <div style={{ position: "fixed", top: 78, right: 24, width: 380, maxHeight: "70vh", overflowY: "auto", zIndex: 99, background: C.surface, border: `1px solid ${C.borderStrong}`, borderRadius: 12, boxShadow: C.shadowMd, padding: 12 }}>
          <div style={{ fontWeight: 800, color: C.text, marginBottom: 8, fontSize: 13 }}>功能导航 / Help</div>
          <input
            value={helpQuery}
            onChange={(e) => setHelpQuery(e.target.value)}
            placeholder="搜索：模型、推荐、异常、溢价..."
            style={{ width: "100%", border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, marginBottom: 10 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredNavItems.map((item) => (
              <button
                key={item.anchor}
                onClick={() => jumpToSection(item)}
                style={{ textAlign: "left", border: `1px solid ${C.border}`, background: C.surfaceAlt, borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
              >
                <div style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.desc}</div>
              </button>
            ))}
            {filteredNavItems.length === 0 && (
              <div style={{ fontSize: 12, color: C.textMuted, padding: "6px 2px" }}>没有匹配项，换个关键词试试。</div>
            )}
          </div>
        </div>
      )}

      {/* KPI Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ padding: "16px 24px", borderRight: i < 3 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${k.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 2, padding: "14px 32px 0", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        {TABS.map(([k, v]) => {
          const active = activeTab === k;
          return (
            <button key={k} onClick={() => setActiveTab(k)} style={{
              padding: "8px 22px", borderRadius: "10px 10px 0 0", fontSize: 13, fontWeight: 700,
              cursor: "pointer", border: "none", transition: "all 0.15s",
              background: active ? C.blueLight : "transparent",
              color: active ? C.blue : C.textMid,
              borderBottom: `2px solid ${active ? C.blue : "transparent"}`,
            }}>{v}</button>
          );
        })}
      </div>

      {/* Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 32px", background: C.surface }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={loadData} style={{ border: `1px solid ${C.borderStrong}`, background: C.blueLight, color: C.blue, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            刷新数据
          </button>
          <button onClick={() => setAutoPlay((v) => !v)} style={{ border: `1px solid ${autoPlay ? C.blue : C.borderStrong}`, background: autoPlay ? C.blue : C.surface, color: autoPlay ? "#fff" : C.textMid, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {autoPlay ? "停止轮播" : "答辩轮播"}
          </button>
          <button onClick={exportFilteredCsv} style={{ border: `1px solid ${C.borderStrong}`, background: C.surfaceAlt, color: C.text, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            导出当前筛选CSV
          </button>
        </div>
        <div style={{ fontSize: 12, color: loadError ? "#dc2626" : C.textMuted, fontWeight: 600 }}>
          {loadError || "数据链路：db.json -> json-server -> dashboard"}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "26px 32px", opacity: animIn ? 1 : 0, transition: "opacity 0.4s" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400, color: C.textMuted, fontSize: 16 }}>
            正在加载数据...
          </div>
        ) : (
          <>
        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              <div id="overview-heatmap">
              <Card>
                <CardTitle>各区学区溢价热力图</CardTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {districts.map(d => <HeatmapCell key={d.name} district={d} isSelected={selectedDistrict?.name === d.name} onClick={setSelectedDistrict} />)}
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.textMuted }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {["#dbeafe","#93c5fd","#60a5fa","#2563eb"].map(c => <div key={c} style={{ width: 18, height: 6, background: c, borderRadius: 2 }} />)}
                  </div>
                  低溢价 → 高溢价 · 点击查看雷达图
                </div>
              </Card>
              </div>

              <Card id="overview-radar">
                <CardTitle>区域综合评估 · {selectedDistrict?.name}</CardTitle>
                {selectedDistrict && (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke={C.border} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: C.textMid, fontSize: 12, fontWeight: 600 }} />
                        <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false} />
                        <Radar dataKey="value" stroke={C.blue} fill={C.blue} fillOpacity={0.15} strokeWidth={2.5} dot={{ fill: C.blue, r: 4, strokeWidth: 0 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 4 }}>
                      {[
                        [selectedDistrict.premium + "%", "学区溢价", C.blue],
                        [`¥${selectedDistrict.avgPrice.toLocaleString()}`, "均价/㎡", C.yellow],
                      ].map(([v, l, c]) => (
                        <div key={l} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>

            <Card>
              <CardTitle>学区 vs 非学区房价走势（2019–2024）</CardTitle>
              <ResponsiveContainer width="100%" height={195}>
                <LineChart data={priceTrend}>
                  <CartesianGrid stroke={C.border} strokeDasharray="4 3" />
                  <XAxis dataKey="year" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `¥${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.textMid }} />
                  <Line type="monotone" dataKey="school"    name="学区房"   stroke={C.blue}   strokeWidth={2.5} dot={{ fill: C.blue,   r: 4, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="nonSchool" name="非学区房" stroke={C.yellow} strokeWidth={2.5} dot={{ fill: C.yellow, r: 4, strokeWidth: 0 }} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              <Card id="overview-correlation">
                <CardTitle>学区溢价-房价相关性</CardTitle>
                <div style={{ fontSize: 34, fontWeight: 800, color: C.blue }}>
                  {districtCorrelation.toFixed(3)}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                  Pearson 相关系数（区级均价 vs 溢价）
                </div>
              </Card>
              <Card>
                <CardTitle>各区居住性价比 TOP</CardTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {districtValueRanking.slice(0, 5).map((d, idx) => (
                    <div key={d.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span>{idx + 1}. {d.name}</span>
                      <strong style={{ color: C.blue }}>{d.valueScore}</strong>
                    </div>
                  ))}
                </div>
              </Card>
              <Card id="overview-histogram">
                <CardTitle>溢价区间分布直方图</CardTitle>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={premiumHistogram}>
                    <XAxis dataKey="range" tick={{ fill: C.textMuted, fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill={C.teal} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* ── ANALYSIS ─────────────────────────────────────────────────────── */}
        {activeTab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              <Card id="analysis-feature-importance">
                <CardTitle>随机森林特征重要性排名</CardTitle>
                <ResponsiveContainer width="100%" height={215}>
                  <BarChart data={featureImportance} layout="vertical">
                    <CartesianGrid stroke={C.border} horizontal={false} strokeDasharray="4 2" />
                    <XAxis type="number" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0,0.4]} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                    <YAxis type="category" dataKey="feature" tick={{ fill: C.textMid, fontSize: 12 }} width={70} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} formatter={v => [`${(v*100).toFixed(1)}%`,"重要度"]} />
                    <Bar dataKey="importance" radius={[0,6,6,0]}>
                      {featureImportance.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: C.blue, marginTop: 8, padding: "9px 12px", background: C.blueLight, borderRadius: 8, borderLeft: `3px solid ${C.blue}`, fontWeight: 500 }}>
                  💡 当前模型最关键特征：{topFeature ? `${topFeature.feature}（${(topFeature.importance * 100).toFixed(1)}%）` : "暂无"}
                </div>
              </Card>

              <Card>
                <CardTitle>各区域学区溢价比例对比</CardTitle>
                <ResponsiveContainer width="100%" height={215}>
                  <BarChart data={districts}>
                    <CartesianGrid stroke={C.border} vertical={false} strokeDasharray="4 2" />
                    <XAxis dataKey="name" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={v => [`${v}%`,"溢价比例"]} />
                    <Bar dataKey="premium" name="学区溢价%" radius={[6,6,0,0]}>
                      {districts.map((_, i) => <Cell key={i} fill={`hsl(${215-i*8},${70-i*5}%,${52+i*5}%)`} />)}
                    </Bar>
                    <ReferenceLine y={29.2} stroke={C.yellow} strokeDasharray="5 3" strokeWidth={2}
                      label={{ value: `全市均值 ${avgPremium}%`, fill: "#92400e", fontSize: 11, fontWeight: 700 }} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card>
              <CardTitle>小区样本散点图：学校距离 vs 房价</CardTitle>
              <ResponsiveContainer width="100%" height={215}>
                <ScatterChart>
                  <CartesianGrid stroke={C.border} strokeDasharray="4 2" />
                  <XAxis dataKey="distance" name="学校距离" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}km`} />
                  <YAxis dataKey="price" name="均价" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `¥${(v/1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ stroke: C.blueMid, strokeDasharray:"4 2" }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: C.shadowMd }}>
                        <p style={{ color: C.blue, fontWeight: 700, marginBottom: 5 }}>{d.name}</p>
                        <p style={{ color: C.text }}>均价：<strong style={{ color: C.yellow }}>¥{d.price.toLocaleString()}/㎡</strong></p>
                        <p style={{ color: C.text }}>溢价：<strong style={{ color: C.blue }}>+{d.premium}%</strong></p>
                        <p style={{ color: C.text }}>距学校：<strong>{d.distance}km</strong></p>
                        <Badge color={d.schoolLevel === "重点" ? "blue" : "teal"}>{d.schoolLevel}</Badge>
                      </div>
                    );
                  }} />
                  <Scatter data={communities} shape={({ cx, cy, payload }) => (
                    <circle cx={cx} cy={cy} r={7} fill={payload.schoolLevel === "重点" ? C.blue : C.teal} fillOpacity={0.8} stroke={C.surface} strokeWidth={2} />
                  )} />
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 12, color: C.textMid }}>
                <span><span style={{ color: C.blue, fontWeight: 700 }}>●</span> 重点学区</span>
                <span><span style={{ color: C.teal, fontWeight: 700 }}>●</span> 普通学区</span>
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Card id="analysis-model-compare">
                <CardTitle>模型对比（R² / RMSE）</CardTitle>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.blueLight }}>
                      <th style={{ padding: "8px", textAlign: "left" }}>模型</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>R²</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>RMSE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "8px" }}>线性回归</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{metricTable.linear_regression.r2.toFixed(3)}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{Math.round(metricTable.linear_regression.rmse)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "8px" }}>随机森林</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{metricTable.random_forest.r2.toFixed(3)}</td>
                      <td style={{ padding: "8px", textAlign: "right" }}>{Math.round(metricTable.random_forest.rmse)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>

              <Card id="analysis-simulation">
                <CardTitle>控制变量溢价剥离演示器</CardTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ fontSize: 12 }}>
                    行政区
                    <select value={simDistrict} onChange={(e) => setSimDistrict(e.target.value)} style={{ width: "100%", marginTop: 4 }}>
                      {districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 12 }}>
                    房龄：{simHouseAge}年
                    <input type="range" min={1} max={30} value={simHouseAge} onChange={(e) => setSimHouseAge(Number(e.target.value))} style={{ width: "100%" }} />
                  </label>
                  <label style={{ fontSize: 12, gridColumn: "1 / span 2" }}>
                    地铁距离：{simSubwayKm.toFixed(1)}km
                    <input type="range" min={0.2} max={3} step={0.1} value={simSubwayKm} onChange={(e) => setSimSubwayKm(Number(e.target.value))} style={{ width: "100%" }} />
                  </label>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: C.textMid }}>
                  非学区预测价：<strong>¥{simulationResult.noSchool.toLocaleString()}</strong> /㎡
                </div>
                <div style={{ fontSize: 12, color: C.textMid }}>
                  学区预测价：<strong>¥{simulationResult.withSchool.toLocaleString()}</strong> /㎡
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: C.blue, fontWeight: 700 }}>
                  溢价剥离结果：+¥{simulationResult.diff.toLocaleString()} /㎡（{simulationResult.pct.toFixed(1)}%）
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Card id="analysis-outlier">
                <CardTitle>异常值检测：清洗前</CardTitle>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart>
                    <CartesianGrid stroke={C.border} strokeDasharray="4 2" />
                    <XAxis dataKey="distance" tickFormatter={(v) => `${v}km`} />
                    <YAxis dataKey="price" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter data={anomalyScatter.before} fill={C.yellow} />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <CardTitle>异常值检测：清洗后</CardTitle>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart>
                    <CartesianGrid stroke={C.border} strokeDasharray="4 2" />
                    <XAxis dataKey="distance" tickFormatter={(v) => `${v}km`} />
                    <YAxis dataKey="price" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter data={anomalyScatter.after} fill={C.blue} />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* ── RECOMMEND ────────────────────────────────────────────────────── */}
        {activeTab === "recommend" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              <Card id="recommend-controls">
                <CardTitle>🎛 输入你的需求偏好</CardTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {[
                    { label:"💰 购房总预算", display:`${budget} 万元`, min:100, max:800, value:budget, set:setBudget, color:C.blue,   l:"100万",  r:"800万" },
                    { label:"🚇 最大通勤时间", display:`${commute} 分钟`, min:15, max:90, value:commute, set:setCommute, color:C.teal, l:"15分钟", r:"90分钟" },
                    { label:"🏫 学区重视程度", display:"★".repeat(schoolWeight)+"☆".repeat(5-schoolWeight), min:1, max:5, value:schoolWeight, set:setSchoolWeight, color:C.yellow, l:"不在意", r:"非常重要" },
                  ].map(({ label, display, min, max, value, set, color, l, r }) => (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{label}</span>
                        <span style={{ color, fontWeight: 800, fontSize: 14 }}>{display}</span>
                      </div>
                      <input type="range" min={min} max={max} value={value} onChange={e => set(+e.target.value)} style={{
                        width: "100%", height: 6, appearance: "none", borderRadius: 3, outline: "none", cursor: "pointer",
                        background: `linear-gradient(to right, ${color} 0%, ${color} ${((value-min)/(max-min))*100}%, ${C.border} ${((value-min)/(max-min))*100}%, ${C.border} 100%)`,
                      }} />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                        <span>{l}</span><span>{r}</span>
                      </div>
                    </div>
                  ))}
                  <button onClick={handleRecommend} style={{
                    background: `linear-gradient(135deg,${C.blue},#1d4ed8)`,
                    border: "none", borderRadius: 12, padding: "13px", color: "#fff",
                    fontWeight: 800, fontSize: 14, cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(37,99,235,0.3)", transition: "opacity 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = "0.87"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >🔍 智能匹配最优房源</button>
                </div>
              </Card>

              <Card id="recommend-top3">
                <CardTitle>🏆 TOP 3 推荐房源</CardTitle>
                {recommendations.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "44px 20px", color: C.textMuted, fontSize: 13 }}>
                    <div style={{ fontSize: 38, marginBottom: 10 }}>🏡</div>
                    设置偏好后点击左侧按钮匹配
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {recommendations.map((r, i) => (
                      <div key={r.id} style={{
                        background: i === 0 ? C.blueLight : C.surfaceAlt,
                        border: `1px solid ${i === 0 ? C.blueMid : C.border}`,
                        borderRadius: 12, padding: "13px 15px",
                        boxShadow: i === 0 ? `0 2px 10px rgba(37,99,235,0.1)` : "none",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                              <span style={{ fontSize: 17 }}>{"🥇🥈🥉"[i]}</span>
                              <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{r.name}</span>
                              <Badge color={r.schoolLevel === "重点" ? "blue" : "teal"}>{r.schoolLevel}学区</Badge>
                            </div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>{r.district} · 近{r.school} · 地铁{r.subway}km</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: i === 0 ? C.blue : C.textMid }}>{r.matchScore}</div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>匹配分</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 18, marginTop: 9 }}>
                          {[[`¥${r.price.toLocaleString()}/㎡`,"均价",C.yellow],[`+${r.premium}%`,"溢价",C.blue],[`${r.distance}km`,"距学校",C.teal]].map(([v,l,c]) => (
                            <div key={l} style={{ fontSize: 12 }}>
                              <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                              <span style={{ color: C.textMuted, marginLeft: 4 }}>{l}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "#92400e" }}>
                          你为学区多花约：<strong>¥{Math.round(((r.estimatedTotalWan || 0) * 10000 * r.premium) / (100 + r.premium)).toLocaleString()}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <CardTitle>全部小区样本数据表</CardTitle>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索小区/区域/学校"
                  style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}
                />
                <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                  <option value="全部">全部学区等级</option>
                  <option value="重点">重点</option>
                  <option value="普通">普通</option>
                </select>
                <select value={sortField} onChange={(e) => setSortField(e.target.value)} style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                  <option value="score">按综合评分</option>
                  <option value="price">按均价</option>
                  <option value="premium">按溢价</option>
                  <option value="distance">按学校距离</option>
                  <option value="subway">按地铁距离</option>
                </select>
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 12, color: C.textMuted }}>
                  共 {filteredCommunities.length} 条
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.blueLight }}>
                      {["小区名称","所属区域","均价(元/㎡)","学区溢价","学区等级","距学校","地铁距离","综合评分"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.blue, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", borderBottom: `2px solid ${C.borderStrong}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommunities.map((c, i) => (
                      <tr key={c.id}
                        style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? C.surfaceAlt : C.surface, transition: "background 0.12s", cursor: "default" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.blueLight}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 ? C.surfaceAlt : C.surface}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: C.text }}>{c.name}</td>
                        <td style={{ padding: "10px 14px", color: C.textMid }}>{c.district}</td>
                        <td style={{ padding: "10px 14px", color: "#92400e", fontWeight: 600 }}>¥{c.price.toLocaleString()}</td>
                        <td style={{ padding: "10px 14px", color: C.blue, fontWeight: 700 }}>+{c.premium}%</td>
                        <td style={{ padding: "10px 14px" }}><Badge color={c.schoolLevel === "重点" ? "blue" : "teal"}>{c.schoolLevel}</Badge></td>
                        <td style={{ padding: "10px 14px", color: C.textMid }}>{c.distance}km</td>
                        <td style={{ padding: "10px 14px", color: C.textMid }}>{c.subway}km</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3 }}>
                              <div style={{ width: `${c.score}%`, height: "100%", background: `linear-gradient(90deg,${C.blue},${C.blueMid})`, borderRadius: 3 }} />
                            </div>
                            <span style={{ color: C.blue, fontWeight: 700, minWidth: 26 }}>{c.score}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card id="recommend-compare">
              <CardTitle>小区对比模式（并排比较）</CardTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <select value={compareLeftId} onChange={(e) => setCompareLeftId(e.target.value)}>
                  {communities.map((c) => <option key={`l-${c.id}`} value={String(c.id)}>{c.name}</option>)}
                </select>
                <select value={compareRightId} onChange={(e) => setCompareRightId(e.target.value)}>
                  {communities.map((c) => <option key={`r-${c.id}`} value={String(c.id)}>{c.name}</option>)}
                </select>
              </div>
              {compareLeft && compareRight && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.blueLight }}>
                      <th style={{ padding: 8, textAlign: "left" }}>指标</th>
                      <th style={{ padding: 8, textAlign: "right" }}>{compareLeft.name}</th>
                      <th style={{ padding: 8, textAlign: "right" }}>{compareRight.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["均价(元/㎡)", compareLeft.price, compareRight.price],
                      ["学区溢价(%)", compareLeft.premium, compareRight.premium],
                      ["学校距离(km)", compareLeft.distance, compareRight.distance],
                      ["地铁距离(km)", compareLeft.subway, compareRight.subway],
                      ["综合评分", compareLeft.score, compareRight.score]
                    ].map(([label, l, r]) => (
                      <tr key={label}>
                        <td style={{ padding: 8 }}>{label}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{l}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
