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

const FIELD_LABELS: Record<string, string> = {
  nameTh: "ชื่อ-สกุล (ไทย)",
  nameEn: "ชื่อ-สกุล (อังกฤษ)",
  employeeId: "รหัสพนักงาน",
  position: "ตำแหน่ง",
  level: "ประเภท",
  department: "ฝ่าย/กลุ่มงาน",
  bureau: "หน่วยงาน/สำนัก",
  endDate: "วันพ้นสภาพ",
  receivedDate: "วันที่ได้รับข้อมูล",
  fmis: "FMIS",
  eMeeting: "eMeeting",
  website: "Website",
  phone3cx: "3CX",
  intranet: "Intranet",
};

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  CREATE: { label: "สร้างข้อมูล", color: "bg-green-100 text-green-700 border-green-200", icon: "✚" },
  UPDATE: { label: "แก้ไขข้อมูล", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "✎" },
  DELETE: { label: "ลบข้อมูล", color: "bg-red-100 text-red-700 border-red-200", icon: "✕" },
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "string") {
    // ISO date string
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear() + 543;
        return `${day}/${month}/${year}`;
      }
    }
    return val;
  }
  return String(val);
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear() + 543;
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return { date: `${day}/${month}/${year}`, time: `${hh}:${mm}` };
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterAction, setFilterAction] = useState<string>("ALL");

  function fetchLogs(p: number) {
    setLoading(true);
    apiFetch(`/api/logs?page=${p}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.data ?? []); setTotal(d.total ?? 0); setLoading(false); });
  }

  useEffect(() => { fetchLogs(page); }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = filterAction === "ALL" ? logs : logs.filter((l) => l.action === filterAction);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
          <p className="text-slate-500 text-sm mt-1">ประวัติการเปลี่ยนแปลงข้อมูลทั้งหมด ({total.toLocaleString()} รายการ)</p>
        </div>
        <div className="flex gap-2">
          {["ALL", "CREATE", "UPDATE", "DELETE"].map((a) => (
            <button
              key={a}
              onClick={() => setFilterAction(a)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filterAction === a
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {a === "ALL" ? "ทั้งหมด" : ACTION_CONFIG[a]?.label ?? a}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200">ยังไม่มีประวัติการดำเนินการ</div>
        ) : (
          filtered.map((log) => {
            const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, color: "bg-slate-100 text-slate-600 border-slate-200", icon: "•" };
            const { date, time } = formatDateTime(log.createdAt);
            const changes = log.changedFields ? Object.entries(log.changedFields) : [];
            const isOpen = expanded === log.id;

            return (
              <div key={log.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Action badge */}
                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>

                  {/* Employee info */}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800 text-sm">
                      {log.employee?.nameTh ?? log.employeeId}
                    </span>
                    <span className="text-slate-400 text-xs ml-2 font-mono">{log.employeeId}</span>
                  </div>

                  {/* Who + when */}
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <div className="text-xs text-slate-500">{log.adminUser}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span>{date}</span>
                      <span className="ml-1 text-slate-300">|</span>
                      <span className="ml-1">{time} น.</span>
                    </div>
                  </div>

                  {/* Expand button (UPDATE only) */}
                  {changes.length > 0 && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : log.id)}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      {isOpen ? "ซ่อน" : `${changes.length} ฟิลด์`}
                      <span className="text-xs">{isOpen ? "▲" : "▼"}</span>
                    </button>
                  )}
                </div>

                {/* Mobile: who + when */}
                <div className="sm:hidden px-5 pb-3 flex justify-between text-xs text-slate-500">
                  <span>{log.adminUser}</span>
                  <span>{date} {time} น.</span>
                </div>

                {/* Changed fields detail */}
                {isOpen && changes.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">ฟิลด์ที่เปลี่ยนแปลง</p>
                    <div className="space-y-2.5">
                      {changes.map(([field, change]) => (
                        <div key={field} className="grid grid-cols-[140px_1fr_20px_1fr] items-start gap-2 text-sm">
                          <span className="text-xs font-medium text-slate-500 pt-0.5">
                            {FIELD_LABELS[field] ?? field}
                          </span>
                          <div className="bg-red-50 border border-red-100 rounded px-2 py-1 text-xs text-red-700 line-through break-all">
                            {formatValue(change.old)}
                          </div>
                          <span className="text-slate-400 text-center pt-1">→</span>
                          <div className="bg-green-50 border border-green-100 rounded px-2 py-1 text-xs text-green-700 break-all">
                            {formatValue(change.new)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-slate-500">หน้า {page} จาก {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">
              ← ก่อนหน้า
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">
              ถัดไป →
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
