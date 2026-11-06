import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { apiFetch } from "../../lib/api";

interface TrashedEmployee {
  employeeId: string;
  nameTh: string;
  nameEn?: string | null;
  position?: string | null;
  bureau?: string | null;
  department?: string | null;
  deletedAt: string;
  deletedBy?: string | null;
  deleteReason?: string | null;
}

const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashedEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), search });
      const response = await apiFetch(`/api/employees/trash?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถโหลดข้อมูลในถังขยะได้");
      setItems(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลในถังขยะได้" });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  async function restore(employee: TrashedEmployee) {
    setRestoringId(employee.employeeId);
    setMessage(null);
    try {
      const response = await apiFetch(`/api/employees/${employee.employeeId}/restore`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถกู้คืนข้อมูลได้");
      setMessage({ type: "success", text: `กู้คืน ${employee.nameTh} (${employee.employeeId}) เรียบร้อยแล้ว` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "ไม่สามารถกู้คืนข้อมูลได้" });
    } finally {
      setRestoringId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">ถังขยะข้อมูลพนักงาน</h1>
        <p className="mt-1 text-sm text-slate-500">รายการที่ลบจะไม่แสดงใน Dashboard รายงาน และ Integration API</p>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="ค้นหารหัส หรือชื่อพนักงาน..."
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-md"
        />
        <span className="text-sm text-slate-500 sm:ml-auto">ทั้งหมด {total.toLocaleString()} รายการ</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">รหัส</th>
                <th className="px-4 py-3">ชื่อ-สกุล</th>
                <th className="px-4 py-3">ตำแหน่ง</th>
                <th className="px-4 py-3">หน่วยงาน/สำนัก</th>
                <th className="px-4 py-3">วันที่ลบ</th>
                <th className="px-4 py-3">ลบโดย</th>
                <th className="px-4 py-3">เหตุผล</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ไม่พบข้อมูลในถังขยะ</td></tr>
              ) : items.map((employee) => (
                <tr key={employee.employeeId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{employee.employeeId}</td>
                  <td className="px-4 py-3"><div className="font-medium text-slate-800">{employee.nameTh}</div><div className="text-xs text-slate-400">{employee.nameEn || "-"}</div></td>
                  <td className="px-4 py-3 text-slate-600">{employee.position || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{employee.bureau || "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(employee.deletedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{employee.deletedBy || "-"}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-500" title={employee.deleteReason || undefined}>{employee.deleteReason || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void restore(employee)}
                      disabled={restoringId !== null}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                    >
                      {restoringId === employee.employeeId ? "กำลังกู้คืน..." : "กู้คืนข้อมูล"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">หน้า {page} จาก {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">ก่อนหน้า</button>
              <button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40">ถัดไป</button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
