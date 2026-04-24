import { AppLayout } from "../components/AppLayout";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
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
              <h2 className="font-semibold text-slate-700 mb-4">พนักงานแยกตามหน่วยงาน</h2>
              {stats?.byBureau && stats.byBureau.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.byBureau}>
                    <XAxis dataKey="bureau" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-700 mb-4">สัดส่วนการปิดสิทธิ์ IT</h2>
              {stats?.itStatus && (stats.itStatus.cleared + stats.itStatus.pending) > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "ปิดสิทธิ์แล้ว", value: stats.itStatus.cleared },
                        { name: "รอดำเนินการ", value: stats.itStatus.pending },
                      ]}
                      cx="50%" cy="50%" outerRadius={90}
                      dataKey="value" label={false}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">ยังไม่มีข้อมูล</div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
              <h2 className="font-semibold text-slate-700 mb-4">แนวโน้มรายเดือน (พนักงานที่พ้นสภาพ)</h2>
              {stats?.byMonth && stats.byMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.byMonth}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
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
