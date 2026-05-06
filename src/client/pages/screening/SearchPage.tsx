import { AppLayout } from "../../components/AppLayout";
import { useState } from "react";
import { apiFetch } from "../../lib/api";

interface SearchResult {
  found: boolean;
  employee?: {
    employeeId: string;
    nameTh: string;
    nameEn?: string;
    position?: string;
    bureau?: string;
    endDate?: string;
    remarks?: string;
    fmis?: string;
    eMeeting?: string;
    website?: string;
    phone3cx?: string;
    intranet?: string;
    hrSent?: string;
  };
}

const itFields = [
  { key: "fmis", label: "FMIS" },
  { key: "eMeeting", label: "eMeeting" },
  { key: "website", label: "Website" },
  { key: "phone3cx", label: "3CX" },
  { key: "intranet", label: "Intranet" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const res = await apiFetch(`/api/screening?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  function formatDate(d?: string | null) {
    if (!d) return "-";
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("th-TH");
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">ค้นหาข้อมูลผู้พ้นสภาพรายบุคคล</h1>
          <p className="text-slate-500 text-sm mt-1">ค้นหาด้วยชื่อ-สกุล (ไทย/อังกฤษ) หรือรหัสประจำตัว</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ระบุชื่อหรือรหัสประจำตัว..."
            className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "กำลังค้นหา..." : "🔍 ค้นหา"}
          </button>
        </form>

        {result && (
          <>
            {!result.found ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-lg font-bold text-slate-700 mb-2">ไม่พบข้อมูลในระบบ</h2>
                <p className="text-slate-500 text-sm">ไม่พบข้อมูลบุคคลนี้ในระบบจัดเก็บข้อมูลผู้พ้นสภาพ</p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-4xl">⚠️</div>
                  <div>
                    <h2 className="text-lg font-bold text-red-700">พบข้อมูลในระบบ</h2>
                    <p className="text-red-600 text-sm mt-1">บุคคลนี้มีข้อมูลการพ้นสภาพอยู่ในระบบ</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 space-y-3">
                  <Row label="รหัสพนักงาน" value={result.employee?.employeeId} />
                  <Row label="ชื่อ-สกุล (ไทย)" value={result.employee?.nameTh} />
                  <Row label="ชื่อ-สกุล (อังกฤษ)" value={result.employee?.nameEn} />
                  <Row label="ตำแหน่ง" value={result.employee?.position} />
                  <Row label="หน่วยงาน" value={result.employee?.bureau} />
                  <Row label="วันที่พ้นสภาพ" value={formatDate(result.employee?.endDate)} />
                  <Row label="บค. ส่ง" value={formatDate(result.employee?.hrSent)} />
                  {result.employee?.remarks && (
                    <Row label="หมายเหตุ" value={result.employee.remarks} highlight />
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">สถานะการปิดสิทธิ์ IT</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {itFields.map((f) => {
                      const val = result.employee?.[f.key as keyof typeof result.employee];
                      const isDone = val === "ดำเนินการแล้ว";
                      return (
                        <div
                          key={f.key}
                          className={`rounded-lg p-3 text-center text-sm ${isDone ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                        >
                          <div className="font-medium">{f.label}</div>
                          <div className="text-xs mt-1">{isDone ? "ดำเนินการแล้ว" : "ยังไม่ดำเนินการ"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Row({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-slate-500 w-40 shrink-0">{label}</span>
      <span className={`font-medium ${highlight ? "text-red-700" : "text-slate-800"}`}>{value || "-"}</span>
    </div>
  );
}
