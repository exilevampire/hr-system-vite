import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { ThaiDateInput } from "../../components/ThaiDateInput";

const IT_OPTS = ["", "ดำเนินการแล้ว", "ยังไม่ดำเนินการ"];

interface Field {
  key: string;
  label: string;
  type: "text" | "email" | "date" | "textarea" | "select";
  required?: boolean;
  options?: string[];
}

const fields: Field[] = [
  { key: "nameTh",       label: "ชื่อ-สกุล (ไทย)",      type: "text",     required: true },
  { key: "nameEn",       label: "ชื่อ-สกุล (อังกฤษ)",   type: "text" },
  { key: "position",     label: "ตำแหน่ง",              type: "text" },
  { key: "level",        label: "ระดับตำแหน่ง",         type: "text" },
  { key: "department",   label: "ฝ่าย/กลุ่มงาน",        type: "text" },
  { key: "bureau",       label: "หน่วยงาน/สำนัก",       type: "text" },
  { key: "startDate",    label: "วันเริ่มงาน",           type: "date" },
  { key: "endDate",      label: "วันที่พ้นสภาพ",         type: "date",     required: true },
  { key: "receivedDate", label: "วันที่ได้รับข้อมูล",    type: "date" },
  { key: "email",        label: "Email",                 type: "email" },
  { key: "fmis",         label: "FMIS",                  type: "select",   options: IT_OPTS },
  { key: "eMeeting",     label: "eMeeting",              type: "select",   options: IT_OPTS },
  { key: "website",      label: "Website",               type: "select",   options: IT_OPTS },
  { key: "phone3cx",     label: "3CX",                   type: "select",   options: IT_OPTS },
  { key: "intranet",     label: "Intranet",              type: "select",   options: IT_OPTS },
  { key: "hrSent",       label: "บค. ส่ง",               type: "date" },
  { key: "remarks",      label: "หมายเหตุ",              type: "textarea" },
];

const DATE_FIELD_KEYS = fields.filter((f) => f.type === "date").map((f) => f.key);

type FormErrors = Record<string, string>;

function validate(
  form: Record<string, string>,
  partialDates: Record<string, boolean>
): FormErrors {
  const err: FormErrors = {};

  // ── วันที่กรอกค้าง (บางช่อง) ──────────────────────────────
  for (const key of DATE_FIELD_KEYS) {
    if (partialDates[key])
      err[key] = "กรุณากรอกวันที่ให้ครบทุกช่อง (วัน / เดือน / ปี พ.ศ.)";
  }

  // ── Required ──────────────────────────────────────────────
  if (!form.nameTh?.trim())
    err.nameTh = "กรุณากรอกชื่อ-สกุล (ไทย)";

  if (!form.endDate && !partialDates.endDate)
    err.endDate = "กรุณาระบุวันที่พ้นสภาพ";

  // ── รูปแบบ Email ──────────────────────────────────────────
  const email = form.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    err.email = "รูปแบบ Email ไม่ถูกต้อง";

  // ── ความสัมพันธ์ของวันที่ ──────────────────────────────────
  if (form.startDate && form.endDate && form.endDate < form.startDate)
    err.endDate = "วันที่พ้นสภาพต้องไม่ก่อนวันเริ่มงาน";

  if (form.endDate && form.hrSent && form.hrSent < form.endDate)
    err.hrSent = "วันที่ บค.ส่ง ต้องไม่ก่อนวันที่พ้นสภาพ";

  return err;
}

function toDateInput(d?: string | null) {
  if (!d) return "";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
}

export default function EditRecordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();

  const [form, setFormState] = useState<Record<string, string>>({});
  const [partialDates, setPartialDates] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    apiFetch(`/api/employees/${employeeId}`)
      .then((r) => r.json())
      .then((d) => {
        setFormState({
          ...d,
          startDate:    toDateInput(d.startDate),
          endDate:      toDateInput(d.endDate),
          receivedDate: toDateInput(d.receivedDate),
          hrSent:       toDateInput(d.hrSent),
        });
        setLoading(false);
      });
  }, [employeeId]);

  function setField(key: string, val: string) {
    setFormState((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  function setPartial(key: string, isPartial: boolean) {
    setPartialDates((prev) => ({ ...prev, [key]: isPartial }));
    if (!isPartial && errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form, partialDates);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.getElementById(`field-${Object.keys(errs)[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    setApiError("");
    const res = await apiFetch(`/api/employees/${employeeId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...form, adminUser: user?.email }),
    });
    setSaving(false);
    if (res.ok) {
      navigate("/records/all");
    } else {
      const d = await res.json();
      setApiError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  if (loading) return <AppLayout><div className="text-center py-20 text-slate-400">กำลังโหลด...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขข้อมูลพนักงาน</h1>
          <p className="text-slate-500 text-sm mt-1">รหัส: {employeeId}</p>
        </div>

        {apiError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{apiError}</div>
        )}

        {hasErrors && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-semibold mb-1">กรุณาตรวจสอบข้อมูลให้ครบถ้วน</p>
            <ul className="list-disc list-inside space-y-0.5">
              {Object.values(errors).map((msg, i) => (
                <li key={i} className="text-red-600 text-xs">{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => {
              const hasErr = !!errors[f.key];
              const borderCls = hasErr ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500";
              const baseCls = `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${borderCls}`;

              return (
                <div key={f.key} id={`field-${f.key}`} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {f.label}
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                    {f.type === "date" && <span className="ml-1 text-xs text-slate-400 font-normal">(พ.ศ.)</span>}
                  </label>

                  {f.type === "textarea" ? (
                    <textarea rows={3} value={form[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={baseCls} />
                  ) : f.type === "select" ? (
                    <select value={form[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={`${baseCls} bg-white`}>
                      {f.options!.map((opt) => (
                        <option key={opt} value={opt}>{opt || "-- เลือกสถานะ --"}</option>
                      ))}
                    </select>
                  ) : f.type === "date" ? (
                    <ThaiDateInput
                      value={form[f.key] ?? ""}
                      onChange={(v) => setField(f.key, v)}
                      onPartialChange={(p) => setPartial(f.key, p)}
                      hasError={hasErr}
                    />
                  ) : (
                    <input type={f.type} value={form[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={baseCls} />
                  )}

                  {hasErr && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button type="button" onClick={() => navigate(-1)}
              className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg">
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
