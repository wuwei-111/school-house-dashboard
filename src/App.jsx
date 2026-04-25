import { useState, useEffect } from "react";
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

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px", boxShadow: C.shadow, ...style }}>
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

  useEffect(() => { 
    setTimeout(() => setAnimIn(true), 80); 
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [districtsData, communitiesData, priceTrendData, featureImportanceData] = await Promise.all([
          fetchDistricts(),
          fetchCommunities(),
          fetchPriceTrend(),
          fetchFeatureImportance()
        ]);
        setDistricts(districtsData);
        setCommunities(communitiesData);
        setPriceTrend(priceTrendData);
        setFeatureImportance(featureImportanceData);
        if (districtsData.length > 0) {
          setSelectedDistrict(districtsData[0]);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const radarData = selectedDistrict ? [
    { subject: "教育资源", value: selectedDistrict.education },
    { subject: "交通便利", value: selectedDistrict.traffic },
    { subject: "医疗配套", value: selectedDistrict.medical },
    { subject: "商业活力", value: selectedDistrict.commerce },
    { subject: "居住环境", value: selectedDistrict.environment },
  ] : [];

  const handleRecommend = () => {
    const maxPrice = (budget * 10000) / 80;
    const results = communities.map(c => {
      const bs = c.price <= maxPrice ? 100 : Math.max(0, 100 - (c.price - maxPrice) / maxPrice * 100);
      const cs = c.subway <= commute / 30 ? 100 : Math.max(0, 100 - (c.subway - commute / 30) * 20);
      const ss = c.schoolLevel === "重点" ? 100 : 60;
      return { ...c, matchScore: Math.round(bs * 0.3 + cs * 0.3 + ss * (schoolWeight / 5 * 0.4)) };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
    setRecommendations(results);
  };

  const kpis = [
    { label: "全市平均溢价",  value: "29.2%",      sub: "较去年 ↑3.1%",  color: C.blue,   icon: "📈" },
    { label: "重点学区均价",  value: "¥32,400",    sub: "每平方米",       color: C.yellow, icon: "🏠" },
    { label: "最高溢价区域",  value: "江汉区 45%", sub: "连续3年第一",   color: "#dc2626", icon: "🔥" },
    { label: "模型 R² 精度",  value: "0.876",      sub: "随机森林模型",   color: C.teal,   icon: "🤖" },
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
          <span style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: "4px 13px", fontSize: 11, color: "#fff", fontWeight: 600 }}>● 数据已更新</span>
          <span style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.45)", borderRadius: 20, padding: "4px 13px", fontSize: 11, color: "#fef3c7", fontWeight: 600 }}>样本量：10,000 条</span>
        </div>
      </div>

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

              <Card>
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
          </div>
        )}

        {/* ── ANALYSIS ─────────────────────────────────────────────────────── */}
        {activeTab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              <Card>
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
                  💡 学校距离是影响房价最核心因素，贡献度达 31%
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
                      label={{ value: "全市均值 29.2%", fill: "#92400e", fontSize: 11, fontWeight: 700 }} />
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
          </div>
        )}

        {/* ── RECOMMEND ────────────────────────────────────────────────────── */}
        {activeTab === "recommend" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              <Card>
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

              <Card>
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
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <CardTitle>全部小区样本数据表</CardTitle>
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
                    {communities.map((c, i) => (
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
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
