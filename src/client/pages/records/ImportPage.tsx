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

const IMPORT_DROPDOWN_LABELS = [
  "ข้อมูลต้นทาง",
  "เดือน",
  "ประเภท",
  "หน่วยงาน/สำนัก",
  "สถานะระบบ IT",
] as const;

export default function ImportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showUpdated, setShowUpdated] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { navigate("/records/all"); return; }
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [countdown, navigate]);

  const MAX_FILES = 20;

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...allowed.filter((f) => !existing.has(f.name))];
    });
  }

  const tooManyFiles = files.length > MAX_FILES;

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function downloadTemplate() {
    setTemplateDownloading(true);
    setError("");
    try {
      const response = await fetch("/api/employees/import-template", { headers: authHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "ไม่สามารถดาวน์โหลดไฟล์ตัวอย่างได้");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Import_Template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "ไม่สามารถดาวน์โหลดไฟล์ตัวอย่างได้");
    } finally {
      setTemplateDownloading(false);
    }
  }

  async function handleImport() {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    setValidationErrors([]);
    setShowUpdated(false);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("adminUser", user?.email ?? "unknown");

    const res = await fetch("/api/employees/import", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    const data = await res.json();
    setLoading(false);

    if (res.status === 422) {
      setValidationErrors(data.validationErrors ?? []);
    } else if (res.ok) {
      setResult(data);
      setCountdown(60);
    } else {
      setError(data.error ?? "เกิดข้อผิดพลาด");
    }
  }

  function reset() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setResult(null);
    setFiles([]);
    setCountdown(null);
    setShowUpdated(false);
    setValidationErrors([]);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">นำเข้าข้อมูล Excel</h1>
          <p className="text-slate-500 text-sm mt-1">อัปโหลดไฟล์ Excel เพื่อนำเข้าข้อมูลเจ้าหน้าที่หลายรายการพร้อมกัน</p>
        </div>

        <section aria-labelledby="import-format-title" className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="import-format-title" className="font-semibold">📋 รูปแบบไฟล์สำหรับนำเข้า</h2>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                ดาวน์โหลดไฟล์ตัวอย่างและกรอกข้อมูลตามหัวคอลัมน์ รองรับไฟล์ .xlsx, .xls และ .csv
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={templateDownloading}
              className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg bg-blue-100 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 disabled:cursor-wait disabled:opacity-60"
            >
              {templateDownloading ? "กำลังสร้างไฟล์..." : "⬇️ ดาวน์โหลดไฟล์ตัวอย่าง"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-white/70 p-3">
              <h3 className="text-xs font-semibold text-slate-700">ข้อมูลที่จำเป็น</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">รหัสประจำตัว</span>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">ชื่อ-สกุล</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">ข้อมูลอื่นสามารถเว้นว่างได้</p>
            </div>

            <div className="rounded-lg border border-blue-100 bg-white/70 p-3">
              <h3 className="text-xs font-semibold text-slate-700">ช่องที่มีรายการให้เลือก</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {IMPORT_DROPDOWN_LABELS.map((label) => (
                  <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-white/70 p-3 sm:col-span-2">
              <h3 className="text-xs font-semibold text-slate-700">รหัสข้อมูลต้นทาง</h3>
              <ol className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">1</span>
                  <span>สำนักงานบริหารทรัพยากรบุคคล (สบค.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">2</span>
                  <span>ศูนย์บริการโลหิตแห่งชาติ (ศล.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">3</span>
                  <span>โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย</span>
                </li>
              </ol>
            </div>
          </div>

          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <span className="font-semibold">หมายเหตุสถานะ IT:</span> เลือกสถานะจาก Dropdown หากเว้นว่าง ระบบจะไม่เปลี่ยนแปลงสถานะเดิม
          </p>
        </section>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {/* Drop zone — ซ่อนหลัง import สำเร็จ */}
          {!result && <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            <div className="text-4xl mb-3">📄</div>
            <p className="font-medium text-slate-600">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
            <p className="text-sm text-slate-400 mt-1">รองรับ .xlsx, .xls, .csv — <span className="font-medium">สูงสุด {MAX_FILES} ไฟล์ต่อครั้ง</span></p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden"
              onChange={(e) => addFiles(e.target.files)} />
          </div>}

          {/* File list — ซ่อนหลัง import สำเร็จ */}
          {!result && files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">📄</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                      <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  {!result && (
                    <button type="button" onClick={() => removeFile(f.name)}
                      className="ml-3 text-slate-300 hover:text-red-400 transition-colors text-xl leading-none shrink-0">
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Too many files warning */}
          {tooManyFiles && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <span className="text-red-500 shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-red-700">เลือกไฟล์มากเกินไป ({files.length} ไฟล์)</p>
                <p className="text-xs text-red-500 mt-0.5">อนุญาตสูงสุด {MAX_FILES} ไฟล์ต่อครั้ง กรุณาลบไฟล์ออกก่อนนำเข้า</p>
              </div>
            </div>
          )}

          {/* Validation errors (Phase 1 fail) */}
          {validationErrors.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center gap-2">
                <span className="text-red-500">❌</span>
                <p className="font-semibold text-red-700">ตรวจพบข้อผิดพลาด — ไม่มีข้อมูลใดถูกนำเข้า</p>
              </div>
              <ul className="px-4 py-3 space-y-1">
                {validationErrors.map((e, i) => (
                  <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">•</span>{e}
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2.5 bg-red-50 border-t border-red-100">
                <p className="text-xs text-red-500">กรุณาแก้ไขไฟล์ทั้งหมดแล้วลองใหม่อีกครั้ง</p>
              </div>
            </div>
          )}

          {/* General error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Success result */}
          {result && (
            <div className="mt-4 rounded-xl border border-green-200 overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                <p className="font-semibold text-green-700">✅ นำเข้าสำเร็จ ({files.length} ไฟล์)</p>
              </div>

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

              {result.errors.length > 0 && (
                <div className="border-t border-red-100 px-4 py-3 bg-red-50">
                  <p className="text-xs font-medium text-red-600 mb-1">ข้อผิดพลาดระหว่างนำเข้า:</p>
                  <ul className="list-disc list-inside text-red-500 text-xs space-y-0.5">
                    {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {countdown !== null && (
                <div className="border-t border-green-200 px-4 py-3 bg-green-50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-xs text-green-600">
                      นำทางไปหน้าข้อมูลพ้นสภาพใน <span className="font-bold text-green-700">{countdown}</span> วินาที...
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); setCountdown(null); }}
                        className="text-xs font-medium text-green-700 bg-white hover:bg-green-50 border border-green-300 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ⏸ หยุด
                      </button>
                      <button
                        onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); navigate("/records/all"); }}
                        className="text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ไปเลย →
                      </button>
                    </div>
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
              <button onClick={reset}
                className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                นำเข้าไฟล์ใหม่
              </button>
            ) : (
              <button onClick={() => navigate(-1)}
                className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
            )}
            <button onClick={handleImport} disabled={files.length === 0 || tooManyFiles || loading || !!result}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg transition-colors">
              {loading ? "กำลังนำเข้า..." : `นำเข้าข้อมูล${files.length > 1 ? ` (${files.length} ไฟล์)` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
