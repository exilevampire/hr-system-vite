import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { ThaiDatePicker } from "../../components/ThaiDatePicker";

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

interface DataSourceInfo {
  id: number;
  sourceType: number;
  month: number;
  year: number;
}

const SOURCE_TYPE_NAMES: Record<number, string> = { 1: "สบค.", 2: "ศล." };
const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_MONTHS_SHORT = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatDataSource(ds?: DataSourceInfo | null): string {
  if (!ds) return "-";
  const name = SOURCE_TYPE_NAMES[ds.sourceType] ?? `ต้นทาง ${ds.sourceType}`;
  return `${name} ${THAI_MONTHS_SHORT[ds.month] ?? ds.month} ${ds.year}`;
}

interface Employee {
  id: number;
  employeeId: string;
  dataSource?: DataSourceInfo | null;
  nameTh: string;
  nameEn?: string;
  position?: string;
  level?: string;
  department?: string;
  bureau?: string;
  endDate?: string;
  receivedDate?: string;
  fmis?: string;
  fmisDate?: string;
  eMeeting?: string;
  eMeetingDate?: string;
  software?: string;
  softwareDate?: string;
  phonebook?: string;
  phonebookDate?: string;
}

const PAGE_SIZE = 20;

const HEADERS = [
  "จัดการ", "#", "รหัส", "ชื่อ-สกุล (ไทย)", "ชื่อ-สกุล (อังกฤษ)",
  "ตำแหน่ง", "ประเภท", "ฝ่าย/กลุ่มงาน", "หน่วยงาน", "วันพ้นสภาพ",
  "FMIS", "eMeeting", "Software", "Phonebook",
];

const NAME_COL_INDEX = 3;

// Default widths matching the natural content layout (px)
const DEFAULT_WIDTHS = [80, 48, 88, 210, 210, 185, 120, 160, 175, 120, 100, 100, 100, 100];

function formatDate(d?: string | null) {
  if (!d) return "-";
  const iso = d.split("T")[0];
  const parts = iso.split("-");
  if (parts.length < 3) return "-";
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return "-";
  return `${day}/${month}/${year + 543}`;
}

