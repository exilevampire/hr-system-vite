import { AppLayout } from "../components/AppLayout";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

interface BureauItem { bureau: string; count: number }
interface MonthItem { month: string; count: number }

interface ITCount { done: number; pending: number; na: number; unknown: number }

interface Stats {
  total: number;
  byBureau: BureauItem[];
  allByBureau: BureauItem[];
  byMonth: MonthItem[];
  allByMonth: MonthItem[];
  itStatus: { cleared: number; pending: number };
  itBreakdown: { fmis: ITCount; eMeeting: ITCount; software: ITCount; phonebook: ITCount };
}

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function toMonthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Bureau modal
  const [showBureauModal, setShowBureauModal] = useState(false);
  const [bureauSearch, setBureauSearch] = useState("");

  // Month modal
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Bureau filter
  const filteredBureau = useMemo(() => {
    if (!stats?.allByBureau) return [];
    const q = bureauSearch.trim().toLowerCase();
    if (!q) return stats.allByBureau;
    return stats.allByBureau.filter((b) => b.bureau.toLowerCase().includes(q));
  }, [stats?.allByBureau, bureauSearch]);

  // Available years (BE) from allByMonth
  const availableYears = useMemo(() => {
    if (!stats?.allByMonth) return [];
    const years = [...new Set(stats.allByMonth.map((m) => {
      const [y] = m.month.split("-").map(Number);
      return y + 543;
    }))].sort((a, b) => a - b);
    return years;
  }, [stats?.allByMonth]);

  // Modal chart data — if year selected: fill all 12 months; if "all": show everything
  const modalChartData = useMemo(() => {
    if (!stats?.allByMonth) return [];
    if (selectedYear === "all") {
      return stats.allByMonth.map(({ month, count }) => ({
        label: toMonthLabel(month),
        count,
      }));
    }
    const ceYear = Number(selectedYear) - 543;
    const countMap: Record<number, number> = {};
    for (const { month, count } of stats.allByMonth) {
      const [y, m] = month.split("-").map(Number);
      if (y === ceYear) countMap[m] = count;
    }
    return THAI_MONTHS.map((label, i) => ({
      label: `${label} ${String(selectedYear).slice(2)}`,
      count: countMap[i + 1] ?? 0,
    }));
  }, [stats?.allByMonth, selectedYear]);

  const modalTotal = useMemo(
    () => modalChartData.reduce((s, d) => s + d.count, 0),
    [modalChartData]
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ด</h1>
        <p className="text-slate-500 text-sm mt-1">สรุปภาพรวมข้อมูลพนักงานที่พ้นสภาพ</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">กำลังโหลดข้อมูล...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="พนักงานทั้งหมด" value={stats?.total ?? 0} icon="👥" color="blue" />
            <StatCard label="ดำเนินการแล้ว" value={stats?.itStatus?.cleared ?? 0} icon="✅" color="green" />
            <StatCard label="อยู่ระหว่างดำเนินการ" value={stats?.itStatus?.pending ?? 0} icon="⏳" color="yellow" />
            <StatCard label="หน่วยงาน" value={stats?.allByBureau?.length ?? 0} icon="🏢" color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bureau card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-700">
                  พนักงานแยกตามหน่วยงาน
                  <span className="ml-2 text-xs font-normal text-slate-400">(Top 10)</span>
                </h2>
                {(stats?.allByBureau?.length ?? 0) > 10 && (
                  <button
                    onClick={() => { setShowBureauModal(true); setBureauSearch(""); }}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ดูทั้งหมด ({stats!.allByBureau?.length ?? 0} หน่วยงาน)
                  </button>
                )}
              </div>
              {stats?.byBureau && stats.byBureau.length > 0 ? (
                <div className="space-y-3">
                  {stats.byBureau.map((item, i) => {
                    const max = stats.byBureau[0].count;
                    const pct = Math.round((item.count / max) * 100);
                    const barColor = i === 0 ? "bg-blue-500" : i === 1 ? "bg-blue-400" : i === 2 ? "bg-blue-300" : "bg-slate-300";
                    const rankColor = i === 0 ? "text-blue-600 font-bold" : i === 1 ? "text-blue-500 font-bold" : i === 2 ? "text-blue-400 font-bold" : "text-slate-400";
                    return (
                      <div key={item.bureau} className="flex items-center gap-3">
                        <span className={`text-xs w-5 text-right flex-shrink-0 ${rankColor}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700 truncate" title={item.bureau}>{item.bureau}</span>
                            <span className="text-sm font-semibold text-slate-800 ml-3 flex-shrink-0">{item.count.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full">
                            <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>

            {/* Pie chart */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-700 mb-4">สัดส่วนการปิดสิทธิ์ IT</h2>
              {stats?.itStatus && (stats.itStatus.cleared + stats.itStatus.pending) > 0 ? (() => {
                const total = stats.itStatus.cleared + stats.itStatus.pending;
                const pct = Math.round((stats.itStatus.cleared / total) * 100);
                return (
                  <>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "ดำเนินการแล้ว", value: stats.itStatus.cleared },
                              { name: "อยู่ระหว่างดำเนินการ", value: stats.itStatus.pending },
                            ]}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                            startAngle={90} endAngle={-270} dataKey="value" label={false}
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#f59e0b" />
                          </Pie>
                          <Tooltip formatter={(v) => (v as number).toLocaleString()} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-bold text-slate-800">{pct}%</span>
                        <span className="text-xs text-slate-500 mt-0.5">ดำเนินการแล้ว</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-lg p-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-green-700">{stats.itStatus.cleared.toLocaleString()}</div>
                          <div className="text-xs text-green-600">ดำเนินการแล้ว</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-amber-700">{stats.itStatus.pending.toLocaleString()}</div>
                          <div className="text-xs text-amber-600">อยู่ระหว่างดำเนินการ</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })() : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>

            {/* IT breakdown card */}
            {stats?.itBreakdown && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
                <h2 className="font-semibold text-slate-700 mb-4">สถานะดำเนินการรายระบบ</h2>
                <div className="space-y-4">
                  {([
                    ["FMIS",      stats.itBreakdown.fmis],
                    ["eMeeting",  stats.itBreakdown.eMeeting],
                    ["Software",  stats.itBreakdown.software],
                    ["Phonebook", stats.itBreakdown.phonebook],
                  ] as [string, ITCount][]).map(([label, cnt]) => {
                    const total = cnt.done + cnt.pending + cnt.na + (cnt.unknown ?? 0);
                    const donePct = total > 0 ? (cnt.done + cnt.na + (cnt.unknown ?? 0)) / total : 0;
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-slate-600 w-24 shrink-0">{label}</span>
                          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                              ดำเนินการแล้ว <span className="font-semibold text-slate-700 ml-0.5">{cnt.done.toLocaleString()}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                              ไม่พบบัญชี <span className="font-semibold text-slate-700 ml-0.5">{cnt.na.toLocaleString()}</span>
                            </span>
                            {(cnt.unknown ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                                ไม่ทราบสถานะ <span className="font-semibold text-slate-700 ml-0.5">{cnt.unknown.toLocaleString()}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                              ยังไม่ดำเนินการ <span className="font-semibold text-slate-700 ml-0.5">{cnt.pending.toLocaleString()}</span>
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 w-12 text-right shrink-0">
                            {Math.round(donePct * 100)}%
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${total > 0 ? ((cnt.done + cnt.na) / total) * 100 : 0}%` }} />
                          <div className="h-full bg-violet-400 transition-all" style={{ width: `${total > 0 ? ((cnt.unknown ?? 0) / total) * 100 : 0}%` }} />
                          <div className="h-full bg-amber-400 transition-all" style={{ width: `${total > 0 ? (cnt.pending / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Monthly trend card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-700">
                  แนวโน้มรายเดือน (พนักงานที่พ้นสภาพ)
                  <span className="ml-2 text-xs font-normal text-slate-400">(12 เดือนล่าสุด)</span>
                </h2>
                {(stats?.allByMonth?.length ?? 0) > 0 && (
                  <button
                    onClick={() => { setShowMonthModal(true); setSelectedYear("all"); }}
                    className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    ขยายดูทั้งหมด
                  </button>
                )}
              </div>
              {stats?.byMonth && stats.byMonth.length > 0 ? (() => {
                const monthData = stats.byMonth.map(({ month, count }) => ({
                  label: toMonthLabel(month), count,
                }));
                return (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthData} barCategoryGap="30%">
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                        formatter={(v) => [(v as number).toLocaleString(), "จำนวน"]}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })() : (
                <div className="h-32 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Bureau modal ─────────────────────────────────────── */}
      {showBureauModal && stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBureauModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="font-semibold text-slate-800">พนักงานแยกตามหน่วยงาน</h2>
                <p className="text-xs text-slate-400 mt-0.5">ทั้งหมด {stats.allByBureau?.length ?? 0} หน่วยงาน</p>
              </div>
              <button onClick={() => setShowBureauModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1">×</button>
            </div>
            <div className="px-6 py-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <input type="text" value={bureauSearch} onChange={(e) => setBureauSearch(e.target.value)}
                  placeholder="ค้นหาหน่วยงาน..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                {bureauSearch && (
                  <button onClick={() => setBureauSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base leading-none">×</button>
                )}
              </div>
              {bureauSearch && <p className="text-xs text-slate-400 mt-1.5">พบ {filteredBureau.length} หน่วยงาน</p>}
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-3">
              {filteredBureau.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredBureau.map((item) => {
                    const max = stats.allByBureau?.[0]?.count ?? 1;
                    const pct = Math.round((item.count / max) * 100);
                    const rank = (stats.allByBureau?.findIndex((b) => b.bureau === item.bureau) ?? -1) + 1;
                    const barColor = rank === 1 ? "bg-blue-500" : rank === 2 ? "bg-blue-400" : rank === 3 ? "bg-blue-300" : "bg-slate-300";
                    const rankColor = rank === 1 ? "text-blue-600 font-bold" : rank === 2 ? "text-blue-500 font-bold" : rank === 3 ? "text-blue-400 font-bold" : "text-slate-400";
                    return (
                      <div key={item.bureau} className="flex items-center gap-3">
                        <span className={`text-xs w-6 text-right flex-shrink-0 ${rankColor}`}>{rank}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700 truncate" title={item.bureau}>{item.bureau}</span>
                            <span className="text-sm font-semibold text-slate-800 ml-3 flex-shrink-0">{item.count.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm">ไม่พบหน่วยงานที่ค้นหา</div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-100 shrink-0 flex items-center justify-between text-xs text-slate-400">
              <span>รวมพนักงานทั้งหมด {stats.total.toLocaleString()} คน</span>
              <button onClick={() => setShowBureauModal(false)} className="px-4 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Month modal ──────────────────────────────────────── */}
      {showMonthModal && stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMonthModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2 className="font-semibold text-slate-800">แนวโน้มรายเดือน (พนักงานที่พ้นสภาพ)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedYear === "all"
                    ? `ข้อมูลทั้งหมด ${availableYears.length} ปี (${availableYears[0]}–${availableYears[availableYears.length - 1]} พ.ศ.)`
                    : `ปี พ.ศ. ${selectedYear}`}
                </p>
              </div>
              <button onClick={() => setShowMonthModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1">×</button>
            </div>

            {/* Year selector */}
            <div className="px-6 py-3 border-b border-slate-100 shrink-0">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedYear("all")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    selectedYear === "all"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  ทุกปี
                </button>
                {availableYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(String(y))}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selectedYear === String(y)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Summary badge */}
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-indigo-500">รวม</span>
                  <span className="text-lg font-bold text-indigo-700">{modalTotal.toLocaleString()}</span>
                  <span className="text-xs text-indigo-500">คน</span>
                </div>
                {selectedYear !== "all" && (
                  <div className="text-xs text-slate-400">
                    เฉลี่ย {modalTotal > 0 ? (modalTotal / 12).toFixed(1) : 0} คน/เดือน
                  </div>
                )}
              </div>

              {modalChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={modalChartData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: selectedYear === "all" ? 9 : 11, fill: "#64748b" }}
                      axisLine={false} tickLine={false}
                      interval={selectedYear === "all" ? "preserveStartEnd" : 0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip
                      cursor={{ fill: "#eef2ff" }}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e0e7ff", fontSize: 13 }}
                      formatter={(v) => [(v as number).toLocaleString(), "จำนวน (คน)"]}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[5, 5, 0, 0]}
                      label={selectedYear !== "all" ? {
                        position: "top" as const, fontSize: 10, fill: "#6366f1",
                        formatter: (v: unknown) => Number(v) > 0 ? String(v) : "",
                      } : false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 shrink-0 flex justify-end">
              <button onClick={() => setShowMonthModal(false)}
                className="px-4 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                ปิด
              </button>
            </div>

          </div>
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </div>
  );
}
