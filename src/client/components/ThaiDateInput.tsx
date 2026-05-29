import { useState, useEffect, useRef } from "react";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function ceToParts(ce: string): { d: string; m: string; y: string } {
  if (!ce) return { d: "", m: "", y: "" };
  const parts = ce.split("-");
  if (parts.length < 3) return { d: "", m: "", y: "" };
  const yearCE = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  if (isNaN(yearCE) || isNaN(month) || isNaN(day)) return { d: "", m: "", y: "" };
  return { d: String(day), m: String(month), y: String(yearCE + 543) };
}

export function ThaiDateInput({
  value,
  onChange,
  hasError = false,
  onPartialChange,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  onPartialChange?: (isPartial: boolean) => void;
  disabled?: boolean;
}) {
  const init = ceToParts(value);
  const [d, setD] = useState(init.d);
  const [m, setM] = useState(init.m);
  const [y, setY] = useState(init.y);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      const parts = ceToParts(value);
      setD(parts.d);
      setM(parts.m);
      setY(parts.y);
      onPartialChange?.(false);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function emit(day: string, month: string, yearBE: string) {
    const anyFilled = !!(day || month || yearBE);
    const allFilled = !!(day && month && yearBE);
    onPartialChange?.(anyFilled && !allFilled);

    if (!day && !month && !yearBE) { onChange(""); return; }

    const dNum = parseInt(day);
    const mNum = parseInt(month);
    const yBE  = parseInt(yearBE);
    if (isNaN(dNum) || isNaN(mNum) || isNaN(yBE) || yearBE.length < 4) return;

    const yCE = yBE - 543;
    const dateStr = `${String(yCE).padStart(4, "0")}-${String(mNum).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) onChange(dateStr);
  }

  function clear() {
    setD(""); setM(""); setY("");
    onChange("");
    onPartialChange?.(false);
  }

  const border = hasError
    ? "border-red-400 focus:ring-red-400"
    : "border-slate-300 focus:ring-blue-500";
  const disabledCls = disabled ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "";
  const base = `border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 ${border} ${disabledCls}`;

  return (
    <div className="flex gap-1.5 items-center">
      <input
        type="number" placeholder="วัน" value={d} min={1} max={31} disabled={disabled}
        onChange={(e) => { setD(e.target.value); emit(e.target.value, m, y); }}
        className={`${base} w-16 text-center`}
      />
      <select
        value={m} disabled={disabled}
        onChange={(e) => { setM(e.target.value); emit(d, e.target.value, y); }}
        className={`${base} flex-1 bg-white`}
      >
        <option value="">เดือน</option>
        {THAI_MONTHS.map((name, i) => (
          <option key={i + 1} value={String(i + 1)}>{name}</option>
        ))}
      </select>
      <input
        type="number" placeholder="พ.ศ." value={y} min={2400} max={2700} disabled={disabled}
        onChange={(e) => { setY(e.target.value); emit(d, m, e.target.value); }}
        className={`${base} w-24 text-center`}
      />
      {!disabled && (d || m || y) && (
        <button type="button" onClick={clear} title="ล้างวันที่"
          className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none px-0.5">
          ×
        </button>
      )}
    </div>
  );
}
