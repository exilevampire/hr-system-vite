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

interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
  updatedDetails: UpdatedDetail[];
}

export default function ImportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showUpdated, setShowUpdated] = useState(false);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { navigate("/records/all"); return; }
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [countdown, navigate]);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    setShowUpdated(false);

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
      setCountdown(60);
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
            <p className="font-semibold mb-2">📋 รูปแบบไฟล์ Excel ที่รองรับ (Template ใหม่):</p>
            <p className="text-xs text-blue-600 font-mono">
              ข้อมูลต้นทาง | เดือน | ปี | วันที่ได้รับข้อมูล | รหัสประจำตัว | ชื่อ-สกุล | Name-Eng | ตำแหน่ง | ประเภท | ฝ่าย/กลุ่ม/งาน | หน่วยงาน | วันที่พ้นสภาพ | อีเมล
            </p>
            <p className="text-xs text-blue-500 mt-1.5">
              คอลัมน์ที่ต้องมี: <span className="font-semibold">รหัสประจำตัว</span> และ <span className="font-semibold">ชื่อ-สกุล</span> (คอลัมน์อื่นเป็น optional)
            </p>
            <p className="text-xs text-blue-400 mt-0.5">
              ถ้ารหัสพนักงานมีอยู่แล้ว ระบบจะอัปเดตข้อมูลทั่วไปอัตโนมัติ (สถานะการดำเนินงานจะไม่ถูกแตะ)
            </p>
            <p className="text-xs text-blue-400 mt-0.5">
              ชื่อหัวคอลัมน์ Email รองรับ: <span className="font-mono">อีเมล</span> / <span className="font-mono">email</span> / <span className="font-mono">e-mail</span>
            </p>
          </div>
          <a
            href="/Import_Template.xlsx"
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
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
              {/* Header */}
              <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                <p className="font-semibold text-green-700">✅ นำเข้าสำเร็จ</p>
              </div>

              {/* Summary grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-green-100">
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.created}</p>
                  <p className="text-xs text-slate-500 mt-0.5">สร้างใหม่</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{result.updated}</p>
                  <p className="text-xs text-slate-500 mt-0.5">อัปเดตข้อมูล</p>
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

              {/* Updated details */}
              {result.updatedDetails.length > 0 && (
                <div className="border-t border-green-100">
                  <button
                    onClick={() => setShowUpdated((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <span className="font-medium">รายการที่อัปเดต ({result.updatedDetails.length} รายการ)</span>
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

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="border-t border-red-100 px-4 py-3 bg-red-50">
                  <p className="text-xs font-medium text-red-600 mb-1">ข้อผิดพลาด:</p>
                  <ul className="list-disc list-inside text-red-500 text-xs space-y-0.5">
                    {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {/* Countdown */}
              {countdown !== null && (
                <div className="border-t border-green-200 px-4 py-3 bg-green-50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs text-green-600">
                      นำทางไปหน้าข้อมูลพ้นสภาพใน <span className="font-bold text-green-700">{countdown}</span> วินาที...
                    </p>
                    <button
                      onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); navigate("/records/all"); }}
                      className="shrink-0 text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ไปเลย →
                    </button>
                  </div>
                  <div className="w-full h-1.5 bg-green-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(countdown / 60) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-end">
            {result ? (
              <button
                onClick={() => {
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  setResult(null); setFile(null); setCountdown(null); setShowUpdated(false);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                นำเข้าไฟล์ใหม่
              </button>
            ) : (
              <button onClick={() => navigate(-1)}
                className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
            )}
            <button onClick={handleImport} disabled={!file || loading || !!result}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg transition-colors">
              {loading ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
