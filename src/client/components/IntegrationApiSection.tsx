import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

interface ApiClient {
  id: string; name: string; keyPrefix: string; isActive: boolean; expiresAt: string | null;
  ipAllowlist: string[] | null; allowFullSync: boolean; fullSyncCompletedAt: string | null;
  fullSyncRequestId: string | null; lastUsedAt: string | null; createdAt: string;
}

interface ApiLog {
  requestId: string; endpoint: string; statusCode: number; resultCount: number;
  ipAddress: string | null; durationMs: number; errorCode: string | null; createdAt: string;
}

const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("th-TH") : "—";

export function IntegrationApiSection() {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", expiresAt: "", ipAllowlist: "", allowFullSync: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ clientName: string; rows: ApiLog[] } | null>(null);

  async function loadClients() {
    setLoading(true);
    const res = await apiFetch("/api/integration-clients");
    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { void loadClients(); }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    const res = await apiFetch("/api/integration-clients", { method: "POST", body: JSON.stringify({
      name: form.name, expiresAt: form.expiresAt || null,
      ipAllowlist: form.ipAllowlist.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean),
      allowFullSync: form.allowFullSync,
    }) });
    const data = await res.json(); setSaving(false);
    if (!res.ok) { setError(data.error ?? "สร้าง API Client ไม่สำเร็จ"); return; }
    setNewKey(data.apiKey); setShowForm(false);
    setForm({ name: "", expiresAt: "", ipAllowlist: "", allowFullSync: true });
    await loadClients();
  }

  async function toggleClient(client: ApiClient) {
    await apiFetch(`/api/integration-clients/${client.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !client.isActive }) });
    await loadClients();
  }

  async function rotateKey(client: ApiClient) {
    if (!window.confirm(`ออก API Key ใหม่ให้ “${client.name}” หรือไม่?\nKey เดิมจะใช้ไม่ได้ทันที`)) return;
    const res = await apiFetch(`/api/integration-clients/${client.id}/rotate-key`, { method: "POST" });
    const data = await res.json();
    if (res.ok) { setNewKey(data.apiKey); await loadClients(); } else window.alert(data.error ?? "ไม่สามารถออก Key ใหม่ได้");
  }

  async function editClient(client: ApiClient) {
    const ips = window.prompt("IP Allowlist (คั่นด้วย comma, เว้นว่างหมายถึงไม่จำกัด IP)", (client.ipAllowlist ?? []).join(", "));
    if (ips === null) return;
    const expiry = window.prompt("วันหมดอายุรูปแบบ YYYY-MM-DD (เว้นว่างหมายถึงไม่หมดอายุ)", client.expiresAt?.slice(0, 10) ?? "");
    if (expiry === null) return;
    const fullSync = window.prompt("อนุญาต Full Sync หรือไม่? พิมพ์ yes หรือ no", client.allowFullSync ? "yes" : "no");
    if (fullSync === null) return;
    if (!["yes", "no"].includes(fullSync.toLowerCase())) { window.alert("กรุณาพิมพ์ yes หรือ no"); return; }
    const res = await apiFetch(`/api/integration-clients/${client.id}`, { method: "PATCH", body: JSON.stringify({
      ipAllowlist: ips.split(",").map((v) => v.trim()).filter(Boolean), expiresAt: expiry || null,
      allowFullSync: fullSync.toLowerCase() === "yes",
    }) });
    const data = await res.json();
    if (res.ok) await loadClients(); else window.alert(data.error ?? "บันทึกการตั้งค่าไม่สำเร็จ");
  }

  async function resetFullSync(client: ApiClient) {
    const reason = window.prompt(`ระบุเหตุผลที่อนุญาตให้ “${client.name}” ทำ Full Sync ใหม่`);
    if (!reason) return;
    const res = await apiFetch(`/api/integration-clients/${client.id}/reset-full-sync`, { method: "POST", body: JSON.stringify({ reason }) });
    const data = await res.json();
    if (res.ok) await loadClients(); else window.alert(data.error ?? "ไม่สามารถอนุญาต Full Sync ใหม่ได้");
  }

  async function viewLogs(client: ApiClient) {
    const res = await apiFetch(`/api/integration-clients/${client.id}/logs`);
    const data = await res.json();
    setLogs({ clientName: client.name, rows: Array.isArray(data) ? data : [] });
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div><h2 className="font-semibold text-slate-700">Integration API</h2><p className="text-xs text-slate-400 mt-1">จัดการ API Key สำหรับระบบภายนอก · <a href="/api-docs" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">เปิด Swagger</a></p></div>
        <button onClick={() => { setShowForm((v) => !v); setError(""); }} className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">+ สร้าง API Client</button>
      </div>

      {newKey ? <div className="mb-4 p-4 rounded-xl border border-amber-300 bg-amber-50">
        <div className="font-semibold text-amber-800 text-sm">โปรดคัดลอก API Key ตอนนี้ ระบบจะไม่แสดงอีก</div>
        <div className="mt-2 flex gap-2"><code className="flex-1 overflow-x-auto bg-white border rounded-lg px-3 py-2 text-xs">{newKey}</code><button onClick={() => void navigator.clipboard.writeText(newKey)} className="px-3 py-2 text-xs border rounded-lg bg-white">คัดลอก</button><button onClick={() => setNewKey(null)} className="px-3 py-2 text-xs text-slate-600">ปิด</button></div>
      </div> : null}

      {showForm ? <form onSubmit={createClient} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 mb-4 rounded-xl border bg-slate-50">
        {error ? <div className="sm:col-span-2 text-sm text-red-600">{error}</div> : null}
        <label className="text-sm">ชื่อระบบ *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" /></label>
        <label className="text-sm">วันหมดอายุ<input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" /></label>
        <label className="sm:col-span-2 text-sm">IP Allowlist <span className="text-slate-400">(เว้นว่างได้, คั่นด้วย comma หรือขึ้นบรรทัดใหม่)</span><textarea value={form.ipAllowlist} onChange={(e) => setForm({ ...form, ipAllowlist: e.target.value })} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" /></label>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowFullSync} onChange={(e) => setForm({ ...form, allowFullSync: e.target.checked })} /> อนุญาต Full Sync ครั้งแรก</label>
        <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm border rounded-lg">ยกเลิก</button><button disabled={saving} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">{saving ? "กำลังสร้าง..." : "สร้างและแสดง API Key"}</button></div>
      </form> : null}

      {loading ? <div className="py-8 text-center text-slate-400">กำลังโหลด...</div> : clients.length === 0 ? <div className="py-8 text-center text-slate-400">ยังไม่มี API Client</div> : <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><th className="text-left p-3">ระบบ</th><th className="text-left p-3">Key</th><th className="text-left p-3">ใช้งานล่าสุด</th><th className="text-center p-3">Full Sync</th><th className="text-right p-3">จัดการ</th></tr></thead>
        <tbody className="divide-y">{clients.map((client) => <tr key={client.id}>
          <td className="p-3"><div className="font-medium">{client.name}</div><button onClick={() => void toggleClient(client)} className={`mt-1 text-xs ${client.isActive ? "text-emerald-600" : "text-red-500"}`}>{client.isActive ? "● เปิดใช้งาน" : "● ปิดใช้งาน"}</button></td>
          <td className="p-3 font-mono text-xs">{client.keyPrefix}</td><td className="p-3 text-xs text-slate-500">{dateTime(client.lastUsedAt)}</td>
          <td className="p-3 text-center text-xs">{!client.allowFullSync ? "ไม่อนุญาต" : client.fullSyncCompletedAt ? `ใช้แล้ว ${dateTime(client.fullSyncCompletedAt)}` : "พร้อมใช้งาน"}</td>
          <td className="p-3"><div className="flex flex-wrap justify-end gap-2 text-xs"><button onClick={() => void viewLogs(client)} className="text-blue-600 hover:underline">Log</button><button onClick={() => void editClient(client)} className="text-blue-600 hover:underline">ตั้งค่า</button><button onClick={() => void rotateKey(client)} className="text-amber-600 hover:underline">ออก Key ใหม่</button>{client.fullSyncCompletedAt ? <button onClick={() => void resetFullSync(client)} className="text-red-600 hover:underline">อนุญาต Full Sync ใหม่</button> : null}</div></td>
        </tr>)}</tbody>
      </table></div>}

      {logs ? <div className="mt-5 border-t pt-4"><div className="flex justify-between"><h3 className="text-sm font-semibold">100 Log ล่าสุด: {logs.clientName}</h3><button onClick={() => setLogs(null)} className="text-xs text-slate-500">ปิด</button></div><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50"><th className="p-2 text-left">เวลา</th><th className="p-2 text-left">Endpoint</th><th className="p-2">Status</th><th className="p-2">จำนวน</th><th className="p-2 text-left">IP</th></tr></thead><tbody>{logs.rows.map((log) => <tr key={log.requestId} className="border-t"><td className="p-2">{dateTime(log.createdAt)}</td><td className="p-2 font-mono">{log.endpoint}</td><td className="p-2 text-center">{log.statusCode}</td><td className="p-2 text-center">{log.resultCount}</td><td className="p-2">{log.ipAddress ?? "—"}</td></tr>)}</tbody></table></div></div> : null}
    </section>
  );
}
