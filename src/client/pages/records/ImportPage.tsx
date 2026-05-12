import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import { authHeaders } from "../../lib/api";

interface ImportResult {
  success: number;
  skipped: number;
  errors: string[];
}

export default function ImportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("adminUser", user?.email ?? "unknown");

    const res = await fetch("/api/employees/import", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data);
    } else {
      setError(data.error ?? "เกิดข้อผิดพลาด");
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">นำเข้าข้อมูล Excel</h1>
          <p className="text-slate-500 text-sm mt-1">อัปโหลดไฟล์ Excel เพื่อนำเข้าข้อมูลพนักงานหลายรายการพร้อมกัน</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-2">📋 รูปแบบไฟล์ Excel ที่รองรับ:</p>
            <p className="text-xs text-blue-600 font-mono">
              รหัสประจำตัว | ชื่อ-สกุล | Name-Eng | ตำแหน่ง | ระดับตำแหน่ง | ฝ่าย/กลุ่มงาน | หน่วยงาน/สำนัก | วันเริ่มงาน | วันที่พ้นสภาพ | วันที่ได้รับข้อมูล | หมายเหตุ | email | FMIS | eMeeting | Website | 3CX | intranet | บค. ส่ง
            </p>
            <p className="text-xs text-blue-500 mt-1.5">
              ⚠️ คอลัมน์ FMIS, eMeeting, Website, 3CX, intranet รับเฉพาะ <span className="font-semibold">ดำเนินการแล้ว</span> หรือ <span className="font-semibold">ยังไม่ดำเนินการ</span> เท่านั้น (ค่าอื่นจะถูกละเว้น)
            </p>
          </div>
          <a
            href="/employee_import_template.xlsx"
            download
            className="shrink-0 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            ⬇️ ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-4xl mb-3">📄</div>
            {file ? (
              <div>
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-sm text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-slate-600">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
                <p className="text-sm text-slate-400 mt-1">รองรับไฟล์ .xlsx และ .xls</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="font-semibold text-green-700 mb-2">✅ นำเข้าสำเร็จ</p>
              <div className="text-sm text-green-600 space-y-1">
                <p>นำเข้าสำเร็จ: {result.success} รายการ</p>
                <p>ข้ามรายการซ้ำ: {result.skipped} รายการ</p>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-600 font-medium">ข้อผิดพลาด:</p>
                    <ul className="list-disc list-inside text-red-500 text-xs mt-1">
                      {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg transition-colors"
            >
              {loading ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
