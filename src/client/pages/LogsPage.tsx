import { AppLayout } from "../components/AppLayout";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../lib/api";

interface AuditLog {
  id: number;
  employeeId: string;
  action: string;
  changedFields?: Record<string, { old: unknown; new: unknown }>;
  adminUser: string;
  source: string;
  fileName?: string | null;
  importBatchId?: string | null;
  createdAt: string;
  employee?: { nameTh: string };
}

const PAGE_SIZE = 30;

const FIELD_LABELS: Record<string, string> = {
  nameTh: "ชื่อ-สกุล (ไทย)",
  nameEn: "ชื่อ-สกุล (อังกฤษ)",
  employeeId: "รหัสพนักงาน",
  dataSourceId: "ข้อมูลต้นทาง",
  position: "ตำแหน่ง",
  level: "ประเภท",
  department: "ฝ่าย/กลุ่มงาน",
  bureau: "หน่วยงาน/สำนัก",
  endDate: "วันพ้นสภาพ",
  receivedDate: "วันที่ได้รับข้อมูล",
  fmis: "FMIS",
  fmisDate: "วันที่ FMIS",
  eMeeting: "eMeeting",
  eMeetingDate: "วันที่ eMeeting",
  software: "Software",
  softwareDate: "วันที่ Software",
  phonebook: "Phonebook",
  phonebookDate: "วันที่ Phonebook",
  email: "อีเมล",
};

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  CREATE: { label: "สร้างข้อมูล", color: "bg-green-100 text-green-700 border-green-200", icon: "✚" },
  UPDATE: { label: "แก้ไขข้อมูล", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "✎" },
  DELETE: { label: "ลบข้อมูล", color: "bg-red-100 text-red-700 border-red-200", icon: "✕" },
};

const SOURCE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  MANUAL: { label: "แก้ไขเอง", color: "bg-slate-100 text-slate-600 border-slate-200", icon: "🖱" },
  IMPORT: { label: "นำเข้าไฟล์", color: "bg-amber-100 text-amber-700 border-amber-200", icon: "📄" },
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
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

  // filters
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [adminUser, setAdminUser] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fetchLogs(p: number, params?: { search: string; filterAction: string; filterSource: string; adminUser: string; dateFrom: string; dateTo: string }) {
    const s = params ?? { search, filterAction, filterSource, adminUser, dateFrom, dateTo };
    setLoading(true);
    const q = new URLSearchParams({
      page: String(p),
      pageSize: String(PAGE_SIZE),
      ...(s.search ? { search: s.search } : {}),
      ...(s.filterAction !== "ALL" ? { action: s.filterAction } : {}),
      ...(s.filterSource !== "ALL" ? { source: s.filterSource } : {}),
      ...(s.adminUser ? { adminUser: s.adminUser } : {}),
      ...(s.dateFrom ? { dateFrom: s.dateFrom } : {}),
      ...(s.dateTo ? { dateTo: s.dateTo } : {}),
    });
    apiFetch(`/api/logs?${q}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.data ?? []); setTotal(d.total ?? 0); setLoading(false); });
  }

  useEffect(() => { fetchLogs(page); }, [page]);

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLogs(1, { search: val, filterAction, filterSource, adminUser, dateFrom, dateTo });
    }, 400);
  }

  function handleFilterChange(newAction?: string, newAdmin?: string, newFrom?: string, newTo?: string, newSource?: string) {
    const a = newAction ?? filterAction;
    const u = newAdmin ?? adminUser;
    const f = newFrom ?? dateFrom;
    const t = newTo ?? dateTo;
    const src = newSource ?? filterSource;
    if (newAction !== undefined) setFilterAction(a);
    if (newAdmin !== undefined) setAdminUser(u);
    if (newFrom !== undefined) setDateFrom(f);
    if (newTo !== undefined) setDateTo(t);
    if (newSource !== undefined) setFilterSource(src);
    setPage(1);
    fetchLogs(1, { search, filterAction: a, filterSource: src, adminUser: u, dateFrom: f, dateTo: t });
  }

  function clearFilters() {
    setSearch(""); setFilterAction("ALL"); setFilterSource("ALL"); setAdminUser(""); setDateFrom(""); setDateTo("");
    setPage(1);
    fetchLogs(1, { search: "", filterAction: "ALL", filterSource: "ALL", adminUser: "", dateFrom: "", dateTo: "" });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = search || filterAction !== "ALL" || filterSource !== "ALL" || adminUser || dateFrom || dateTo;

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
            <p className="text-slate-500 text-sm mt-1">ประวัติการเปลี่ยนแปลงข้อมูลทั้งหมด ({total.toLocaleString()} รายการ)</p>
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="text-sm text-slate-500 hover:text-red-500 border border-slate-300 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors">
              ล้างตัวกรอง ✕
            </button>
          )}
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          {/* Row 1: search + admin */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="ค้นหารหัสพนักงาน หรือ ชื่อ..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">👤</span>
              <input
                type="text"
                placeholder="ผู้ดำเนินการ (email)..."
                value={adminUser}
                onChange={(e) => handleFilterChange(undefined, e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 2: action + source + date range */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 whitespace-nowrap">การกระทำ</span>
              <div className="flex gap-1.5">
                {["ALL", "CREATE", "UPDATE", "DELETE"].map((a) => (
                  <button
                    key={a}
                    onClick={() => handleFilterChange(a)}
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

            <div className="hidden sm:block w-px h-6 bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 whitespace-nowrap">ช่องทาง</span>
              <div className="flex gap-1.5">
                {["ALL", "MANUAL", "IMPORT"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleFilterChange(undefined, undefined, undefined, undefined, s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      filterSource === s
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {s === "ALL" ? "ทั้งหมด" : SOURCE_CONFIG[s]?.label ?? s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs font-medium text-slate-400 whitespace-nowrap">วันที่</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleFilterChange(undefined, undefined, e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">ถึง</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleFilterChange(undefined, undefined, undefined, e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200">กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            {hasFilters ? "ไม่พบรายการที่ตรงกับเงื่อนไข" : "ยังไม่มีประวัติการดำเนินการ"}
          </div>
        ) : (
          logs.map((log) => {
            const cfg = ACTION_CONFIG[log.action] ?? { label: log.action, color: "bg-slate-100 text-slate-600 border-slate-200", icon: "•" };
            const srcCfg = SOURCE_CONFIG[log.source] ?? SOURCE_CONFIG.MANUAL;
            const { date, time } = formatDateTime(log.createdAt);
            const changes = log.changedFields ? Object.entries(log.changedFields) : [];
            const isOpen = expanded === log.id;

            return (
              <div key={log.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>

                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${srcCfg.color}`} title={log.fileName ?? undefined}>
                    {srcCfg.icon} {srcCfg.label}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800 text-sm">
                      {log.employee?.nameTh ?? log.employeeId}
                    </span>
                    <span className="text-slate-700 text-xs ml-2 font-mono font-semibold">{log.employeeId}</span>
                    {log.fileName && (
                      <span className="block text-slate-400 text-xs mt-0.5 truncate">📎 {log.fileName}</span>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <div className="text-xs text-slate-500">{log.adminUser}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span>{date}</span>
                      <span className="ml-1 text-slate-300">|</span>
                      <span className="ml-1">{time} น.</span>
                    </div>
                  </div>

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

                <div className="sm:hidden px-5 pb-3 flex justify-between text-xs text-slate-500">
                  <span>{log.adminUser}</span>
                  <span>{date} {time} น.</span>
                </div>

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
