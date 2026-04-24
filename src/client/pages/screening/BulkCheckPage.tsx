import { AppLayout } from "../../components/AppLayout";
import { useRef, useState } from "react";
import { authHeaders } from "../../lib/api";

interface BulkResult {
  query: string;
  found: boolean;
  employee?: { nameTh: string; bureau?: string; endDate?: string };
}

export default function BulkCheckPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheck() {
    if (!file) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/screening/bulk", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResults(data.results);
    } else {
      setError(data.error ?? "เกิดข้อผิดพลาด");
    }
  }

  const found = results?.filter((r) => r.found).length ?? 0;
  const notFound = results?.filter((r) => !r.found).length ?? 0;

  function formatDate(d?: string | null) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("th-TH");
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">ค้นหาข้อมูลผู้พ้นสภาพกลุ่มบุคคล</h1>
          <p className="text-slate-500 text-sm mt-1">อัปโหลด Excel ที่มีรายชื่อหรือรหัสประจำตัว เพื่อค้นหาข้อมูลผู้พ้นสภาพพร้อมกัน</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-1">📋 รูปแบบไฟล์:</p>
            <p className="text-xs text-blue-600">ไฟล์ Excel ที่มีคอลัมน์ชื่อ <code className="bg-blue-100 px-1 rounded">ชื่อ</code> หรือ <code className="bg-blue-100 px-1 rounded">รหัส</code> หรือ <code className="bg-blue-100 px-1 rounded">name</code> หรือ <code className="bg-blue-100 px-1 rounded">id</code></p>
          </div>
          <a
            href="/bulk_check_template.xlsx"
            download
            className="shrink-0 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            ⬇️ ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-3xl mb-2">📑</div>
            {file ? (
              <p className="font-medium text-slate-700">{file.name}</p>
            ) : (
              <p className="text-slate-500 text-sm">คลิกเพื่อเลือกไฟล์ Excel</p>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCheck}
              disabled={!file || loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "กำลังตรวจสอบ..." : "🔍 ตรวจสอบ"}
            </button>
          </div>
        </div>

        {results && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                <div className="text-2xl font-bold text-slate-700">{results.length}</div>
                <div className="text-xs text-slate-500 mt-1">ทั้งหมด</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200">
                <div className="text-2xl font-bold text-red-600">{found}</div>
                <div className="text-xs text-red-500 mt-1">พบข้อมูลในระบบ</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                <div className="text-2xl font-bold text-slate-600">{notFound}</div>
                <div className="text-xs text-slate-500 mt-1">ไม่พบข้อมูลในระบบ</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">คำค้นหา</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">ชื่อในระบบ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">หน่วยงาน</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">วันพ้นสภาพ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, i) => (
                    <tr key={i} className={r.found ? "bg-red-50" : ""}>
                      <td className="px-4 py-3 font-medium text-slate-700">{r.query}</td>
                      <td className="px-4 py-3 text-slate-600">{r.employee?.nameTh ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{r.employee?.bureau ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(r.employee?.endDate)}</td>
                      <td className="px-4 py-3">
                        {r.found ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full">⚠️ พบข้อมูล</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">— ไม่พบข้อมูล</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
