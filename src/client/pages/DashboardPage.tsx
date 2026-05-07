import { AppLayout } from "../components/AppLayout";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface Stats {
  total: number;
  byBureau: { bureau: string; count: number }[];
  byMonth: { month: string; count: number }[];
  itStatus: { cleared: number; pending: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
            <StatCard label="ปิดสิทธิ์แล้ว" value={stats?.itStatus.cleared ?? 0} icon="✅" color="green" />
            <StatCard label="รอดำเนินการ" value={stats?.itStatus.pending ?? 0} icon="⏳" color="yellow" />
            <StatCard label="หน่วยงาน" value={stats?.byBureau.length ?? 0} icon="🏢" color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-700 mb-4">
                พนักงานแยกตามหน่วยงาน
                <span className="ml-2 text-xs font-normal text-slate-400">(Top 10)</span>
              </h2>
              {stats?.byBureau && stats.byBureau.length > 0 ? (
                <div className="space-y-3">
                  {stats.byBureau.map((item, i) => {
                    const max = stats.byBureau[0].count;
                    const pct = Math.round((item.count / max) * 100);
                    const barColor =
                      i === 0 ? "bg-blue-500" :
                      i === 1 ? "bg-blue-400" :
                      i === 2 ? "bg-blue-300" : "bg-slate-300";
                    const rankColor =
                      i === 0 ? "text-blue-600 font-bold" :
                      i === 1 ? "text-blue-500 font-bold" :
                      i === 2 ? "text-blue-400 font-bold" : "text-slate-400";
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
                              { name: "ปิดสิทธิ์แล้ว", value: stats.itStatus.cleared },
                              { name: "รอดำเนินการ", value: stats.itStatus.pending },
                            ]}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={85}
                            startAngle={90} endAngle={-270}
                            dataKey="value" label={false}
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#f59e0b" />
                          </Pie>
                          <Tooltip formatter={(v) => (v as number).toLocaleString()} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-bold text-slate-800">{pct}%</span>
                        <span className="text-xs text-slate-500 mt-0.5">ปิดสิทธิ์แล้ว</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-lg p-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-green-700">{stats.itStatus.cleared.toLocaleString()}</div>
                          <div className="text-xs text-green-600">ปิดสิทธิ์แล้ว</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                        <div>
                          <div className="text-lg font-bold text-amber-700">{stats.itStatus.pending.toLocaleString()}</div>
                          <div className="text-xs text-amber-600">รอดำเนินการ</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })() : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
              <h2 className="font-semibold text-slate-700 mb-4">แนวโน้มรายเดือน (พนักงานที่พ้นสภาพ)</h2>
              {stats?.byMonth && stats.byMonth.length > 0 ? (() => {
                const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
                const monthData = stats.byMonth.map(({ month, count }) => {
                  const [y, m] = month.split("-").map(Number);
                  return { label: `${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(2)}`, count };
                });
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