function isFullyClosed(emp: Employee): boolean {
  const itFields = [emp.fmis, emp.eMeeting, emp.software, emp.phonebook];
  const noneIsPending = itFields.every((v) => !v || v === "ดำเนินการแล้ว");
  const atLeastOneDone = itFields.some((v) => v === "ดำเนินการแล้ว");
  return noneIsPending && atLeastOneDone;
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
  const [level, setLevel] = useState("");
  const [department, setDepartment] = useState("");
  const [endDateFrom, setEndDateFrom] = useState("");
  const [endDateTo, setEndDateTo] = useState("");
  const [fmisStatus, setFmisStatus] = useState("");
  const [eMeetingStatus, setEMeetingStatus] = useState("");
  const [softwareStatus, setSoftwareStatus] = useState("");
  const [phonebookStatus, setPhonebookStatus] = useState("");
  const [itDateFrom, setItDateFrom] = useState("");
  const [itDateTo, setItDateTo] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [sourceMonthFilter, setSourceMonthFilter] = useState("");
  const [sourceYearFilter, setSourceYearFilter] = useState("");
  const [closedStatus, setClosedStatus] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_WIDTHS);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [bureauOptions, setBureauOptions] = useState<string[]>([]);
  const [levelOptions, setLevelOptions] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceInfo[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Fetch dropdown options once on mount
  useEffect(() => {
    apiFetch("/api/employees/meta")
      .then((r) => r.json())
      .then((d) => {
        setPositionOptions(d.positions ?? []);
        setBureauOptions(d.bureaus ?? []);
        setLevelOptions(d.levels ?? []);
        setDepartmentOptions(d.departments ?? []);
      })
      .catch(() => {});
    apiFetch("/api/datasources")
      .then((r) => r.json())
      .then((d: DataSourceInfo[]) => setDataSources(d ?? []))
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
      level,
      department,
      endDateFrom,
      endDateTo,
      fmisStatus,
      eMeetingStatus,
      softwareStatus,
      phonebookStatus,
      itDateFrom,
      itDateTo,
      sourceType: sourceTypeFilter,
      sourceMonth: sourceMonthFilter,
      sourceYear: sourceYearFilter,
      closedStatus,
    });
    const res = await apiFetch(`/api/employees?${params}`);
    const data = await res.json();
    setEmployees(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, bureau, position, level, department, endDateFrom, endDateTo, fmisStatus, eMeetingStatus, softwareStatus, phonebookStatus, itDateFrom, itDateTo, sourceTypeFilter, sourceMonthFilter, sourceYearFilter, closedStatus]);

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
          placeholder="กรองตำแหน่ง..."
          value={position}
          onChange={(v) => { setPosition(v); setPage(1); }}
          options={positionOptions}
          className="w-full sm:w-48"
        />
        <SearchableSelect
          placeholder="กรองประเภท..."
          value={level}
          onChange={(v) => { setLevel(v); setPage(1); }}
          options={levelOptions}
          className="w-full sm:w-44"
        />
        <SearchableSelect
          placeholder="กรองฝ่าย/กลุ่มงาน..."
          value={department}
          onChange={(v) => { setDepartment(v); setPage(1); }}
          options={departmentOptions}
          className="w-full sm:w-52"
        />
        <SearchableSelect
          placeholder="กรองตามหน่วยงาน..."
          value={bureau}
          onChange={(v) => { setBureau(v); setPage(1); }}
          options={bureauOptions}
          className="w-full sm:w-52"
        />
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`shrink-0 px-3 py-2 text-sm rounded-lg border transition-colors ${showAdvanced ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          {showAdvanced ? "ซ่อนตัวกรอง ▲" : "ตัวกรองเพิ่มเติม ▼"}
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 space-y-4">
          {/* วันที่พ้นสภาพ */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 w-32 shrink-0">วันที่พ้นสภาพ</span>
            <div className="flex flex-wrap items-center gap-2">
              <ThaiDatePicker value={endDateFrom} onChange={(v) => { setEndDateFrom(v); setPage(1); }} className="w-48" />
              <span className="text-slate-400 text-sm">ถึง</span>
              <ThaiDatePicker value={endDateTo} onChange={(v) => { setEndDateTo(v); setPage(1); }} className="w-48" />
            </div>
          </div>

          {/* IT status */}
          <div className="flex flex-wrap items-start gap-3">
            <span className="text-xs font-medium text-slate-500 w-32 shrink-0 mt-1.5">สถานะการดำเนินงาน</span>
            <div className="flex flex-wrap gap-2">
              {([
                ["FMIS", fmisStatus, setFmisStatus],
                ["eMeeting", eMeetingStatus, setEMeetingStatus],
                ["Software", softwareStatus, setSoftwareStatus],
                ["Phonebook", phonebookStatus, setPhonebookStatus],
              ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-400 px-1">{label}</span>
                  <select value={val} onChange={(e) => { setter(e.target.value); setPage(1); }}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">ทั้งหมด</option>
                    <option value="ดำเนินการแล้ว">ดำเนินการแล้ว</option>
                    <option value="ยังไม่ดำเนินการ">ยังไม่ดำเนินการ</option>
                    <option value="ไม่พบบัญชี">ไม่พบบัญชี</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* สถานะปิดสิทธิ์ */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 w-32 shrink-0">สถานะปิดสิทธิ์</span>
            <div className="flex gap-2">
              {[
                { val: "", label: "ทั้งหมด" },
                { val: "closed", label: "✓ ปิดแล้ว" },
                { val: "pending", label: "ยังไม่ปิด" },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => { setClosedStatus(val); setPage(1); }}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    closedStatus === val
                      ? val === "closed"
                        ? "bg-green-600 border-green-600 text-white"
                        : val === "pending"
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "bg-slate-700 border-slate-700 text-white"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* IT date range */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 w-32 shrink-0">วันที่ดำเนินการ IT</span>
            <div className="flex flex-wrap items-center gap-2">
              <ThaiDatePicker value={itDateFrom} onChange={(v) => { setItDateFrom(v); setPage(1); }} className="w-48" />
              <span className="text-slate-400 text-sm">ถึง</span>
              <ThaiDatePicker value={itDateTo} onChange={(v) => { setItDateTo(v); setPage(1); }} className="w-48" />
            </div>
          </div>

          {/* DataSource filter */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 w-32 shrink-0">ข้อมูลต้นทาง</span>
            <div className="flex flex-wrap gap-2">
              <select
                value={sourceTypeFilter}
                onChange={(e) => { setSourceTypeFilter(e.target.value); setPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">ทั้งหมด</option>
                {[...new Set(dataSources.map((d) => d.sourceType))].sort().map((t) => (
                  <option key={t} value={String(t)}>{SOURCE_TYPE_NAMES[t] ?? `ต้นทาง ${t}`}</option>
                ))}
              </select>
              <select
                value={sourceMonthFilter}
                onChange={(e) => { setSourceMonthFilter(e.target.value); setPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">ทุกเดือน</option>
                {[...new Set(dataSources.map((d) => d.month))].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={String(m)}>{THAI_MONTHS[m]}</option>
                ))}
              </select>
              <select
                value={sourceYearFilter}
                onChange={(e) => { setSourceYearFilter(e.target.value); setPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">ทุกปี</option>
                {[...new Set(dataSources.map((d) => d.year))].sort((a, b) => b - a).map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

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
                    {i === NAME_COL_INDEX ? (
                      <span className="flex items-center gap-1.5 pr-2">
                        <span className="overflow-hidden text-ellipsis">{h}</span>
                        <span
                          className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-normal text-blue-500 bg-blue-50 border border-blue-200 rounded px-1 py-px leading-none"
                          title="คลิกที่ชื่อเพื่อดูรายละเอียด"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          กดดูข้อมูล
                        </span>
                      </span>
                    ) : (
                      <span className="block overflow-hidden text-ellipsis pr-2">{h}</span>
                    )}
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
                      <div className="flex gap-1.5">
                        <Link
                          to={`/records/${emp.employeeId}/edit`}
                          title="แก้ไข"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </Link>
                        {role === "SUPER_ADMIN" && (
                          <button
                            onClick={() => handleDelete(emp.employeeId)}
                            title="ลบ"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <TCell className="text-slate-400 text-center">{(page - 1) * PAGE_SIZE + i + 1}</TCell>
                  <TCell title={emp.employeeId} className="font-mono text-xs text-slate-600">{emp.employeeId}</TCell>
                  <td
                    className="px-3 py-3 overflow-hidden cursor-pointer"
                    style={{ maxWidth: 0 }}
                    title={emp.nameTh}
                    onClick={() => setSelectedEmp(emp)}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-medium text-blue-700 hover:underline overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
                        {emp.nameTh}
                      </span>
                      {isFullyClosed(emp) && (
                        <span className="shrink-0 text-xs bg-green-600 text-white px-1.5 py-px rounded font-semibold leading-tight whitespace-nowrap">
                          ปิด
                        </span>
                      )}
                    </div>
                  </td>
                  <TCell title={emp.nameEn ?? "-"} className="text-slate-500">{emp.nameEn ?? "-"}</TCell>
                  <TCell title={emp.position ?? "-"}>{emp.position ?? "-"}</TCell>
                  <TCell title={emp.level ?? "-"}>{emp.level ?? "-"}</TCell>
                  <TCell title={emp.department ?? "-"}>{emp.department ?? "-"}</TCell>
                  <TCell title={emp.bureau ?? "-"}>{emp.bureau ?? "-"}</TCell>
                  <TCell title={formatDate(emp.endDate)}>{formatDate(emp.endDate)}</TCell>
                  <ITStatusCell value={emp.fmis} />
                  <ITStatusCell value={emp.eMeeting} />
                  <ITStatusCell value={emp.software} />
                  <ITStatusCell value={emp.phonebook} />
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
            { label: "Software", value: emp.software },
            { label: "Phonebook", value: emp.phonebook },
          ];
          return (
            <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">

              {/* Header: ชื่อ + รหัส + ปุ่มแก้ไข */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800 truncate">{emp.nameTh}</span>
                    {isFullyClosed(emp) && (
                      <span className="shrink-0 text-xs bg-green-600 text-white px-1.5 py-px rounded font-semibold leading-tight">ปิด</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{emp.nameEn || "-"}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{emp.employeeId}</div>
                </div>
                {canEdit && (
                  <div className="flex gap-1.5 shrink-0">
                    <Link
                      to={`/records/${emp.employeeId}/edit`}
                      title="แก้ไข"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </Link>
                    {role === "SUPER_ADMIN" && (
                      <button
                        onClick={() => handleDelete(emp.employeeId)}
                        title="ลบ"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
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
                  <span className="text-slate-400 w-24 shrink-0">ฝ่าย/กลุ่มงาน</span>
                  <span className="text-slate-700">{emp.department ?? "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">หน่วยงาน</span>
                  <span className="text-slate-700">{emp.bureau ?? "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">วันพ้นสภาพ</span>
                  <span className="text-slate-700">{formatDate(emp.endDate)}</span>
                </div>
              </div>

              {/* สถานะการดำเนินงาน — badges เหมือน desktop */}
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-400 mb-2 font-medium">สถานะการดำเนินงาน</div>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                  {itFields.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-1">
                      <span className="text-xs text-slate-500 shrink-0">{label}</span>
                      {!value ? (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">ไม่พบบัญชี</span>
                      ) : value === "ดำเนินการแล้ว" ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">ดำเนินการแล้ว</span>
                      ) : (
                        <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap">ยังไม่ดำเนินการ</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

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
      {selectedEmp && <EmployeeDetailModal emp={selectedEmp} onClose={() => setSelectedEmp(null)} />}
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
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <td
      className={`px-3 py-3 text-slate-600 overflow-hidden ${className}`}
      style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 0 }}
      title={title ?? (typeof children === "string" ? children : undefined)}
      onClick={onClick}
    >
      {children}
    </td>
  );
}

function ITStatusCell({ value }: { value?: string | null }) {
  if (!value) {
    return (
      <td className="px-3 py-3 text-left overflow-hidden" title="ไม่พบบัญชี">
        <span className="inline-block text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">ไม่พบบัญชี</span>
      </td>
    );
  }
  const isDone = value === "ดำเนินการแล้ว";
  return (
    <td className="px-3 py-3 text-left overflow-hidden" title={value}>
      {isDone ? (
        <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">ดำเนินการแล้ว</span>
      ) : (
        <span className="inline-block text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap">ยังไม่ดำเนินการ</span>
      )}
    </td>
  );
}

function ITBadge({ value }: { value?: string | null }) {
  if (!value) {
    return <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">ไม่พบบัญชี</span>;
  }
  return value === "ดำเนินการแล้ว" ? (
    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ดำเนินการแล้ว</span>
  ) : (
    <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">ยังไม่ดำเนินการ</span>
  );
}

function EmployeeDetailModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  // Close on ESC
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Escape") onClose(); };

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 text-xs w-36 shrink-0">{label}</span>
      <span className="text-slate-700 text-xs break-all">{value || "-"}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={-1}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-800">{emp.nameTh}</h2>
              {isFullyClosed(emp) && (
                <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-semibold">
                  ✓ ปิดสำเร็จ
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">{emp.employeeId}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ข้อมูลทั่วไป */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">ข้อมูลทั่วไป</h3>
            <Row label="ชื่อ-สกุล (อังกฤษ)" value={emp.nameEn} />
            <Row label="ข้อมูลต้นทาง" value={formatDataSource(emp.dataSource)} />
          </section>

          {/* ตำแหน่ง */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">ตำแหน่งงาน</h3>
            <Row label="ตำแหน่ง" value={emp.position} />
            <Row label="ประเภท" value={emp.level} />
            <Row label="ฝ่าย/กลุ่มงาน" value={emp.department} />
            <Row label="หน่วยงาน/สำนัก" value={emp.bureau} />
          </section>

          {/* วันที่ */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">วันที่</h3>
            <Row label="วันที่พ้นสภาพ" value={formatDate(emp.endDate)} />
            <Row label="วันที่ได้รับข้อมูล" value={formatDate(emp.receivedDate)} />
          </section>

          {/* สถานะการดำเนินงาน */}
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">สถานะการดำเนินงาน</h3>
            <div className="space-y-2">
              {([
                ["FMIS",      emp.fmis,      emp.fmisDate],
                ["eMeeting",  emp.eMeeting, emp.eMeetingDate],
                ["Software",  emp.software, emp.softwareDate],
                ["Phonebook", emp.phonebook, emp.phonebookDate],
              ] as [string, string | undefined, string | undefined][]).map(([label, val, dateVal]) => (
                <div key={label} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {val === "ดำเนินการแล้ว" && dateVal && (
                      <span className="text-xs text-slate-400">{formatDate(dateVal)}</span>
                    )}
                    <ITBadge value={val} />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
