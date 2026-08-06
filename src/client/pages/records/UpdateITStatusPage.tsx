import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { authHeaders } from "../../lib/api";

interface UpdatedDetail {
  employeeId: string;
  nameTh: string;
  changedFields: string[];
}

interface UpdateResult {
  updated: number;
  unchanged: number;
  errors: string[];
  updatedDetails: UpdatedDetail[];
}

export default function UpdateITStatusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [error, setError] = useState("");
  const [showUpdated, setShowUpdated] = useState(false);

  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN") navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    setShowUpdated(false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("adminUser", user?.email ?? "unknown");

    const res = await fetch("/api/employees/update-it-status", {
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
          <h1 className="text-2xl font-bold text-slate-800">อัพเดตสถานะดำเนินการ IT</h1>
          <p className="text-slate-500 text-sm mt-1">อัพโหลดไฟล์ Excel เพื่ออัพเดตสถานะ FMIS / eMeeting / Software / Phonebook</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-2">📋 รูปแบบไฟล์ Excel ที่รองรับ:</p>
            <p className="text-xs text-amber-700 font-mono">
              รหัสประจำตัว | FMIS | วันที่ FMIS | eMeeting | วันที่ eMeeting | Software | วันที่ Software | Phonebook | วันที่ Phonebook
            </p>
            <p className="text-xs text-amber-600 mt-1.5">
              สถานะที่รองรับ: <span className="font-semibold">ดำเนินการแล้ว / ยังไม่ดำเนินการ / ไม่พบบัญชี / ไม่ทราบสถานะ</span>
            </p>
            <p className="text-xs text-amber-500 mt-0.5">
              ปล่อยว่าง = ไม่เปลี่ยนแปลงค่าเดิม &nbsp;|&nbsp; วันที่ดำเนินการ: วว/ดด/ปปปป (พ.ศ.) หรือปล่อยว่าง (auto-fill วันนี้)
            </p>
          </div>
          <a
            href="/IT_Status_Template.xlsx"
            download
            className="shrink-0 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            ⬇️ ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-amber-400 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
          >
            <div className="text-4xl mb-3">📊</div>
            {file ? (
              <div>
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-sm text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-slate-600">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
                <p className="text-sm text-slate-400 mt-1">รองรับไฟล์ .xlsx, .xls และ .csv</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {result && (
            <div className="mt-4 rounded-xl border border-green-200 overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                <p className="font-semibold text-green-700">✅ อัพเดตสำเร็จ</p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-green-100">
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{result.updated}</p>
                  <p className="text-xs text-slate-500 mt-0.5">อัพเดตแล้ว</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-slate-400">{result.unchanged}</p>
                  <p className="text-xs text-slate-500 mt-0.5">ไม่มีการเปลี่ยน</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-red-500">{result.errors.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">ข้อผิดพลาด</p>
                </div>
              </div>

              {result.updatedDetails.length > 0 && (
                <div className="border-t border-green-100">
                  <button
                    onClick={() => setShowUpdated((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <span className="font-medium">รายการที่อัพเดต ({result.updatedDetails.length} รายการ)</span>
                    <span>{showUpdated ? "▲" : "▼"}</span>
                  </button>
                  {showUpdated && (
                    <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {result.updatedDetails.map((d) => (
                        <li key={d.employeeId} className="px-4 py-2 flex items-start gap-3">
                          <span className="text-xs font-mono text-slate-400 shrink-0 mt-0.5">{d.employeeId}</span>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 font-medium truncate">{d.nameTh}</p>
                            <p className="text-xs text-amber-600 mt-0.5">{d.changedFields.join(", ")}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="border-t border-red-100 px-4 py-3 bg-red-50">
                  <p className="text-xs font-medium text-red-600 mb-1">ข้อผิดพลาด:</p>
                  <ul className="list-disc list-inside text-red-500 text-xs space-y-0.5">
                    {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-end">
            {result ? (
              <button
                onClick={() => { setResult(null); setFile(null); setShowUpdated(false); if (fileRef.current) fileRef.current.value = ""; }}
                className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                อัพโหลดไฟล์ใหม่
              </button>
            ) : (
              <button onClick={() => navigate(-1)}
                className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
            )}
            <button onClick={handleUpload} disabled={!file || loading || !!result}
              className="px-5 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg transition-colors">
              {loading ? "กำลังอัพเดต..." : "อัพเดตสถานะ"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
