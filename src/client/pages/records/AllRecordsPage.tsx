import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { EditRecordModal } from "./EditRecordModal";
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
            className="absolute right-2 cursor-pointer text-slate-400 hover:text-slate-600 text-base leading-none"
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
              className={`w-full cursor-pointer px-4 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${
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
  email?: string;
}

const PAGE_SIZE = 20;

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

const HEADERS = [
  "จัดการ", "#", "รหัส", "ชื่อ-สกุล (ไทย)", "ชื่อ-สกุล (อังกฤษ)",
  "ตำแหน่ง", "ประเภท", "หน่วยงาน/สำนัก", "ฝ่าย/กลุ่มงาน", "วันพ้นสภาพ",
  "Email", "FMIS", "eMeeting", "Software", "Phonebook",
];

const NAME_COL_INDEX = 3;

// The org filters that narrow each other. Order matches the index tuples that
// /api/employees/meta returns in `combinations`.
type FacetField = "bureau" | "department" | "position" | "level";
const FACET_FIELDS: FacetField[] = ["bureau", "department", "position", "level"];

const SORT_FIELDS: Record<number, string> = {
  2: "employeeId",
  3: "nameTh",
  4: "nameEn",
  5: "position",
  6: "level",
  7: "bureau",
  8: "department",
  9: "endDate",
  10: "email",
};

const SORT_LABELS: Record<string, string> = {
  createdAt: "วันที่บันทึกข้อมูล",
  employeeId: "รหัสพนักงาน",
  nameTh: "ชื่อ-สกุล (ไทย)",
  nameEn: "ชื่อ-สกุล (อังกฤษ)",
  position: "ตำแหน่ง",
  level: "ประเภท",
  bureau: "หน่วยงาน/สำนัก",
  department: "ฝ่าย/กลุ่มงาน",
  endDate: "วันที่พ้นสภาพ",
  email: "Email",
};

function sortDirectionLabel(sortField: string, direction: "asc" | "desc"): string {
  if (sortField === "createdAt" || sortField === "endDate") return direction === "asc" ? "เก่าไปใหม่" : "ใหม่ไปเก่า";
  if (sortField === "employeeId") return direction === "asc" ? "น้อยไปมาก" : "มากไปน้อย";
  return direction === "asc" ? "ก–ฮ / A–Z" : "ฮ–ก / Z–A";
}

// Default widths matching the natural content layout (px)
const DEFAULT_WIDTHS = [80, 48, 88, 210, 210, 185, 120, 160, 175, 145, 180, 120, 120, 120, 120];
const DEFAULT_COLUMN_ORDER = HEADERS.map((_, index) => index);
const DEFAULT_VISIBLE_COLUMNS = HEADERS.map((_, index) => index).filter((index) => index !== 4 && index !== 10);
const LOCKED_COLUMN_COUNT = 2;
const COLUMN_SETTINGS_VERSION = 10;

interface ColumnSettings {
  version: number;
  order: number[];
  visible: number[];
  widths: number[];
}

function loadColumnSettings(storageKey: string): ColumnSettings {
  const defaults = { version: COLUMN_SETTINGS_VERSION, order: [...DEFAULT_COLUMN_ORDER], visible: [...DEFAULT_VISIBLE_COLUMNS], widths: [...DEFAULT_WIDTHS] };
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<ColumnSettings> | null;
    const validOrder = Array.isArray(parsed?.order)
      && parsed.order.length === HEADERS.length
      && new Set(parsed.order).size === HEADERS.length
      && parsed.order.every((index) => Number.isInteger(index) && index >= 0 && index < HEADERS.length)
      && parsed.order[0] === 0 && parsed.order[1] === 1;
    const validWidths = Array.isArray(parsed?.widths)
      && parsed.widths.length === HEADERS.length
      && parsed.widths.every((width) => typeof width === "number" && Number.isFinite(width) && width >= 40);
    const visible = Array.isArray(parsed?.visible)
      ? parsed.visible.filter((index) => Number.isInteger(index) && index >= 0 && index < HEADERS.length)
      : defaults.visible;
    return {
      version: COLUMN_SETTINGS_VERSION,
      order: validOrder ? parsed!.order! : defaults.order,
      visible: [...new Set([0, 1, NAME_COL_INDEX, ...visible])],
      widths: validWidths ? parsed!.widths! : defaults.widths,
    };
  } catch {
    return defaults;
  }
}

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

function isFutureEndDate(date?: string | null): boolean {
  const isoDate = date?.split("T")[0];
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const today = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  return isoDate > today;
}

function isFullyClosed(emp: Employee): boolean {
  const itFields = [emp.fmis, emp.eMeeting, emp.software, emp.phonebook];
  return itFields.every((v) => v === "ดำเนินการแล้ว" || v === "ไม่พบบัญชี" || v === "ไม่ทราบสถานะ");
}

export default function AllRecordsPage() {
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission("employees.update");
  const canDelete = hasPermission("employees.delete");
  const canExport = hasPermission("reports.export");
  const canImport = hasPermission("employees.import");

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
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const columnStorageKey = `hr-employee-table-columns-v${COLUMN_SETTINGS_VERSION}-${user?.id ?? "default"}`;
  const initialColumnSettings = useMemo(() => loadColumnSettings(columnStorageKey), [columnStorageKey]);
  const [colWidths, setColWidths] = useState<number[]>(initialColumnSettings.widths);
  const [visibleCols, setVisibleCols] = useState<Set<number>>(new Set(initialColumnSettings.visible));
  const [columnOrder, setColumnOrder] = useState<number[]>(initialColumnSettings.order);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [showColPicker, setShowColPicker] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [bureauOptions, setBureauOptions] = useState<string[]>([]);
  const [levelOptions, setLevelOptions] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [combinations, setCombinations] = useState<number[][]>([]);
  const [dataSources, setDataSources] = useState<DataSourceInfo[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const settings: ColumnSettings = {
      version: COLUMN_SETTINGS_VERSION,
      order: columnOrder,
      visible: [...visibleCols],
      widths: colWidths,
    };
    localStorage.setItem(columnStorageKey, JSON.stringify(settings));
  }, [columnStorageKey, columnOrder, visibleCols, colWidths]);

  function moveColumn(targetColumn: number) {
    if (draggedColumn === null || draggedColumn === targetColumn) return;
    setColumnOrder((current) => {
      const next = current.filter((index) => index !== draggedColumn);
      const targetIndex = next.indexOf(targetColumn);
      next.splice(targetIndex, 0, draggedColumn);
      return next;
    });
    setDraggedColumn(null);
  }

  function resetColumnSettings() {
    setColumnOrder([...DEFAULT_COLUMN_ORDER]);
    setVisibleCols(new Set(DEFAULT_VISIBLE_COLUMNS));
    setColWidths([...DEFAULT_WIDTHS]);
    localStorage.removeItem(columnStorageKey);
  }

  useEffect(() => {
    if (!showColPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node))
        setShowColPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColPicker]);

  // The dropdown options are deliberately not refetched as filters change — the
  // payload is ~45KB and the values only move when a record is edited or removed,
  // so this runs on mount and again after those two, not on every keystroke.
  const fetchMeta = useCallback(async () => {
    try {
      const d = await (await apiFetch("/api/employees/meta")).json();
      setPositionOptions(d.positions ?? []);
      setBureauOptions(d.bureaus ?? []);
      setLevelOptions(d.levels ?? []);
      setDepartmentOptions(d.departments ?? []);
      setCombinations(d.combinations ?? []);
    } catch {
      // keep whatever options are already loaded
    }
  }, []);

  useEffect(() => {
    fetchMeta();
    apiFetch("/api/datasources")
      .then((r) => r.json())
      .then((d: DataSourceInfo[]) => setDataSources(d ?? []))
      .catch(() => {});
  }, [fetchMeta]);

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
        // Cancel the click event that bubbles up to <th> after resize, which would trigger sort
        document.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });
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
      sortBy,
      sortDir,
    });
    const res = await apiFetch(`/api/employees?${params}`);
    const data = await res.json();
    setEmployees(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, bureau, position, level, department, endDateFrom, endDateTo, fmisStatus, eMeetingStatus, softwareStatus, phonebookStatus, itDateFrom, itDateTo, sourceTypeFilter, sourceMonthFilter, sourceYearFilter, closedStatus, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Org filter cascade ─────────────────────────────────────────────────────
  // The four org dropdowns narrow each other in every direction: each one offers
  // only the values that still occur once the *other* selections are applied. The
  // date, status and search filters deliberately stay out of it — folding those in
  // would mean re-querying the server on every keystroke.
  const facetLists: Record<FacetField, string[]> = {
    bureau: bureauOptions,
    department: departmentOptions,
    position: positionOptions,
    level: levelOptions,
  };
  const selection: Record<FacetField, string> = { bureau, department, position, level };

  const facetIndex = useMemo(() => {
    const built = {} as Record<FacetField, Map<string, number>>;
    for (const field of FACET_FIELDS) built[field] = new Map();
    bureauOptions.forEach((v, i) => built.bureau.set(v, i));
    departmentOptions.forEach((v, i) => built.department.set(v, i));
    positionOptions.forEach((v, i) => built.position.set(v, i));
    levelOptions.forEach((v, i) => built.level.set(v, i));
    return built;
  }, [bureauOptions, departmentOptions, positionOptions, levelOptions]);

  // A selection only constrains anything once it matches a real option, so text
  // typed part-way into a box neither filters the others nor gets cleared by them.
  function constraintsFrom(sel: Record<FacetField, string>, skip?: FacetField) {
    const out: [number, number][] = [];
    FACET_FIELDS.forEach((field, slot) => {
      if (field === skip || !sel[field]) return;
      const index = facetIndex[field].get(sel[field]);
      if (index !== undefined) out.push([slot, index]);
    });
    return out;
  }

  const satisfies = (combo: number[], constraints: [number, number][]) =>
    constraints.every(([slot, index]) => combo[slot] === index);

  function choicesFor(field: FacetField): string[] {
    const constraints = constraintsFrom(selection, field);
    if (!combinations.length || !constraints.length) return facetLists[field];
    const slot = FACET_FIELDS.indexOf(field);
    const available = new Set<number>();
    for (const combo of combinations) {
      if (combo[slot] >= 0 && satisfies(combo, constraints)) available.add(combo[slot]);
    }
    return facetLists[field].filter((_, i) => available.has(i));
  }

  function handleFacetChange(changed: FacetField, value: string) {
    const wanted = { ...selection, [changed]: value };
    // Keep what the user just picked, then keep each other selection only while it
    // is still possible alongside it — so switching bureau drops a department that
    // doesn't exist there, and the position that went with it.
    const next = { bureau: "", department: "", position: "", level: "" } as Record<FacetField, string>;
    next[changed] = value;
    if (combinations.length) {
      for (const field of FACET_FIELDS) {
        if (field === changed || !wanted[field]) continue;
        const constraints = constraintsFrom({ ...next, [field]: wanted[field] });
        if (!constraints.length || combinations.some((c) => satisfies(c, constraints))) {
          next[field] = wanted[field];
        }
      }
    } else {
      Object.assign(next, wanted);
    }
    setBureau(next.bureau);
    setDepartment(next.department);
    setPosition(next.position);
    setLevel(next.level);
    setPage(1);
  }

  function clearAllFilters() {
    setSearch(""); setBureau(""); setDepartment(""); setPosition(""); setLevel("");
    setEndDateFrom(""); setEndDateTo("");
    setFmisStatus(""); setEMeetingStatus(""); setSoftwareStatus(""); setPhonebookStatus("");
    setClosedStatus(""); setItDateFrom(""); setItDateTo("");
    setSourceTypeFilter(""); setSourceMonthFilter(""); setSourceYearFilter("");
    setPage(1);
  }

  async function handleDelete(reason: string) {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await apiFetch(`/api/employees/${deleteTarget.employeeId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "ไม่สามารถลบข้อมูลได้");
      setDeleteTarget(null);
      await fetchData();
      // Removing the last record under a bureau or position drops it from the filters
      await fetchMeta();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "ไม่สามารถลบข้อมูลได้");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    const params = new URLSearchParams({
      search, bureau, position, level, department,
      endDateFrom, endDateTo,
      fmisStatus, eMeetingStatus, softwareStatus, phonebookStatus,
      itDateFrom, itDateTo,
      sourceType: sourceTypeFilter,
      sourceMonth: sourceMonthFilter,
      sourceYear: sourceYearFilter,
      closedStatus,
      sortBy,
      sortDir,
    });
    const res = await apiFetch(`/api/reports/employees?${params}`);
    const disposition = res.headers.get("Content-Disposition");
    const match = disposition?.match(/filename="(.+?)"/);
    const filename = match?.[1] ?? "Retire_Report.xlsx";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloading(false);
  }

  const visibleColumnOrder = columnOrder.filter((columnIndex) => visibleCols.has(columnIndex));
  const tableWidth = visibleColumnOrder.reduce((totalWidth, columnIndex) => totalWidth + colWidths[columnIndex], 0);

  function renderDesktopCell(emp: Employee, rowIndex: number, columnIndex: number) {
    switch (columnIndex) {
      case 0:
        return <td key={columnIndex} className="sticky left-0 z-10 bg-white px-3 py-3 whitespace-nowrap overflow-hidden group-hover:bg-slate-50">
          {canEdit && <div className="flex gap-1.5">
            <button onClick={() => setEditingId(emp.employeeId)} title="แก้ไข" className="inline-flex cursor-pointer items-center justify-center w-7 h-7 rounded-md text-blue-600 hover:bg-blue-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            {canDelete && <button onClick={() => { setDeleteError(null); setDeleteTarget(emp); }} title="ลบ" className="inline-flex cursor-pointer items-center justify-center w-7 h-7 rounded-md text-red-500 hover:bg-red-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>}
          </div>}
        </td>;
      case 1:
        return <td key={columnIndex} style={{ left: colWidths[0] }} className="sticky z-10 bg-white px-3 py-3 text-center text-slate-400 group-hover:bg-slate-50">{(page - 1) * PAGE_SIZE + rowIndex + 1}</td>;
      case 2:
        return <TCell key={columnIndex} title={emp.employeeId} className="font-mono text-xs text-slate-600">{emp.employeeId}</TCell>;
      case 3:
        return <td key={columnIndex} className="px-3 py-3 overflow-hidden cursor-pointer" style={{ maxWidth: 0 }} title={emp.nameTh} onClick={() => setSelectedEmp(emp)}>
          <div className="flex flex-col items-start overflow-hidden">
            <span className="flex w-full items-center gap-1.5 overflow-hidden font-medium text-blue-700 hover:underline" title="คลิกเพื่อดูรายละเอียด">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{emp.nameTh}</span>
            </span>
            {isFullyClosed(emp) && <span className="mt-0.5 text-[11px] font-medium text-green-700">✓ ดำเนินการแล้ว</span>}
          </div>
        </td>;
      case 4: return <TCell key={columnIndex} title={emp.nameEn ?? "-"} className="text-slate-500">{emp.nameEn ?? "-"}</TCell>;
      case 5: return <TCell key={columnIndex} title={emp.position ?? "-"}>{emp.position ?? "-"}</TCell>;
      case 6: return <TCell key={columnIndex} title={emp.level ?? "-"}>{emp.level ?? "-"}</TCell>;
      case 7: return <TCell key={columnIndex} title={emp.bureau ?? "-"}>{emp.bureau ?? "-"}</TCell>;
      case 8: return <TCell key={columnIndex} title={emp.department ?? "-"}>{emp.department ?? "-"}</TCell>;
      case 9: return <TCell key={columnIndex} title={formatDate(emp.endDate)}>
        <span className="inline-flex flex-col items-start">
          <span>{formatDate(emp.endDate)}</span>
          {isFutureEndDate(emp.endDate) && <FutureEndDateLabel />}
        </span>
      </TCell>;
      case 10: return <TCell key={columnIndex} title={emp.email ?? "-"}>{emp.email ?? "-"}</TCell>;
      case 11: return <ITStatusCell key={columnIndex} value={emp.fmis} />;
      case 12: return <ITStatusCell key={columnIndex} value={emp.eMeeting} />;
      case 13: return <ITStatusCell key={columnIndex} value={emp.software} />;
      case 14: return <ITStatusCell key={columnIndex} value={emp.phonebook} />;
      default: return null;
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ข้อมูลพนักงานที่พ้นสภาพ</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {total.toLocaleString()} รายการ</p>
        </div>
        <div className="sm:ml-auto flex items-start gap-2 flex-wrap">
          <div className="flex flex-col items-center gap-1">
            <div ref={colPickerRef} className="relative">
              <button
                onClick={() => setShowColPicker(v => !v)}
                className="h-10 inline-flex cursor-pointer items-center px-4 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50 transition-colors text-slate-600 whitespace-nowrap"
              >
                ⚙️ จัดการคอลัมน์
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-3 min-w-[250px] max-h-[70vh] overflow-y-auto">
                <div className="text-xs font-semibold text-slate-600 mb-1 px-1">จัดลำดับและแสดง/ซ่อนคอลัมน์</div>
                <div className="text-[11px] text-slate-400 mb-2 px-1">ลาก ☰ เพื่อย้ายตำแหน่ง ระบบจะจดจำให้อัตโนมัติ</div>
                {columnOrder.slice(LOCKED_COLUMN_COUNT).map((columnIndex) => {
                  const isRequired = columnIndex === NAME_COL_INDEX;
                  return (
                    <div
                      key={columnIndex}
                      draggable
                      onDragStart={() => setDraggedColumn(columnIndex)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveColumn(columnIndex)}
                      onDragEnd={() => setDraggedColumn(null)}
                      className={`flex cursor-grab active:cursor-grabbing items-center gap-2 px-2 py-1.5 rounded border border-transparent hover:bg-slate-50 hover:border-slate-200 text-sm text-slate-700 ${draggedColumn === columnIndex ? "opacity-40" : ""}`}
                    >
                      <span className="cursor-grab active:cursor-grabbing text-slate-400 select-none" title="ลากเพื่อย้ายตำแหน่ง">☰</span>
                      <input
                        type="checkbox"
                        checked={visibleCols.has(columnIndex)}
                        disabled={isRequired}
                        onChange={() => {
                          setVisibleCols((previous) => {
                            const next = new Set(previous);
                            if (next.has(columnIndex)) next.delete(columnIndex); else next.add(columnIndex);
                            return next;
                          });
                        }}
                        className="cursor-pointer rounded accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span className="flex-1">{HEADERS[columnIndex]}</span>
                      {isRequired && <span className="text-[10px] text-slate-400">จำเป็น</span>}
                    </div>
                  );
                })}
                <button
                  onClick={resetColumnSettings}
                  className="mt-2 w-full cursor-pointer text-xs text-blue-600 hover:text-blue-800 text-center py-1.5 border-t border-slate-100"
                >คืนค่าคอลัมน์เริ่มต้น</button>
                </div>
              )}
            </div>
            <span className="text-[11px] text-slate-500">จัดลำดับและเลือกคอลัมน์ที่แสดง</span>
          </div>
          {canExport && <div className="flex flex-col items-center gap-1">
            <button
              onClick={handleDownload}
              disabled={downloading}
              title="ไฟล์รายงานจะใช้ลำดับเดียวกับตารางที่กำลังแสดง"
              className="h-10 inline-flex cursor-pointer items-center bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400 text-white px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {downloading ? "กำลังสร้างรายงาน..." : "📊 ดาวน์โหลดรายงาน"}
            </button>
            <span className="text-[11px] text-slate-500">รายงานจะเรียงตามตารางปัจจุบัน</span>
          </div>}
          {canImport && (
            <>
              <div className="flex flex-col items-center gap-1">
                <Link to="/records/import" className="h-10 inline-flex cursor-pointer items-center bg-green-600 hover:bg-green-700 text-white px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                  📥 นำเข้าข้อมูล
                </Link>
                <span className="text-[11px] text-slate-500">นำเข้าข้อมูลจากไฟล์ Excel</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Link to="/records/add" className="h-10 inline-flex cursor-pointer items-center bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                  ➕ เพิ่มบุคคลพ้นสภาพ
                </Link>
                <span className="text-[11px] text-slate-500">เพิ่มข้อมูลพนักงานทีละราย</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="ค้นหารหัส / ชื่อ-สกุล (ไทย / อังกฤษ) / Email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <SearchableSelect
          placeholder="กรองหน่วยงาน/สำนัก..."
          value={bureau}
          onChange={(v) => handleFacetChange("bureau", v)}
          options={choicesFor("bureau")}
          className="w-full sm:w-52"
        />
        <SearchableSelect
          placeholder="กรองฝ่าย/กลุ่มงาน..."
          value={department}
          onChange={(v) => handleFacetChange("department", v)}
          options={choicesFor("department")}
          className="w-full sm:w-52"
        />
        <SearchableSelect
          placeholder="กรองตำแหน่ง..."
          value={position}
          onChange={(v) => handleFacetChange("position", v)}
          options={choicesFor("position")}
          className="w-full sm:w-48"
        />
        <SearchableSelect
          placeholder="กรองประเภท..."
          value={level}
          onChange={(v) => handleFacetChange("level", v)}
          options={choicesFor("level")}
          className="w-full sm:w-44"
        />
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`shrink-0 cursor-pointer px-3 py-2 text-sm rounded-lg border transition-colors ${showAdvanced ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
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
                    className="cursor-pointer border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">ทั้งหมด</option>
                    <option value="ดำเนินการแล้ว">ดำเนินการแล้ว</option>
                    <option value="ยังไม่ดำเนินการ">ยังไม่ดำเนินการ</option>
                    <option value="ไม่พบบัญชี">ไม่พบบัญชี</option>
                    <option value="ไม่ทราบสถานะ">ไม่ทราบสถานะ</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* สถานะปิดสิทธิ์ */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-500 w-32 shrink-0">สถานะดำเนินการ</span>
            <div className="flex gap-2">
              {[
                { val: "", label: "ทั้งหมด" },
                { val: "closed", label: "✓ ดำเนินการแล้ว" },
                { val: "pending", label: "อยู่ระหว่างดำเนินการ" },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => { setClosedStatus(val); setPage(1); }}
                  className={`cursor-pointer px-3 py-1.5 text-xs rounded-lg border transition-colors ${
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
            <span className="text-xs font-medium text-slate-500 w-32 shrink-0">วันที่ดำเนินการ</span>
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
                className="cursor-pointer border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">ทั้งหมด</option>
                {[...new Set(dataSources.map((d) => d.sourceType))].sort().map((t) => (
                  <option key={t} value={String(t)}>{SOURCE_TYPE_NAMES[t] ?? `ต้นทาง ${t}`}</option>
                ))}
              </select>
              <select
                value={sourceMonthFilter}
                onChange={(e) => { setSourceMonthFilter(e.target.value); setPage(1); }}
                className="cursor-pointer border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">ทุกเดือน</option>
                {[...new Set(dataSources.map((d) => d.month))].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={String(m)}>{THAI_MONTHS[m]}</option>
                ))}
              </select>
              <select
                value={sourceYearFilter}
                onChange={(e) => { setSourceYearFilter(e.target.value); setPage(1); }}
                className="cursor-pointer border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

      {/* Active Filter Badges */}
      {(() => {
        const filters: { label: string; clear: () => void }[] = [];
        if (search) filters.push({ label: `ค้นหา: ${search}`, clear: () => { setSearch(""); setPage(1); } });
        if (bureau) filters.push({ label: `สำนัก: ${bureau}`, clear: () => { setBureau(""); setPage(1); } });
        if (department) filters.push({ label: `กลุ่ม/ฝ่าย: ${department}`, clear: () => { setDepartment(""); setPage(1); } });
        if (position) filters.push({ label: `ตำแหน่ง: ${position}`, clear: () => { setPosition(""); setPage(1); } });
        if (level) filters.push({ label: `ระดับ: ${level}`, clear: () => { setLevel(""); setPage(1); } });
        if (endDateFrom) filters.push({ label: `ครบกำหนด ≥ ${endDateFrom}`, clear: () => { setEndDateFrom(""); setPage(1); } });
        if (endDateTo) filters.push({ label: `ครบกำหนด ≤ ${endDateTo}`, clear: () => { setEndDateTo(""); setPage(1); } });
        if (fmisStatus) filters.push({ label: `FMIS: ${fmisStatus}`, clear: () => { setFmisStatus(""); setPage(1); } });
        if (eMeetingStatus) filters.push({ label: `eMeeting: ${eMeetingStatus}`, clear: () => { setEMeetingStatus(""); setPage(1); } });
        if (softwareStatus) filters.push({ label: `Software: ${softwareStatus}`, clear: () => { setSoftwareStatus(""); setPage(1); } });
        if (phonebookStatus) filters.push({ label: `Phonebook: ${phonebookStatus}`, clear: () => { setPhonebookStatus(""); setPage(1); } });
        if (itDateFrom) filters.push({ label: `วันที่ IT ≥ ${itDateFrom}`, clear: () => { setItDateFrom(""); setPage(1); } });
        if (itDateTo) filters.push({ label: `วันที่ IT ≤ ${itDateTo}`, clear: () => { setItDateTo(""); setPage(1); } });
        if (closedStatus) filters.push({ label: `สถานะ: ${closedStatus}`, clear: () => { setClosedStatus(""); setPage(1); } });
        if (sourceTypeFilter) filters.push({ label: `ต้นทาง: ${SOURCE_TYPE_NAMES[Number(sourceTypeFilter)] ?? sourceTypeFilter}`, clear: () => { setSourceTypeFilter(""); setPage(1); } });
        if (sourceMonthFilter) filters.push({ label: `เดือน: ${THAI_MONTHS[Number(sourceMonthFilter)] ?? sourceMonthFilter}`, clear: () => { setSourceMonthFilter(""); setPage(1); } });
        if (sourceYearFilter) filters.push({ label: `ปี: ${sourceYearFilter}`, clear: () => { setSourceYearFilter(""); setPage(1); } });
        if (filters.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2 items-center px-1 py-2">
            {filters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                {f.label}
                <button onClick={f.clear} className="ml-0.5 cursor-pointer hover:text-blue-900 font-bold leading-none">×</button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 underline ml-1">ล้างทั้งหมด</button>
          </div>
        );
      })()}

      <div className="hidden md:flex items-center justify-end mb-2 px-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M6 12h12M10 18h4" /></svg>
          เรียงตาม: <strong className="font-semibold text-slate-700">{SORT_LABELS[sortBy] ?? sortBy}</strong>
          <span className="text-slate-400">({sortDirectionLabel(sortBy, sortDir)})</span>
        </span>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] min-h-[320px] overflow-auto">
          <table
            className="text-sm border-collapse"
            style={{ tableLayout: "fixed", width: tableWidth }}
          >
            <colgroup>
              {visibleColumnOrder.map((columnIndex) => <col key={columnIndex} style={{ width: colWidths[columnIndex] }} />)}
            </colgroup>
            <thead className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                {visibleColumnOrder.map((i) => {
                  const h = HEADERS[i];
                  const field = SORT_FIELDS[i];
                  const isActive = field && sortBy === field;
                  const isFrozen = i < LOCKED_COLUMN_COUNT;
                  const toggleSort = () => {
                    if (!field) return;
                    if (isActive) setSortDir((direction) => direction === "asc" ? "desc" : "asc");
                    else { setSortBy(field); setSortDir("asc"); }
                    setPage(1);
                  };
                  const sortTitle = field
                    ? isActive
                      ? `กำลังเรียง${sortDir === "asc" ? "จากน้อยไปมาก" : "จากมากไปน้อย"} — คลิกเพื่อสลับลำดับ`
                      : `คลิกเพื่อเรียงตาม${h}`
                    : undefined;
                  return (
                  <th
                    key={i}
                    onClick={toggleSort}
                    onKeyDown={(event) => {
                      if (field && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        toggleSort();
                      }
                    }}
                    tabIndex={field ? 0 : undefined}
                    aria-sort={field ? (isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined}
                    title={sortTitle}
                    style={isFrozen ? { left: i === 0 ? 0 : colWidths[0] } : undefined}
                    className={`px-3 py-3 text-left font-semibold whitespace-nowrap relative select-none overflow-hidden transition-colors ${isFrozen ? "sticky z-40 bg-slate-50" : ""} ${field ? "cursor-pointer hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400" : ""} ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-600"}`}
                  >
                    {i === NAME_COL_INDEX ? (
                      <span className="flex items-center gap-1.5 pr-2">
                        <span className="overflow-hidden text-ellipsis">{h}</span>
                        {field && <span className="ml-auto"><SortIndicator active={Boolean(isActive)} direction={sortDir} /></span>}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 overflow-hidden pr-2">
                        <span className="overflow-hidden text-ellipsis">{h}</span>
                        {field && <SortIndicator active={Boolean(isActive)} direction={sortDir} />}
                      </span>
                    )}
                    {i > 0 && (
                      <ResizeHandle onMouseDown={(e) => startResize(i, e)} />
                    )}
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={visibleColumnOrder.length} className="py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={visibleColumnOrder.length} className="py-12 text-center text-slate-400">ไม่พบข้อมูล</td></tr>
              ) : employees.map((emp, i) => (
                <tr key={emp.id} className="group hover:bg-slate-50 transition-colors">
                  {visibleColumnOrder.map((columnIndex) => renderDesktopCell(emp, i, columnIndex))}
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
                  <div className="flex flex-col items-start">
                    <span className="max-w-full font-semibold text-slate-800 truncate">{emp.nameTh}</span>
                    {isFullyClosed(emp) && <span className="mt-0.5 text-[11px] font-medium text-green-700">✓ ดำเนินการแล้ว</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{emp.nameEn || "-"}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{emp.employeeId}</div>
                </div>
                {canEdit && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditingId(emp.employeeId)}
                      title="แก้ไข"
                      className="inline-flex cursor-pointer items-center justify-center w-8 h-8 rounded-md text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => { setDeleteError(null); setDeleteTarget(emp); }}
                        title="ลบ"
                        className="inline-flex cursor-pointer items-center justify-center w-8 h-8 rounded-md text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
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
                  <span className="text-slate-400 w-24 shrink-0">หน่วยงาน</span>
                  <span className="text-slate-700">{emp.bureau ?? "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">ฝ่าย/กลุ่มงาน</span>
                  <span className="text-slate-700">{emp.department ?? "-"}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-400 w-24 shrink-0">วันพ้นสภาพ</span>
                  <span className="inline-flex flex-col items-start text-slate-700">
                    <span>{formatDate(emp.endDate)}</span>
                    {isFutureEndDate(emp.endDate) && <FutureEndDateLabel />}
                  </span>
                </div>
              </div>

              {/* สถานะการดำเนินงาน — badges เหมือน desktop */}
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs text-slate-400 mb-2 font-medium">สถานะการดำเนินงาน</div>
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
                  {itFields.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-1">
                      <span className="text-xs text-slate-500 shrink-0">{label}</span>
                      {(!value || value === "ไม่พบบัญชี") ? (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">ไม่พบบัญชี</span>
                      ) : value === "ดำเนินการแล้ว" ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">ดำเนินการแล้ว</span>
                      ) : value === "ไม่ทราบสถานะ" ? (
                        <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full whitespace-nowrap">ไม่ทราบสถานะ</span>
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

      {total > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm text-slate-500">
            แสดง {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, total).toLocaleString()} จาก {total.toLocaleString()} รายการ
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-default hover:bg-slate-50 transition-colors cursor-pointer"
              >← ก่อนหน้า</button>

              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm select-none">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[36px] px-2 py-1.5 text-sm border rounded-lg transition-colors cursor-pointer ${
                      p === page
                        ? "bg-blue-600 text-white border-blue-600 font-medium"
                        : "border-slate-300 hover:bg-slate-50 text-slate-700"
                    }`}
                  >{p}</button>
                )
              )}

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 disabled:cursor-default hover:bg-slate-50 transition-colors cursor-pointer"
              >ถัดไป →</button>
            </div>
          )}
        </div>
      )}
      {selectedEmp && <EmployeeDetailModal emp={selectedEmp} onClose={() => setSelectedEmp(null)} />}
      {deleteTarget && (
        <DeleteConfirmModal
          employee={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
          onConfirm={handleDelete}
        />
      )}
      {editingId && (
        <EditRecordModal
          employeeId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); fetchData(); fetchMeta(); }}
        />
      )}
    </AppLayout>
  );
}

function SortIndicator({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  return (
    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${active ? "bg-blue-100 text-blue-700" : "bg-transparent text-slate-400"}`} aria-hidden="true">
      {active ? (
        direction === "asc" ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M18 13l-6 6-6-6" /></svg>
        )
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7 5 4 2 7M5 4v16M16 17l3 3 3-3M19 20V4" /></svg>
      )}
    </span>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseEnter={() => { if (ref.current) ref.current.style.backgroundColor = "#3b82f6"; }}
      onMouseLeave={() => { if (ref.current) ref.current.style.backgroundColor = "#cbd5e1"; }}
      className="absolute right-0 top-1/2 -translate-y-1/2"
      style={{ width: 2, height: "60%", cursor: "col-resize", backgroundColor: "#cbd5e1", borderRadius: 2 }}
    />
  );
}

function FutureEndDateLabel() {
  return (
    <span
      title="ยังไม่ถึงวันที่พ้นสภาพ"
      className="mt-0.5 inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-amber-700"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2v3M16 2v3M3 9h18" />
        <path d="M5 4h14a2 2 0 0 1 2 2v6.5M12 21H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2" />
        <circle cx="17" cy="17" r="4" />
        <path d="M17 15v2l1.5 1" />
      </svg>
      <span>ยังไม่ถึงวันที่พ้นสภาพ</span>
    </span>
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

function ITStatusIcon({ status }: { status: "done" | "pending" | "missing" | "unknown" }) {
  const common = "h-3.5 w-3.5 shrink-0";
  if (status === "done") {
    return <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>;
  }
  if (status === "pending") {
    return <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  }
  if (status === "missing") {
    return <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3.3 2.7-6 6-6 1.3 0 2.5.4 3.5 1.1M16 15l5 5M21 15l-5 5" /></svg>;
  }
  return <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.5 1.1-1.5 2.3M12 17h.01" /></svg>;
}

function ITStatusCell({ value }: { value?: string | null }) {
  if (!value || value === "ไม่พบบัญชี") {
    return (
      <td className="px-2 py-3 text-left overflow-hidden" title="ไม่พบบัญชี">
        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap"><ITStatusIcon status="missing" />ไม่พบบัญชี</span>
      </td>
    );
  }
  if (value === "ไม่ทราบสถานะ") {
    return (
      <td className="px-2 py-3 text-left overflow-hidden" title="ไม่ทราบสถานะ">
        <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full whitespace-nowrap"><ITStatusIcon status="unknown" />ไม่ทราบสถานะ</span>
      </td>
    );
  }
  const isDone = value === "ดำเนินการแล้ว";
  return (
    <td className="px-2 py-3 text-left overflow-hidden" title={value}>
      {isDone ? (
        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap"><ITStatusIcon status="done" />ดำเนินการแล้ว</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full whitespace-nowrap"><ITStatusIcon status="pending" />ยังไม่ดำเนินการ</span>
      )}
    </td>
  );
}

function ITBadge({ value }: { value?: string | null }) {
  if (!value || value === "ไม่พบบัญชี") {
    return <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full"><ITStatusIcon status="missing" />ไม่พบบัญชี</span>;
  }
  if (value === "ไม่ทราบสถานะ") {
    return <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full"><ITStatusIcon status="unknown" />ไม่ทราบสถานะ</span>;
  }
  return value === "ดำเนินการแล้ว" ? (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><ITStatusIcon status="done" />ดำเนินการแล้ว</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full"><ITStatusIcon status="pending" />ยังไม่ดำเนินการ</span>
  );
}

function DeleteConfirmModal({
  employee,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  employee: Employee;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleting, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onCancel(); }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="delete-confirm-title" className="text-lg font-bold text-slate-800">ยืนยันการลบข้อมูล</h2>
              <p id="delete-confirm-description" className="mt-1 text-sm leading-6 text-slate-500">
                คุณต้องการลบข้อมูลพนักงานรายการนี้ใช่หรือไม่
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="truncate font-semibold text-slate-800" title={employee.nameTh}>{employee.nameTh}</p>
            <p className="mt-0.5 text-sm text-slate-500">รหัสพนักงาน: <span className="font-mono text-slate-700">{employee.employeeId}</span></p>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
            <span>รายการนี้จะถูกย้ายไปถังขยะ และมีเพียง Super Admin ที่สามารถกู้คืนได้</span>
          </div>

          {error && (
            <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="delete-reason">
            เหตุผลในการลบ <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
          </label>
          <textarea
            id="delete-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 500))}
            disabled={deleting}
            rows={3}
            placeholder="ระบุเหตุผลเพื่อใช้อ้างอิงในภายหลัง"
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
          <div className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/500</div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={deleting}
            className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:bg-red-400"
          >
            {deleting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            {deleting ? "กำลังลบ..." : "ยืนยันการลบ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeDetailModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  // Close on ESC
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Escape") onClose(); };

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-600 text-xs w-36 shrink-0">{label}</span>
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
                  ✓ ดำเนินการแล้ว
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 font-mono mt-1">รหัส {emp.employeeId}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 cursor-pointer flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ข้อมูลทั่วไป */}
          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">ข้อมูลทั่วไป</h3>
            <Row label="ชื่อ-สกุล (อังกฤษ)" value={emp.nameEn} />
            <Row label="ข้อมูลต้นทาง" value={formatDataSource(emp.dataSource)} />
          </section>

          {/* ตำแหน่ง */}
          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">ตำแหน่งงาน</h3>
            <Row label="ตำแหน่ง" value={emp.position} />
            <Row label="ประเภท" value={emp.level} />
            <Row label="ฝ่าย/กลุ่มงาน" value={emp.department} />
            <Row label="หน่วยงาน/สำนัก" value={emp.bureau} />
          </section>

          {/* วันที่ */}
          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">วันที่</h3>
            <Row label="วันที่พ้นสภาพ" value={formatDate(emp.endDate)} />
            <Row label="Email" value={emp.email} />
            <Row label="วันที่ได้รับข้อมูล" value={formatDate(emp.receivedDate)} />
          </section>

          {/* สถานะการดำเนินงาน */}
          <section>
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">สถานะการดำเนินงาน</h3>
            <div className="space-y-2">
              {([
                ["FMIS",      emp.fmis,      emp.fmisDate],
                ["eMeeting",  emp.eMeeting, emp.eMeetingDate],
                ["Software",  emp.software, emp.softwareDate],
                ["Phonebook", emp.phonebook, emp.phonebookDate],
              ] as [string, string | undefined, string | undefined][]).map(([label, val, dateVal]) => (
                <div key={label} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-600 w-36 shrink-0">{label}</span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {val === "ดำเนินการแล้ว" && (
                      <span className="text-xs text-slate-600">
                        {dateVal ? formatDate(dateVal) : "ไม่ทราบวันที่"}
                      </span>
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
