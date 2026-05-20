import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";

// ── Searchable dropdown ──────────────────────────────────────────────────────
function SearchableSelect({
  placeholder,
  value,
  onChange,
  options,
  className = "",
}: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, value]);

  const filtered = options.filter(
    (o) => !query || o.toLowerCase().includes(query.toLowerCase())
  );

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  function select(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {value ? (
          <button
            onClick={clear}
            className="absolute right-2 text-slate-400 hover:text-slate-600 text-base leading-none"
          >
            ×
          </button>
        ) : (
          <span className="absolute right-2 text-slate-400 text-xs pointer-events-none">▾</span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); select(opt); }}
              className={`w-full px-4 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${
                opt === value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  employeeId: string;
  nameTh: string;
  nameEn?: string;
  position?: string;
  level?: string;
  department?: string;
  bureau?: string;
  startDate?: string;
  endDate?: string;
  receivedDate?: string;
  remarks?: string;
  email?: string;
  fmis?: string;
  eMeeting?: string;
  website?: string;
  phone3cx?: string;
  intranet?: string;
  hrSent?: string;
}

const PAGE_SIZE = 20;

const HEADERS = [
  "", "#", "รหัส", "ชื่อ-สกุล (ไทย)", "ชื่อ-สกุล (อังกฤษ)",
  "ตำแหน่ง", "หน่วยงาน", "วันพ้นสภาพ",
  "FMIS", "eMeeting", "Website", "3CX", "Intranet", "บค.ส่ง",
];

// Default widths matching the natural content layout (px)
const DEFAULT_WIDTHS = [80, 48, 88, 210, 210, 185, 175, 120, 100, 100, 100, 100, 100, 100];

function formatDate(d?: string | null) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH");
}

export default function AllRecordsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "VIEWER";
  const canEdit = role === "SUPER_ADMIN" || role === "HR_ADMIN";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [bureau, setBureau] = useState("");
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_WIDTHS);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [bureauOptions, setBureauOptions] = useState<string[]>([]);

  // Fetch dropdown options once on mount
  useEffect(() => {
    apiFetch("/api/employees/meta")
      .then((r) => r.json())
      .then((d) => {
        setPositionOptions(d.positions ?? []);
        setBureauOptions(d.bureaus ?? []);
      })
      .catch(() => {});
  }, []);

  // Cleanup cursor styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const startResize = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = colWidths[colIndex] ?? 100;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.max(40, startWidth + ev.clientX - startX);
        setColWidths((prev) => {
          const next = [...prev];
          next[colIndex] = newWidth;
          return next;
        });
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [colWidths]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      search,
      bureau,
      position,
    });
    const res = await apiFetch(`/api/employees?${params}`);
    const data = await res.json();
    setEmployees(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, bureau, position]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handleDelete(employeeId: string) {
    if (!confirm("ยืนยันการลบข้อมูลนี้?")) return;
    await apiFetch(`/api/employees/${employeeId}`, { method: "DELETE" });
    fetchData();
  }

  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ข้อมูลพนักงานที่พ้นสภาพ</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {total.toLocaleString()} รายการ</p>
        </div>
        {canEdit && (
          <div className="sm:ml-auto flex gap-2">
            <Link to="/records/import" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              📥 นำเข้า Excel
            </Link>
            <Link to="/records/add" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              ➕ เพิ่มรายการ
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="ค้นหารหัส / ชื่อ-สกุล (ไทย / อังกฤษ)..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <SearchableSelect
          placeholder="ค้นหาตำแหน่ง..."
          value={position}
          onChange={(v) => { setPosition(v); setPage(1); }}
          options={positionOptions}
          className="w-full sm:w-52"
        />
        <SearchableSelect
          placeholder="กรองตามหน่วยงาน..."
          value={bureau}
          onChange={(v) => { setBureau(v); setPage(1); }}
          options={bureauOptions}
          className="w-full sm:w-56"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="text-sm border-collapse"
            style={{ tableLayout: "fixed", width: tableWidth }}
          >
            <colgroup>
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {HEADERS.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap relative select-none overflow-hidden"
                  >
                    <span className="block overflow-hidden text-ellipsis pr-2">{h}</span>
                    {/* Resize handle — skip first (actions) column */}
                    {i > 0 && (
                      <ResizeHandle onMouseDown={(e) => startResize(i, e)} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={HEADERS.length} className="py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={HEADERS.length} className="py-12 text-center text-slate-400">ไม่พบข้อมูล</td></tr>
              ) : employees.map((emp, i) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3 whitespace-nowrap overflow-hidden">
                    {canEdit && (
                      <div className="flex gap-2">
                        <Link to={`/records/${emp.employeeId}/edit`} className="text-blue-600 hover:underline text-xs">แก้ไข</Link>
                        {role === "SUPER_ADMIN" && (
                          <button onClick={() => handleDelete(emp.employeeId)} className="text-red-500 hover:underline text-xs">ลบ</button>
                        )}
                      </div>
                    )}
                  </td>
                  <TCell className="text-slate-400 text-center">{(page - 1) * PAGE_SIZE + i + 1}</TCell>
                  <TCell title={emp.employeeId} className="font-mono text-xs text-slate-600">{emp.employeeId}</TCell>
                  <TCell title={emp.nameTh} className="font-medium text-slate-800">{emp.nameTh}</TCell>
                  <TCell title={emp.nameEn ?? "-"} className="text-slate-500">{emp.nameEn ?? "-"}</TCell>
                  <TCell title={emp.position ?? "-"}>{emp.position ?? "-"}</TCell>
                  <TCell title={emp.bureau ?? "-"}>{emp.bureau ?? "-"}</TCell>
                  <TCell title={formatDate(emp.endDate)}>{formatDate(emp.endDate)}</TCell>
                  <ITStatusCell value={emp.fmis} />
                  <ITStatusCell value={emp.eMeeting} />
                  <ITStatusCell value={emp.website} />
                  <ITStatusCell value={emp.phone3cx} />
                  <ITStatusCell value={emp.intranet} />
                  <TCell title={formatDate(emp.hrSent)}>{formatDate(emp.hrSent)}</TCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 text-slate-400">ไม่พบข้อมูล</div>
        ) : employees.map((emp) => {
          const itFields: { label: string; value?: string | null }[] = [
            { label: "FMIS", value: emp.fmis },
            { label: "eMeeting", value: emp.eMeeting },
            { label: "Website", value: emp.website },
            { label: "3CX", value: emp.phone3cx },
            { label: "Intranet", value: emp.intranet },
          ];
          return (
            <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">

              {/* Header: ชื่อ + รหัส + ปุ่มแก้ไข */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{emp.nameTh}</div>
                  <div className="text-xs text-slate-500 truncate">{emp.nameEn || "-"}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{emp.employeeId}</div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 shrink-0">
                    <Link to={`/records/${emp.employeeId}/edit`} className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1">แก้ไข</Link>
                    {role === "SUPER_ADMIN" && (
                      <button onClick={() => handleDelete(emp.employeeId)} className="text-xs text-red-500 border border-red-200 rounded px-2 py-1">ลบ</button>
                    )}
                  </div>
                )}
              </div>

              {/* ข้อมูลทั่วไป */}
              <div className="text-xs space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">ตำแหน่ง</span>
                  <span className="text-slate-700">{emp.position ?? "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">หน่วยงาน</span>
                  <span className="text-slate-700">{emp.bureau ?? "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">วันพ้นสภาพ</span>
                  <span className="text-slate-700">{formatDate(emp.endDate)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">บค. ส่ง</span>
                  <span className="text-slate-700">{formatDate(emp.hrSent)}</span>
                </div>
              </div>

              {/* สถานะ IT — badges เหมือน desktop */}
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-400 mb-2 font-medium">สถานะการปิดสิทธิ์ IT</div>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                  {itFields.map(({ label, value }) => {
                    const isDone = value === "ดำเนินการแล้ว";
                    return (
                      <div key={label} className="flex items-center justify-between gap-1">
                        <span className="text-xs text-slate-500 shrink-0">{label}</span>
                        {isDone ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">ดำเนินการแล้ว</span>
                        ) : (
                          <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap">ยังไม่ดำเนินการ</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* หมายเหตุ (ถ้ามี) */}
              {emp.remarks && (
                <div className="border-t border-slate-100 pt-2 text-xs text-slate-600">
                  <span className="text-slate-400">หมายเหตุ: </span>{emp.remarks}
                </div>
              )}
            </div>
          );
        })}
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

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseEnter={() => { if (ref.current) ref.current.style.backgroundColor = "#93c5fd"; }}
      onMouseLeave={() => { if (ref.current) ref.current.style.backgroundColor = "transparent"; }}
      className="absolute right-0 top-0 h-full"
      style={{ width: 5, cursor: "col-resize", backgroundColor: "transparent" }}
    />
  );
}

function TCell({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-3 text-slate-600 overflow-hidden ${className}`}
      style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 0 }}
      title={title ?? (typeof children === "string" ? children : undefined)}
    >
      {children}
    </td>
  );
}

function ITStatusCell({ value }: { value?: string | null }) {
  const isDone = value === "ดำเนินการแล้ว";
  const label = isDone ? "ดำเนินการแล้ว" : "ยังไม่ดำเนินการ";
  return (
    <td className="px-3 py-3 text-left overflow-hidden" title={label}>
      {isDone ? (
        <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">ดำเนินการแล้ว</span>
      ) : (
        <span className="inline-block text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap">ยังไม่ดำเนินการ</span>
      )}
    </td>
  );
}
