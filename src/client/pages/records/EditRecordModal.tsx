import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../../lib/api";
import { ThaiDatePicker } from "../../components/ThaiDatePicker";

const IT_OPTS = ["ไม่พบบัญชี", "ดำเนินการแล้ว", "ยังไม่ดำเนินการ", "ไม่ทราบสถานะ"];
const IT_KEYS = new Set(["fmis", "eMeeting", "software", "phonebook"]);
const IT_DATE_KEYS = ["fmisDate", "eMeetingDate", "softwareDate", "phonebookDate"];

const SOURCE_TYPE_OPTIONS = [
  { value: 1, label: "1 - สบค. (สำนักงานบริหารทรัพยากรบุคคล)" },
  { value: 2, label: "2 - ศล. (ศูนย์บริการโลหิตแห่งชาติ)" },
];
const THAI_MONTHS_EDIT = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

interface Field {
  key: string;
  label: string;
  type: "text" | "date" | "autocomplete";
  required?: boolean;
}

const fields: Field[] = [
  { key: "nameTh",       label: "ชื่อ-สกุล (ไทย)",    type: "text",         required: true },
  { key: "nameEn",       label: "ชื่อ-สกุล (อังกฤษ)", type: "text",         required: true },
  { key: "position",     label: "ตำแหน่ง",             type: "text",         required: true },
  { key: "level",        label: "ประเภท",              type: "text",         required: true },
  { key: "department",   label: "ฝ่าย/กลุ่มงาน",       type: "text",         required: true },
  { key: "bureau",       label: "หน่วยงาน/สำนัก",      type: "autocomplete", required: true },
  { key: "endDate",      label: "วันที่พ้นสภาพ",        type: "date",         required: true },
  { key: "email",        label: "Email",                type: "text" },
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

type FormErrors = Record<string, string>;

function validate(form: Record<string, string>, isSuperAdmin: boolean): FormErrors {
  const err: FormErrors = {};
  if (isSuperAdmin) {
    for (const f of fields.filter((f) => f.required)) {
      if (!form[f.key]?.trim()) err[f.key] = `กรุณากรอก${f.label}`;
    }
  }
  return err;
}

function toDateInput(d?: string | null) {
  if (!d) return "";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
}

function BureauSelect({ value, onChange, options, hasError, disabled }: {
  value: string; onChange: (v: string) => void; options: string[]; hasError: boolean; disabled?: boolean;
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
  const disabledCls = disabled ? "bg-slate-50 cursor-not-allowed text-slate-400" : "";

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <input
          type="text" value={query} disabled={disabled}
          onChange={(e) => { if (disabled) return; setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => { if (!disabled) setOpen(true); }}
          placeholder="พิมพ์หรือเลือกหน่วยงาน..."
          className={`w-full border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 ${border} ${disabledCls}`}
        />
        {!disabled && value && (
          <button type="button" onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 text-base leading-none">×</button>
        )}
        {!disabled && !value && (
          <span className="absolute right-2 text-slate-400 text-xs pointer-events-none">▾</span>
        )}
      </div>
      {!disabled && open && filtered.length > 0 && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
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

export function EditRecordModal({ employeeId, onClose, onSaved }: {
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const todayIso = new Date().toISOString().slice(0, 10);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  const [form, setFormState] = useState<Record<string, string>>({});
  const [noDateKeys, setNoDateKeys] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [bureauOptions, setBureauOptions] = useState<string[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    apiFetch("/api/employees/meta").then((r) => r.json()).then((d) => {
      setBureauOptions(d.bureaus ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/employees/${employeeId}`)
      .then((r) => r.json())
      .then((d) => {
        setFormState({
          ...d,
          endDate:       toDateInput(d.endDate),
          receivedDate:  toDateInput(d.receivedDate),
          fmisDate:      toDateInput(d.fmisDate),
          eMeetingDate:  toDateInput(d.eMeetingDate),
          softwareDate:  toDateInput(d.softwareDate),
          phonebookDate: toDateInput(d.phonebookDate),
          sourceType:    d.dataSource ? String(d.dataSource.sourceType) : "",
          sourceMonth:   d.dataSource ? String(d.dataSource.month) : "",
          sourceYear:    d.dataSource ? String(d.dataSource.year) : "",
        });
        // pre-check "ไม่ทราบวันที่" ถ้า status = ดำเนินการแล้ว แต่ไม่มีวันที่
        const preNoDate = new Set<string>();
        IT_FIELDS.forEach(({ key, dateKey }) => {
          if (d[key] === "ดำเนินการแล้ว" && !d[dateKey]) preNoDate.add(dateKey);
        });
        setNoDateKeys(preNoDate);
        setLoading(false);
      });
  }, [employeeId]);

  function canEdit(key: string) {
    if (isSuperAdmin) return true;
    return IT_KEYS.has(key) || IT_DATE_KEYS.includes(key);
  }

  function setField(key: string, val: string) {
    if (!canEdit(key)) return;
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
    const errs = validate(form, isSuperAdmin);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      modalBodyRef.current?.querySelector(`#field-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      onSaved();
    } else {
      const d = await res.json();
      setApiError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        ref={modalBodyRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800">แก้ไขข้อมูลพนักงาน</h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-slate-500 text-sm">รหัส: {employeeId}</p>
              {!isSuperAdmin && (
                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                  แก้ไขได้เฉพาะสถานะการดำเนินงาน
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-slate-400">กำลังโหลด...</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="p-6">
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

            {/* DataSource — SUPER_ADMIN only */}
            {isSuperAdmin && (
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
                      {THAI_MONTHS_EDIT.slice(1).map((m, i) => (
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
            )}

            {/* General fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map((f) => {
                const editable = canEdit(f.key);
                const hasErr = !!errors[f.key];
                const border = hasErr ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500";
                const baseCls = `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${border}`;
                const disabledCls = !editable ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "";

                return (
                  <div key={f.key} id={`field-${f.key}`}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {f.label}
                      {f.required && isSuperAdmin && <span className="text-red-500 ml-0.5">*</span>}
                      {f.type === "date" && <span className="ml-1 text-xs text-slate-400 font-normal">(พ.ศ.)</span>}
                      {!editable && <span className="ml-1 text-xs text-slate-400 font-normal">🔒</span>}
                    </label>

                    {f.type === "autocomplete" ? (
                      <BureauSelect
                        value={form[f.key] ?? ""}
                        onChange={(v) => setField(f.key, v)}
                        options={bureauOptions}
                        hasError={hasErr}
                        disabled={!editable}
                      />
                    ) : f.type === "date" ? (
                      <ThaiDatePicker
                        value={form[f.key] ?? ""}
                        onChange={(v) => setField(f.key, v)}
                        disabled={!editable}
                        className={hasErr ? "border-red-400" : ""}
                      />
                    ) : (
                      <input
                        type="text"
                        value={form[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={!editable}
                        className={`${baseCls} ${disabledCls}`}
                      />
                    )}

                    {hasErr && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
                  </div>
                );
              })}
            </div>

            {/* IT Status */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-slate-600">สถานะดำเนินการ</span>
                {!isSuperAdmin && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">แก้ไขได้</span>
                )}
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

            {/* Footer */}
            <div className="mt-6 flex gap-3 justify-end">
              <button type="button" onClick={onClose}
                className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors">
                {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
