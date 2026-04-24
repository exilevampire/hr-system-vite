import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

const fields = [
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

function toDateInput(d?: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export default function EditRecordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();

  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/employees/${employeeId}`)
      .then((r) => r.json())
      .then((d) => {
        setForm({
          ...d,
          startDate: toDateInput(d.startDate),
          endDate: toDateInput(d.endDate),
          receivedDate: toDateInput(d.receivedDate),
        });
        setLoading(false);
      });
  }, [employeeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await apiFetch(`/api/employees/${employeeId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...form, adminUser: user?.email }),
    });
    setSaving(false);
    if (res.ok) {
      navigate("/records/all");
    } else {
      const d = await res.json();
      setError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  if (loading) return <AppLayout><div className="text-center py-20 text-slate-400">กำลังโหลด...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขข้อมูลพนักงาน</h1>
          <p className="text-slate-500 text-sm mt-1">รหัส: {employeeId}</p>
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
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">ยกเลิก</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg">
              {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
