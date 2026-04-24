import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { apiFetch } from "../../lib/api";

const fields = [
  { key: "employeeId", label: "รหัสประจำตัว *", type: "text", required: true },
  { key: "nameTh", label: "ชื่อ-สกุล (ไทย) *", type: "text", required: true },
  { key: "nameEn", label: "Name-Eng", type: "text" },
  { key: "position", label: "ตำแหน่ง", type: "text" },
  { key: "level", label: "ระดับตำแหน่ง", type: "text" },
  { key: "department", label: "ฝ่าย/กลุ่มงาน", type: "text" },
  { key: "bureau", label: "หน่วยงาน/สำนัก", type: "text" },
  { key: "startDate", label: "วันเริ่มงาน", type: "date" },
  { key: "endDate", label: "วันที่พ้นสภาพ", type: "date" },
  { key: "receivedDate", label: "วันที่ได้รับข้อมูล", type: "date" },
  { key: "email", label: "Email", type: "email" },
  { key: "fmis", label: "FMIS", type: "text" },
  { key: "eMeeting", label: "eMeeting", type: "text" },
  { key: "website", label: "Website", type: "text" },
  { key: "phone3cx", label: "3CX", type: "text" },
  { key: "intranet", label: "Intranet", type: "text" },
  { key: "hrSent", label: "บค. ส่ง", type: "text" },
  { key: "remarks", label: "หมายเหตุ", type: "textarea" },
];

export default function AddRecordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/employees", {
      method: "POST",
      body: JSON.stringify({ ...form, adminUser: user?.email }),
    });
    setLoading(false);
    if (res.ok) {
      navigate("/records/all");
    } else {
      const d = await res.json();
      setError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">เพิ่มข้อมูลพนักงาน</h1>
          <p className="text-slate-500 text-sm mt-1">กรอกข้อมูลพนักงานที่พ้นสภาพ</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type={f.type}
                    required={f.required}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
