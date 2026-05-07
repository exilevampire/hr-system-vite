import { AppLayout } from "../components/AppLayout";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface Filters {
  dateFrom: string;
  dateTo: string;
  bureau: string;
  itStatus: string;
}

export default function ReportPage() {
  const [bureaus, setBureaus] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({ dateFrom: "", dateTo: "", bureau: "all", itStatus: "all" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/reports/meta")
      .then((r) => r.json())
      .then((d) => setBureaus(d.bureaus ?? []));
  }, []);

  function setFilter<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }

  async function handleDownload() {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.bureau && filters.bureau !== "all") params.set("bureau", filters.bureau);
      if (filters.itStatus && filters.itStatus !== "all") params.set("itStatus", filters.itStatus);

      const res = await apiFetch(`/api/reports/employees?${params.toString()}`);
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

  function handleReset() {
    setFilters({ dateFrom: "", dateTo: "", bureau: "all", itStatus: "all" });
    setError("");
  }

  const hasFilter = filters.dateFrom || filters.dateTo || filters.bureau !== "all" || filters.itStatus !== "all";

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">รายงาน Excel</h1>
        <p className="text-slate-500 text-sm mt-1">สร้างและดาวน์โหลดรายงานข้อมูลพนักงานพ้นสภาพในรูปแบบ Excel</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filter panel */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">ตัวกรองข้อมูล</h2>
              {hasFilter && (
                <button
                  onClick={handleReset}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>

            {/* Date range */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">ช่วงวันพ้นสภาพ</label>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ตั้งแต่วันที่</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">ถึงวันที่</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Bureau */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">หน่วยงาน/สำนัก</label>
              <select
                value={filters.bureau}
                onChange={(e) => setFilter("bureau", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="all">ทุกหน่วยงาน</option>
                {bureaus.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* IT status */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">สถานะ IT</label>
              <div className="space-y-2">
                {[
                  { val: "all", label: "ทั้งหมด" },
                  { val: "cleared", label: "ปิดสิทธิ์แล้ว" },
                  { val: "pending", label: "ยังไม่ปิดสิทธิ์" },
                ].map((opt) => (
                  <label key={opt.val} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="itStatus"
                      value={opt.val}
                      checked={filters.itStatus === opt.val}
                      onChange={() => setFilter("itStatus", opt.val)}
                      className="accent-blue-600 w-4 h-4"
                    />
                    <span className="text-sm text-slate-600 group-hover:text-slate-800">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Download panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Report description */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="text-xl">📊</span>
              รายงานข้อมูลพนักงานพ้นสภาพ
            </h2>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-blue-600 text-lg flex-shrink-0">📋</span>
                <div>
                  <div className="text-sm font-medium text-blue-800">Sheet 1: รายงานพนักงาน</div>
                  <div className="text-xs text-blue-600 mt-0.5">รายชื่อพนักงานพร้อมข้อมูลครบถ้วน — รหัส, ชื่อ, ตำแหน่ง, หน่วยงาน, วันพ้นสภาพ, สถานะ IT</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <span className="text-purple-600 text-lg flex-shrink-0">📈</span>
                <div>
                  <div className="text-sm font-medium text-purple-800">Sheet 2: สรุปตามหน่วยงาน</div>
                  <div className="text-xs text-purple-600 mt-0.5">จำนวนพนักงานแต่ละหน่วยงาน พร้อมสถานะการปิดสิทธิ์ IT และเปอร์เซ็นต์</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-200 border border-green-400 inline-block flex-shrink-0"></span>
                ปิดสิทธิ์แล้ว
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400 inline-block flex-shrink-0"></span>
                ยังไม่ปิด
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300 inline-block flex-shrink-0"></span>
                แถวคู่
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-white border border-slate-300 inline-block flex-shrink-0"></span>
                แถวคี่
              </div>
            </div>
          </div>

          {/* Active filters summary */}
          {hasFilter && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-amber-700">ตัวกรองที่ใช้:</span>
              {filters.dateFrom && (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ตั้งแต่ {filters.dateFrom}</span>
              )}
              {filters.dateTo && (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">ถึง {filters.dateTo}</span>
              )}
              {filters.bureau !== "all" && (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{filters.bureau}</span>
              )}
              {filters.itStatus !== "all" && (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {filters.itStatus === "cleared" ? "ปิดสิทธิ์แล้ว" : "ยังไม่ปิดสิทธิ์"}
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {/* Download button */}
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

          <p className="text-center text-xs text-slate-400">
            ไฟล์ Excel จะดาวน์โหลดอัตโนมัติ — ใช้ Microsoft Excel หรือ Google Sheets เปิดได้
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
