import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { DEFAULT_ADMIN_PERMISSIONS, PERMISSION_GROUPS, VIEWER_PERMISSIONS, type Permission } from "../lib/permissions";

interface User {
  id: string;
  name?: string;
  email: string;
  role: string;
  totpEnabled: boolean;
  notifyOnImport: boolean;
  notifyOnRetire: boolean;
  createdAt: string;
  permissions: Permission[];
}

function PermissionChecklist({ role, value, onChange }: { role: string; value: Permission[]; onChange: (value: Permission[]) => void }) {
  const groups = role === "VIEWER"
    ? PERMISSION_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => VIEWER_PERMISSIONS.includes(item.value)) })).filter((group) => group.items.length)
    : PERMISSION_GROUPS;
  const defaults = role === "VIEWER" ? VIEWER_PERMISSIONS : DEFAULT_ADMIN_PERMISSIONS;
  const toggle = (permission: Permission) => onChange(
    value.includes(permission) ? value.filter((item) => item !== permission) : [...value, permission]
  );
  return (
    <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div><div className="text-sm font-semibold text-slate-700">สิทธิ์การเข้าถึงของ {role === "VIEWER" ? "Viewer" : "Admin"}</div><div className="text-xs text-slate-500">มีผลกับเมนู หน้าจอ และ Backend API</div></div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => onChange([...defaults])} className="text-blue-700 hover:underline">ค่าแนะนำ</button>
          <button type="button" onClick={() => onChange([])} className="text-slate-600 hover:underline">ล้างทั้งหมด</button>
        </div>
      </div>
      <div className="space-y-3">
        {groups.map((group) => <div key={group.title}>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">{group.title}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.items.map((item) => <label key={item.value} className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:border-blue-300">
              <input type="checkbox" checked={value.includes(item.value)} onChange={() => toggle(item.value)} className="h-4 w-4 accent-blue-600" />
              <span>{item.label}</span>
            </label>)}
          </div>
        </div>)}
      </div>
    </div>
  );
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  VIEWER: "Viewer",
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
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

  // System settings
  const [retireTime, setRetireTime] = useState("08:00");
  const [retireTimeSaving, setRetireTimeSaving] = useState(false);
  const [retireTimeSaved, setRetireTimeSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: string; permissions: Permission[] }>({ name: "", email: "", password: "", role: "VIEWER", permissions: [...VIEWER_PERMISSIONS] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; password: string; role: string; permissions: Permission[] }>({ name: "", email: "", password: "", role: "VIEWER", permissions: [] });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [resetting2FA, setResetting2FA] = useState(false);

  function fetchUsers() {
    setLoading(true);
    apiFetch("/api/users").then((r) => r.json()).then((d) => { setUsers(d); setLoading(false); });
  }

  function fetchSettings() {
    apiFetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d.retire_notify_time) setRetireTime(d.retire_notify_time);
    });
  }

  useEffect(() => { fetchUsers(); fetchSettings(); }, []);

  async function handleTestRetireNotify() {
    setTestSending(true);
    setTestResult(null);
    const res = await apiFetch("/api/settings/test-retire-notify", { method: "POST" });
    const d = await res.json();
    setTestSending(false);
    if (res.ok) {
      setTestResult({ ok: true, msg: `ส่งแล้วไปยัง ${(d.sentTo as string[]).join(", ")}` });
    } else {
      setTestResult({ ok: false, msg: d.error ?? "เกิดข้อผิดพลาด" });
    }
    setTimeout(() => setTestResult(null), 5000);
  }

  async function handleSaveRetireTime() {
    setRetireTimeSaving(true);
    await apiFetch("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ retire_notify_time: retireTime }),
    });
    setRetireTimeSaving(false);
    setRetireTimeSaved(true);
    setTimeout(() => setRetireTimeSaved(false), 2000);
  }

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
      setForm({ name: "", email: "", password: "", role: "VIEWER", permissions: [...VIEWER_PERMISSIONS] });
      fetchUsers();
    } else {
      const d = await res.json();
      setError(d.error ?? "เกิดข้อผิดพลาด");
    }
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({ name: u.name ?? "", email: u.email, password: "", role: u.role, permissions: u.permissions ?? [] });
    setEditError("");
  }

  function closeEdit() {
    setEditUser(null);
    setEditError("");
  }

  async function handleToggleNotify(u: User) {
    const updated = await apiFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ notifyOnImport: !u.notifyOnImport }),
    });
    if (updated.ok) fetchUsers();
  }

  async function handleToggleNotifyRetire(u: User) {
    const updated = await apiFetch(`/api/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ notifyOnRetire: !u.notifyOnRetire }),
    });
    if (updated.ok) fetchUsers();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    setEditError("");
    const body: Record<string, unknown> = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      permissions: editForm.role === "SUPER_ADMIN" ? [] : editForm.permissions,
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

  async function handleReset2FA() {
    if (!editUser || editUser.email === currentUser?.email || !editUser.totpEnabled) return;
    const confirmed = window.confirm(
      `ยืนยันการรีเซ็ต 2FA\n\nผู้ใช้: ${editUser.name ?? "-"}\nEmail: ${editUser.email}\n\nSecret และ Backup Codes เดิมจะถูกยกเลิกทั้งหมด`
    );
    if (!confirmed) return;
    setResetting2FA(true);
    setEditError("");
    const res = await apiFetch(`/api/users/${editUser.id}/reset-2fa`, { method: "POST" });
    const data = await res.json();
    setResetting2FA(false);
    if (!res.ok) {
      setEditError(data.error ?? "ไม่สามารถรีเซ็ต 2FA ได้");
      return;
    }
    setEditUser({ ...editUser, totpEnabled: false });
    fetchUsers();
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

      {/* System settings */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-700 mb-1">ตั้งค่าระบบแจ้งเตือน</h2>
          <p className="text-xs text-slate-400 mb-4">กำหนดเวลาส่งอีเมลแจ้งเตือนพนักงานพ้นสภาพประจำวัน</p>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">เวลาส่งอีเมลแจ้งเตือนพ้นสภาพ</label>
            <input
              type="time"
              value={retireTime}
              onChange={(e) => setRetireTime(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveRetireTime}
              disabled={retireTimeSaving}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                retireTimeSaved
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white"
              }`}
            >
              {retireTimeSaved ? "✓ บันทึกแล้ว" : retireTimeSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button
              onClick={handleTestRetireNotify}
              disabled={testSending}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50 transition-colors"
            >
              {testSending ? "กำลังส่ง..." : "🧪 ทดสอบส่งอีเมล"}
            </button>
          </div>
          {testResult && (
            <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${testResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {testResult.ok ? "✅ " : "❌ "}{testResult.msg}
            </div>
          )}
        </div>
      )}

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
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, permissions: e.target.value === "ADMIN" ? [...DEFAULT_ADMIN_PERMISSIONS] : e.target.value === "VIEWER" ? [...VIEWER_PERMISSIONS] : [] })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="VIEWER">Viewer</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            {form.role !== "SUPER_ADMIN" && <PermissionChecklist role={form.role} value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />}
            <div className="sm:col-span-2 flex gap-3 justify-end">
              <button type="button"
                onClick={() => { setShowForm(false); setForm({ name: "", email: "", password: "", role: "VIEWER", permissions: [...VIEWER_PERMISSIONS] }); setError(""); }}
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
                <th className="px-4 py-3 text-center font-semibold text-slate-600">2FA</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">วันที่สร้าง</th>
                {isSuperAdmin && <th className="px-4 py-3 text-center font-semibold text-slate-600">แจ้งเตือน Import</th>}
                {isSuperAdmin && <th className="px-4 py-3 text-center font-semibold text-slate-600">แจ้งเตือนพ้นสภาพ</th>}
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
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.totpEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {u.totpEnabled ? "เปิดใช้งาน" : "ไม่ได้เปิด"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleNotify(u)}
                        title={u.notifyOnImport ? "คลิกเพื่อปิดการแจ้งเตือน" : "คลิกเพื่อเปิดการแจ้งเตือน"}
                        className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${u.notifyOnImport ? "bg-blue-500" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${u.notifyOnImport ? "left-5" : "left-1"}`} />
                      </button>
                    </td>
                  )}
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleNotifyRetire(u)}
                        title={u.notifyOnRetire ? "คลิกเพื่อปิดการแจ้งเตือน" : "คลิกเพื่อเปิดการแจ้งเตือน"}
                        className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${u.notifyOnRetire ? "bg-emerald-500" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${u.notifyOnRetire ? "left-5" : "left-1"}`} />
                      </button>
                    </td>
                  )}
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
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value, permissions: e.target.value === "ADMIN" ? [...DEFAULT_ADMIN_PERMISSIONS] : e.target.value === "VIEWER" ? [...VIEWER_PERMISSIONS] : [] })}
                  disabled={editUser.email === currentUser?.email}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
                {editUser.email === currentUser?.email && (
                  <p className="mt-1 text-xs text-slate-400">ไม่สามารถเปลี่ยนบทบาทของตัวเองได้</p>
                )}
              </div>

              {editForm.role !== "SUPER_ADMIN" && <PermissionChecklist role={editForm.role} value={editForm.permissions} onChange={(permissions) => setEditForm({ ...editForm, permissions })} />}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-700">Two-Factor Authentication (2FA)</div>
                    <div className={`text-xs mt-1 ${editUser.totpEnabled ? "text-emerald-600" : "text-slate-500"}`}>
                      {editUser.totpEnabled ? "ผู้ใช้เปิดใช้งาน 2FA อยู่" : "ผู้ใช้ยังไม่ได้เปิดใช้งาน 2FA"}
                    </div>
                  </div>
                  {editUser.totpEnabled && editUser.email !== currentUser?.email && (
                    <button type="button" onClick={handleReset2FA} disabled={resetting2FA}
                      className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg border border-red-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50">
                      {resetting2FA ? "กำลังรีเซ็ต..." : "Reset 2FA"}
                    </button>
                  )}
                </div>
                {editUser.email === currentUser?.email && editUser.totpEnabled && (
                  <p className="text-xs text-slate-400 mt-2">บัญชีของตัวเองต้องจัดการ 2FA จากหน้า “บัญชีของฉัน”</p>
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
