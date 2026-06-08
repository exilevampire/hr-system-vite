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

function generatePassword(): string {
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = lower + upper + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const required = [pick(lower), pick(upper), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

function PasswordField({
  value,
  onChange,
  required,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
          >
            {show ? "ซ่อน" : "แสดง"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const pw = generatePassword();
            onChange(pw);
            setShow(true);
            setCopied(false);
          }}
          className="shrink-0 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
        >
          🎲 สุ่ม
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`shrink-0 px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap ${
              copied
                ? "bg-green-100 text-green-700 border-green-300"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            }`}
          >
            {copied ? "✓ คัดลอก" : "คัดลอก"}
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", role: "VIEWER" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

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

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({ name: u.name ?? "", email: u.email, password: "", role: u.role });
    setEditError("");
  }

  function closeEdit() {
    setEditUser(null);
    setEditError("");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    setEditError("");
    const body: Record<string, string> = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
    };
    if (editForm.password) body.password = editForm.password;
    const res = await apiFetch(`/api/users/${editUser.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setEditSaving(false);
    if (res.ok) {
      closeEdit();
      fetchUsers();
    } else {
      const d = await res.json();
      setEditError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันการลบผู้ใช้งานนี้?")) return;
    await apiFetch(`/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
  }

  const currentRole = currentUser?.role;
  const isSuperAdmin = currentRole === "SUPER_ADMIN";

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้งาน</h1>
          <p className="text-slate-500 text-sm mt-1">จัดการสิทธิ์การเข้าถึงระบบ</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => { setShowForm(!showForm); setError(""); }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ➕ เพิ่มผู้ใช้งาน
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">เพิ่มผู้ใช้งานใหม่</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ</label>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="off"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน *</label>
              <PasswordField
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">บทบาท</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="VIEWER">Viewer</option>
                <option value="HR_ADMIN">HR Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button type="button"
                onClick={() => { setShowForm(false); setForm({ name: "", email: "", password: "", role: "VIEWER" }); setError(""); }}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                ยกเลิก
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User table */}
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
                {isSuperAdmin && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${roleColors[u.role] ?? ""}`}>
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          แก้ไข
                        </button>
                        {u.email !== currentUser?.email && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            ลบ
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeEdit} />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-semibold text-slate-800">แก้ไขผู้ใช้งาน</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editUser.email}</p>
              </div>
              <button
                onClick={closeEdit}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleUpdate} className="px-6 py-5 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  autoComplete="off"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่านใหม่</label>
                <PasswordField
                  value={editForm.password}
                  onChange={(v) => setEditForm({ ...editForm, password: v })}
                  hint="เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">บทบาท</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  disabled={editUser.email === currentUser?.email}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="HR_ADMIN">HR Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
                {editUser.email === currentUser?.email && (
                  <p className="mt-1 text-xs text-slate-400">ไม่สามารถเปลี่ยนบทบาทของตัวเองได้</p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                >
                  {editSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
