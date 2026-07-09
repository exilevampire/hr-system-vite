import { useState, useRef, useEffect } from "react";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function parseIso(iso: string) {
  if (!iso) return null;
  const p = iso.split("-");
  if (p.length < 3) return null;
  return { y: parseInt(p[0]), m: parseInt(p[1]), d: parseInt(p[2]) };
}

function toIso(y: number, m: number, d: number) {
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function daysInMonth(cey: number, m: number) {
  return new Date(cey, m, 0).getDate();
}

function firstDow(cey: number, m: number) {
  return new Date(cey, m - 1, 1).getDay();
}

export function ThaiDatePicker({
  value,
  onChange,
  placeholder = "วว/ดด/ปปปป (พ.ศ.)",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const parsed = parseIso(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((parsed?.y ?? new Date().getFullYear()) + 543);
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? new Date().getMonth() + 1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseIso(value);
    if (p) { setViewYear(p.y + 543); setViewMonth(p.m); }
  }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const display = parsed
    ? `${parsed.d.toString().padStart(2, "0")}/${parsed.m.toString().padStart(2, "0")}/${parsed.y + 543}`
    : "";

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(v => v - 1); }
    else setViewMonth(v => v - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(v => v + 1); }
    else setViewMonth(v => v + 1);
  }
  function prevYear() { setViewYear(v => v - 1); }
  function nextYear() { setViewYear(v => v + 1); }

  function selectDay(d: number) {
    onChange(toIso(viewYear - 543, viewMonth, d));
    setOpen(false);
  }

  const cey = viewYear - 543;
  const totalDays = daysInMonth(cey, viewMonth);
  const startDow = firstDow(cey, viewMonth);
  const todayCE = new Date();
  const todayY = todayCE.getUTCFullYear();
  const todayM = todayCE.getUTCMonth() + 1;
  const todayD = todayCE.getUTCDate();

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <input
          readOnly
          value={display}
          placeholder={placeholder}
          onClick={() => { if (!disabled) setOpen(o => !o); }}
          className={`w-full border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "cursor-pointer bg-white"}`}
        />
        {!disabled && value ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400 transition-colors text-lg leading-none">
            ×
          </button>
        ) : !disabled ? (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
        ) : null}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-1">
            <button type="button" onClick={prevYear} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 text-xs font-bold">«</button>
            <span className="text-xs font-semibold text-slate-500">พ.ศ. {viewYear}</span>
            <button type="button" onClick={nextYear} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 text-xs font-bold">»</button>
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="text-sm font-bold text-slate-700">{THAI_MONTHS[viewMonth - 1]}</span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d, i) => (
              <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const isSel = !!parsed && cey === parsed.y && viewMonth === parsed.m && day === parsed.d;
              const isToday = cey === todayY && viewMonth === todayM && day === todayD;
              const isSun = (startDow + i) % 7 === 0;
              const isSat = (startDow + i) % 7 === 6;
              return (
                <button key={day} type="button" onClick={() => selectDay(day)}
                  className={`h-8 w-full flex items-center justify-center rounded-lg text-xs transition-colors font-medium
                    ${isSel
                      ? "bg-blue-600 text-white shadow-sm"
                      : isToday
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : isSun
                          ? "text-red-400 hover:bg-red-50"
                          : isSat
                            ? "text-blue-500 hover:bg-blue-50"
                            : "text-slate-700 hover:bg-slate-100"
                    }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className="mt-3 w-full text-xs text-slate-400 hover:text-red-500 transition-colors py-1 border-t border-slate-100 pt-2">
              ล้างวันที่
            </button>
          )}
        </div>
      )}
    </div>
  );
}
