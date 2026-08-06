import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { ThaiDatePicker } from "../../components/ThaiDatePicker";

const IT_OPTS = ["ไม่พบบัญชี", "ดำเนินการแล้ว", "ยังไม่ดำเนินการ"];

const SOURCE_TYPE_OPTIONS = [
  { value: 1, label: "1 - สบค. (สำนักงานบริหารทรัพยากรบุคคล)" },
  { value: 2, label: "2 - ศล. (ศูนย์บริการโลหิตแห่งชาติ)" },
];
const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

interface Field {
  key: string;
  label: string;
  type: "text" | "email" | "date" | "textarea" | "select" | "autocomplete";
  required?: boolean;
  options?: string[];
  dateKey?: string;
  superAdminOnly?: boolean;
}

const fields: Field[] = [
  { key: "employeeId",   label: "รหัสประจำตัว",        type: "text",         required: true },
  { key: "nameTh",       label: "ชื่อ-สกุล (ไทย)",      type: "text",         required: true },
  { key: "nameEn",       label: "ชื่อ-สกุล (อังกฤษ)",   type: "text",         required: true },
  { key: "position",     label: "ตำแหน่ง",              type: "text",         required: true },
  { key: "level",        label: "ประเภท",               type: "text",         required: true },
  { key: "department",   label: "ฝ่าย/กลุ่มงาน",        type: "text",         required: true },
  { key: "bureau",       label: "หน่วยงาน/สำนัก",       type: "autocomplete", required: true },
  { key: "endDate",      label: "วันที่พ้นสภาพ",         type: "date",         required: true },
  { key: "email",        label: "Email",                  type: "text",         superAdminOnly: true },
  { key: "receivedDate", label: "วันที่ได้รับข้อมูล",    type: "date" },
];

const IT_FIELDS = [
  { key: "fmis",      label: "FMIS",      dateKey: "fmisDate" },
  { key: "eMeeting",  label: "eMeeting",  dateKey: "eMeetingDate" },
  { key: "software",  label: "Software",  dateKey: "softwareDate" },
  { key: "phonebook", label: "Phonebook", dateKey: "phonebookDate" },
];

const IT_TO_DATE: Record<string, string> = {
  fmis: "fmisDate", eMeeting: "eMeetingDate", software: "softwareDate", phonebook: "phonebookDate",
};

const REQUIRED_FIELDS = fields.filter((f) => f.required);

type FormErrors = Record<string, string>;

function validate(form: Record<string, string>): FormErrors {
  const err: FormErrors = {};
  for (const f of REQUIRED_FIELDS) {
    if (!form[f.key]?.trim()) err[f.key] = `กรุณากรอก${f.label}`;
  }
  return err;
}

