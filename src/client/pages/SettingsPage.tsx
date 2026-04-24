import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface User {
  id: string;
  name?: string;
  email: string;
  role: string;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  VIEWER: "Viewer",
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  HR_ADMIN: "bg-blue-100 text-blue-700",
  VIEWER: "bg-slate-100 text-slate-600",
};

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function fetchUsers() {
    setLoading(true);
    apiFetch("/api/users").then((r) => r.json()).then((d) => { setUsers(d); setLoading(false); });
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "VIEWER" });
      fetchUsers();
    } else {
      const d = await res.json();
      setError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันการลบผู้ใช้งานนี้?")) return;
    await apiFetch(`/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
  }

  async function handleChangeRole(id: string, role: string) {
    await apiFetch(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    fetchUsers();
  }

  const currentRole = currentUser?.role;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้งาน</h1>
          <p className="text-slate-500 text-sm mt-1">จัดการสิทธิ์การเข้าถึงระบบ</p>
        </div>
        {currentRole === "SUPER_ADMIN" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ➕ เพิ่มผู้ใช้งาน
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">เพิ่มผู้ใช้งานใหม่</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน *</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">บทบาท</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="VIEWER">Viewer</option>
                <option value="HR_ADMIN">HR Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">ยกเลิก</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg">{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">ชื่อ</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">บทบาท</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">วันที่สร้าง</th>
                {currentRole === "SUPER_ADMIN" && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {currentRole === "SUPER_ADMIN" && u.email !== currentUser?.email ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="HR_ADMIN">HR Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${roleColors[u.role] ?? ""}`}>{roleLabels[u.role] ?? u.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString("th-TH")}</td>
                  {currentRole === "SUPER_ADMIN" && (
                    <td className="px-4 py-3">
                      {u.email !== currentUser?.email && (
                        <button onClick={() => handleDelete(u.id)} className="text-xs text-red-500 hover:underline">ลบ</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
