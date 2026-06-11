import { AppLayout } from "../components/AppLayout";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../lib/api";
import { ThaiDatePicker } from "../components/ThaiDatePicker";

// ── Searchable dropdown ──────────────────────────────────────────────────────
function SearchableSelect({
  placeholder, value, onChange, options, className = "",
}: {
  placeholder: string; value: string; onChange: (val: string) => void;
  options: string[]; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(value); }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, value]);

  const filtered = options.filter((o) => !query || o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {value ? (
          <button type="button" onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 text-base leading-none">×</button>
        ) : (
          <span className="absolute right-2 text-slate-400 text-xs pointer-events-none">▾</span>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((opt) => (
            <button key={opt} type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setQuery(opt); setOpen(false); }}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${opt === value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
interface DataSourceInfo { id: number; sourceType: number; month: number; year: number; }
const SOURCE_TYPE_NAMES: Record<number, string> = { 1: "สบค.", 2: "ศล." };
const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function toBEDisplay(iso: string) {
  if (!iso) return "";
  const p = iso.split("-");
  if (p.length < 3) return iso;
  return `${parseInt(p[2])}/${parseInt(p[1])}/${parseInt(p[0]) + 543}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ReportPage() {
  // meta
  const [positionOptions, setPositionOptions]   = useState<string[]>([]);
  const [levelOptions, setLevelOptions]         = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [bureauOptions, setBureauOptions]       = useState<string[]>([]);
  const [dataSources, setDataSources]           = useState<DataSourceInfo[]>([]);

  // filters — main bar
  const [search,     setSearch]     = useState("");
  const [position,   setPosition]   = useState("");
  const [level,      setLevel]      = useState("");
  const [department, setDepartment] = useState("");
  const [bureau,     setBureau]     = useState("");

  // filters — advanced
  const [showAdvanced,    setShowAdvanced]    = useState(false);
  const [endDateFrom,     setEndDateFrom]     = useState("");
  const [endDateTo,       setEndDateTo]       = useState("");
  const [fmisStatus,      setFmisStatus]      = useState("");
  const [eMeetingStatus,  setEMeetingStatus]  = useState("");
  const [softwareStatus,  setSoftwareStatus]  = useState("");
  const [phonebookStatus, setPhonebookStatus] = useState("");
  const [itDateFrom,      setItDateFrom]      = useState("");
  const [itDateTo,        setItDateTo]        = useState("");
  const [sourceTypeFilter,  setSourceTypeFilter]  = useState("");
  const [sourceMonthFilter, setSourceMonthFilter] = useState("");
  const [sourceYearFilter,  setSourceYearFilter]  = useState("");
  const [closedStatus, setClosedStatus] = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    apiFetch("/api/employees/meta").then((r) => r.json()).then((d) => {
      setPositionOptions(d.positions ?? []);
      setLevelOptions(d.levels ?? []);
      setDepartmentOptions(d.departments ?? []);
      setBureauOptions(d.bureaus ?? []);
    }).catch(() => {});
    apiFetch("/api/datasources").then((r) => r.json()).then((d) => {
      setDataSources(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, []);

  function handleReset() {
    setSearch(""); setPosition(""); setLevel(""); setDepartment(""); setBureau("");
    setEndDateFrom(""); setEndDateTo("");
    setFmisStatus(""); setEMeetingStatus(""); setSoftwareStatus(""); setPhonebookStatus("");
    setItDateFrom(""); setItDateTo("");
    setSourceTypeFilter(""); setSourceMonthFilter(""); setSourceYearFilter("");
    setClosedStatus("");
    setError("");
  }

  const hasFilter = !!(search || position || level || department || bureau ||
    endDateFrom || endDateTo || fmisStatus || eMeetingStatus || softwareStatus || phonebookStatus ||
    itDateFrom || itDateTo || sourceTypeFilter || sourceMonthFilter || sourceYearFilter || closedStatus);

  async function handleDownload() {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search, bureau, position, level, department,
        endDateFrom, endDateTo,
        fmisStatus, eMeetingStatus, softwareStatus, phonebookStatus,
        itDateFrom, itDateTo,
        sourceType: sourceTypeFilter,
        sourceMonth: sourceMonthFilter,
        sourceYear: sourceYearFilter,
        closedStatus,
      });

      const res = await apiFetch(`/api/reports/employees?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "เกิดข้อผิดพลาด");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      a.href = url;
      a.download = `HR_Report_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("ไม่สามารถดาวน์โหลดรายงานได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">รายงาน Excel</h1>
          <p className="text-slate-500 text-sm mt-1">สร้างและดาวน์โหลดรายงานข้อมูลพนักงานพ้นสภาพ</p>
        </div>
        {hasFilter && (
          <button onClick={handleReset}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* ── Main filter bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text" placeholder="ค้นหารหัส / ชื่อ-สกุล (ไทย / อังกฤษ)..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <SearchableSelect placeholder="กรองตำแหน่ง..."   value={position}   onChange={setPosition}   options={positionOptions}   className="w-full sm:w-48" />
          <SearchableSelect placeholder="กรองประเภท..."    value={level}      onChange={setLevel}      options={levelOptions}      className="w-full sm:w-40" />
          <SearchableSelect placeholder="กรองฝ่าย/กลุ่มงาน..." value={department} onChange={setDepartment} options={departmentOptions} className="w-full sm:w-52" />
          <SearchableSelect placeholder="กรองหน่วยงาน..."  value={bureau}     onChange={setBureau}     options={bureauOptions}     className="w-full sm:w-52" />
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={`shrink-0 px-3 py-2 text-sm rounded-lg border transition-colors ${showAdvanced ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
          >
            {showAdvanced ? "ซ่อนตัวกรอง ▲" : "ตัวกรองเพิ่มเติม ▼"}
          </button>
        </div>

        {/* ── Advanced filters ── */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {/* วันที่พ้นสภาพ */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500 w-32 shrink-0">วันที่พ้นสภาพ</span>
              <div className="flex flex-wrap items-center gap-2">
                <ThaiDatePicker value={endDateFrom} onChange={setEndDateFrom} className="w-48" />
                <span className="text-slate-400 text-sm">ถึง</span>
                <ThaiDatePicker value={endDateTo} onChange={setEndDateTo} className="w-48" />
              </div>
            </div>

            {/* IT status */}
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-xs font-medium text-slate-500 w-32 shrink-0 mt-1.5">สถานะการดำเนินงาน</span>
              <div className="flex flex-wrap gap-2">
                {([
                  ["FMIS",     fmisStatus,      setFmisStatus],
                  ["eMeeting", eMeetingStatus,  setEMeetingStatus],
                  ["Software", softwareStatus,  setSoftwareStatus],
                  ["Phonebook",phonebookStatus, setPhonebookStatus],
                ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-slate-400 px-1">{label}</span>
                    <select value={val} onChange={(e) => setter(e.target.value)}
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
                  { val: "",        label: "ทั้งหมด" },
                  { val: "closed",  label: "✓ ปิดแล้ว" },
                  { val: "pending", label: "ยังไม่ปิด" },
                ].map(({ val, label }) => (
                  <button key={val} type="button" onClick={() => setClosedStatus(val)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      closedStatus === val
                        ? val === "closed" ? "bg-green-600 border-green-600 text-white"
                          : val === "pending" ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-slate-700 border-slate-700 text-white"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* IT date range */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500 w-32 shrink-0">วันที่ดำเนินการ IT</span>
              <div className="flex flex-wrap items-center gap-2">
                <ThaiDatePicker value={itDateFrom} onChange={setItDateFrom} className="w-48" />
                <span className="text-slate-400 text-sm">ถึง</span>
                <ThaiDatePicker value={itDateTo} onChange={setItDateTo} className="w-48" />
              </div>
            </div>

            {/* DataSource */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-500 w-32 shrink-0">ข้อมูลต้นทาง</span>
              <div className="flex flex-wrap gap-2">
                <select value={sourceTypeFilter} onChange={(e) => setSourceTypeFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">ทั้งหมด</option>
                  {[...new Set(dataSources.map((d) => d.sourceType))].sort().map((t) => (
                    <option key={t} value={String(t)}>{SOURCE_TYPE_NAMES[t] ?? `ต้นทาง ${t}`}</option>
                  ))}
                </select>
                <select value={sourceMonthFilter} onChange={(e) => setSourceMonthFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">ทุกเดือน</option>
                  {[...new Set(dataSources.map((d) => d.month))].sort((a, b) => a - b).map((m) => (
                    <option key={m} value={String(m)}>{THAI_MONTHS[m]}</option>
                  ))}
                </select>
                <select value={sourceYearFilter} onChange={(e) => setSourceYearFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">ทุกปี</option>
                  {[...new Set(dataSources.map((d) => d.year))].sort((a, b) => b - a).map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Active filter chips ── */}
      {hasFilter && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-amber-700">ตัวกรองที่ใช้:</span>
          {search      && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ค้นหา: {search}</span>}
          {position    && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ตำแหน่ง: {position}</span>}
          {level       && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ประเภท: {level}</span>}
          {department  && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ฝ่าย: {department}</span>}
          {bureau      && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">หน่วยงาน: {bureau}</span>}
          {endDateFrom && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">พ้นสภาพตั้งแต่ {toBEDisplay(endDateFrom)}</span>}
          {endDateTo   && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">พ้นสภาพถึง {toBEDisplay(endDateTo)}</span>}
          {fmisStatus      && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">FMIS: {fmisStatus}</span>}
          {eMeetingStatus  && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">eMeeting: {eMeetingStatus}</span>}
          {softwareStatus  && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Software: {softwareStatus}</span>}
          {phonebookStatus && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Phonebook: {phonebookStatus}</span>}
          {itDateFrom  && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">IT ตั้งแต่ {toBEDisplay(itDateFrom)}</span>}
          {itDateTo    && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">IT ถึง {toBEDisplay(itDateTo)}</span>}
          {sourceTypeFilter  && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ต้นทาง: {SOURCE_TYPE_NAMES[Number(sourceTypeFilter)] ?? sourceTypeFilter}</span>}
          {sourceMonthFilter && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">เดือน: {THAI_MONTHS[Number(sourceMonthFilter)]}</span>}
          {sourceYearFilter  && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ปี: {sourceYearFilter}</span>}
          {closedStatus === "closed"  && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full">✓ ปิดแล้ว</span>}
          {closedStatus === "pending" && <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">ยังไม่ปิด</span>}
        </div>
      )}

      {/* ── Report info + download ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <span className="text-xl">📊</span>
          รายงานข้อมูลพนักงานพ้นสภาพ
        </h2>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-blue-600 text-lg flex-shrink-0">📋</span>
            <div>
              <div className="text-sm font-medium text-blue-800">Sheet 1: รายงานพนักงาน</div>
              <div className="text-xs text-blue-600 mt-0.5">รายชื่อพนักงานพร้อมข้อมูลครบถ้วน — รหัส, ชื่อ, ตำแหน่ง, หน่วยงาน, วันพ้นสภาพ, สถานะการดำเนินงาน</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
            <span className="text-purple-600 text-lg flex-shrink-0">📈</span>
            <div>
              <div className="text-sm font-medium text-purple-800">Sheet 2: สรุปตามหน่วยงาน</div>
              <div className="text-xs text-purple-600 mt-0.5">จำนวนพนักงานแต่ละหน่วยงาน พร้อมสถานะการดำเนินงาน และเปอร์เซ็นต์</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-blue-900 hover:bg-blue-800 active:bg-blue-950 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-base rounded-xl shadow-md transition-all"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              กำลังสร้างรายงาน...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              ดาวน์โหลดรายงาน Excel (.xlsx)
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-400 mt-3">
          ไฟล์ Excel จะดาวน์โหลดอัตโนมัติ — ใช้ Microsoft Excel หรือ Google Sheets เปิดได้
        </p>
      </div>
    </AppLayout>
  );
}