function BureauSelect({ value, onChange, options, hasError }: {
  value: string; onChange: (v: string) => void; options: string[]; hasError: boolean;
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
  const border = hasError ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500";

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <input
          type="text" value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="พิมพ์หรือเลือกหน่วยงาน..."
          className={`w-full border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 ${border}`}
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

export default function AddRecordPage() {
  const { user } = useAuth();
  const role = user?.role;
  const navigate = useNavigate();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [form, setFormState] = useState<Record<string, string>>({
    fmis: "ยังไม่ดำเนินการ",
    eMeeting: "ยังไม่ดำเนินการ",
    software: "ยังไม่ดำเนินการ",
    phonebook: "ยังไม่ดำเนินการ",
  });
  const [noDateKeys, setNoDateKeys] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [bureauOptions, setBureauOptions] = useState<string[]>([]);

  useEffect(() => {
    apiFetch("/api/employees/meta").then((r) => r.json()).then((d) => {
      setBureauOptions(d.bureaus ?? []);
    }).catch(() => {});
  }, []);

  function setField(key: string, val: string) {
    setFormState((prev) => {
      const next: Record<string, string> = { ...prev, [key]: val };
      if (IT_TO_DATE[key]) {
        const dateKey = IT_TO_DATE[key];
        if (val === "ดำเนินการแล้ว") {
          if (!noDateKeys.has(dateKey) && !prev[dateKey]) next[dateKey] = todayIso;
        } else {
          next[dateKey] = "";
          setNoDateKeys((prev) => { const s = new Set(prev); s.delete(dateKey); return s; });
        }
      }
      return next;
    });
    if (errors[key]) setErrors((prev) => { const e = { ...prev }; delete e[key]; return e; });
  }

  function toggleNoDate(dateKey: string) {
    setNoDateKeys((prev) => {
      const s = new Set(prev);
      if (s.has(dateKey)) {
        s.delete(dateKey);
      } else {
        s.add(dateKey);
        setFormState((f) => ({ ...f, [dateKey]: "" }));
      }
      return s;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.getElementById(`field-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setLoading(true);
    setApiError("");
    const res = await apiFetch("/api/employees", {
      method: "POST",
      body: JSON.stringify({ ...form, adminUser: user?.email }),
    });
    setLoading(false);
    if (res.ok) {
      navigate("/records/all");
    } else {
      const d = await res.json();
      setApiError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  const visibleFields = fields.filter((f) => !f.superAdminOnly || role === "SUPER_ADMIN");
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">เพิ่มข้อมูลพนักงาน</h1>
          <p className="text-slate-500 text-sm mt-1">กรอกข้อมูลพนักงานที่พ้นสภาพ</p>
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
          {/* DataSource section */}
          <div className="mb-5 pb-5 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-600 mb-3">ข้อมูลต้นทาง</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทข้อมูลต้นทาง</label>
                <select value={form.sourceType ?? ""} onChange={(e) => setField("sourceType", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">ไม่ระบุ</option>
                  {SOURCE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={String(o.value)}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">เดือน</label>
                <select value={form.sourceMonth ?? ""} onChange={(e) => setField("sourceMonth", e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">ไม่ระบุ</option>
                  {THAI_MONTHS.slice(1).map((m, i) => (
                    <option key={i + 1} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ปี (พ.ศ.)</label>
                <input type="number" value={form.sourceYear ?? ""} onChange={(e) => setField("sourceYear", e.target.value)}
                  placeholder="เช่น 2567"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* General fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleFields.map((f) => {
              const hasErr = !!errors[f.key];
              const border = hasErr ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500";
              const baseCls = `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${border}`;

              return (
                <div key={f.key} id={`field-${f.key}`}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {f.label}
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                    {f.type === "date" && <span className="ml-1 text-xs text-slate-400 font-normal">(พ.ศ.)</span>}
                  </label>

                  {f.type === "autocomplete" ? (
                    <BureauSelect
                      value={form[f.key] ?? ""}
                      onChange={(v) => setField(f.key, v)}
                      options={bureauOptions}
                      hasError={hasErr}
                    />
                  ) : f.type === "date" ? (
                    <ThaiDatePicker
                      value={form[f.key] ?? ""}
                      onChange={(v) => setField(f.key, v)}
                      className={hasErr ? "border-red-400" : ""}
                    />
                  ) : (
                    <input type="text" value={form[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={baseCls} />
                  )}

                  {hasErr && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
                </div>
              );
            })}
          </div>

          {/* IT Status section */}
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="mb-3">
              <span className="text-sm font-semibold text-slate-600">สถานะดำเนินการ</span>
            </div>
            <div className="space-y-3">
              {IT_FIELDS.map(({ key, label, dateKey }) => {
                const val = form[key] ?? "";
                const dateVal = form[dateKey] ?? "";
                const isDone = val === "ดำเนินการแล้ว";
                const isNoDate = noDateKeys.has(dateKey);
                return (
                  <div key={key} className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-slate-600 w-24 shrink-0">{label}</span>
                    <select
                      value={val}
                      onChange={(e) => setField(key, e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                    >
                      {IT_OPTS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {isDone && (
                      <div className="flex flex-wrap items-center gap-3">
                        {!isNoDate && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 shrink-0">วันที่ดำเนินการ</span>
                            <ThaiDatePicker
                              value={dateVal}
                              onChange={(v) => setField(dateKey, v)}
                              placeholder="วว/ดด/ปปปป"
                              className="w-44"
                            />
                          </div>
                        )}
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isNoDate}
                            onChange={() => toggleNoDate(dateKey)}
                            className="w-3.5 h-3.5 rounded accent-slate-500"
                          />
                          <span className="text-xs text-slate-600">ไม่ทราบวันที่</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button type="button" onClick={() => navigate(-1)}
              className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors">
              {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
