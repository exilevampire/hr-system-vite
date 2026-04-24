import { AppLayout } from "../components/AppLayout";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface AuditLog {
  id: number;
  employeeId: string;
  action: string;
  changedFields?: Record<string, { old: unknown; new: unknown }>;
  adminUser: string;
  createdAt: string;
  employee?: { nameTh: string };
}

const PAGE_SIZE = 30;

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/logs?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.data ?? []); setTotal(d.total ?? 0); setLoading(false); });
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const actionColors: Record<string, string> = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        <p className="text-slate-500 text-sm mt-1">ประวัติการเปลี่ยนแปลงข้อมูลทั้งหมด ({total.toLocaleString()} รายการ)</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-slate-400">ยังไม่มีประวัติการดำเนินการ</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">วันเวลา</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">รหัสพนักงาน</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">ชื่อ</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">ผู้ดำเนินการ</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString("th-TH")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${actionColors[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.employeeId}</td>
                    <td className="px-4 py-3 text-slate-700">{log.employee?.nameTh ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{log.adminUser}</td>
                    <td className="px-4 py-3">
                      {log.changedFields && Object.keys(log.changedFields).length > 0 && (
                        <button
                          onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {expanded === log.id ? "ซ่อน ▲" : `ดู ${Object.keys(log.changedFields).length} ฟิลด์ ▼`}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === log.id && log.changedFields && (
                    <tr key={`${log.id}-detail`} className="bg-slate-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="space-y-2">
                          {Object.entries(log.changedFields).map(([field, change]) => (
                            <div key={field} className="flex items-center gap-2 text-xs">
                              <span className="font-mono font-semibold text-slate-700 w-32">{field}</span>
                              <span className="text-red-500 line-through">{String(change.old ?? "-")}</span>
                              <span className="text-slate-400">→</span>
                              <span className="text-green-600">{String(change.new ?? "-")}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-slate-500">หน้า {page} จาก {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">← ก่อนหน้า</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">ถัดไป →</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
