import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";

interface Employee {
  id: number;
  employeeId: string;
  nameTh: string;
  nameEn?: string;
  position?: string;
  level?: string;
  department?: string;
  bureau?: string;
  startDate?: string;
  endDate?: string;
  receivedDate?: string;
  remarks?: string;
  email?: string;
  fmis?: string;
  eMeeting?: string;
  website?: string;
  phone3cx?: string;
  intranet?: string;
  hrSent?: string;
}

const PAGE_SIZE = 20;

export default function AllRecordsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "VIEWER";
  const canEdit = role === "SUPER_ADMIN" || role === "HR_ADMIN";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bureau, setBureau] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      search,
      bureau,
    });
    const res = await apiFetch(`/api/employees?${params}`);
    const data = await res.json();
    setEmployees(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, bureau]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handleDelete(employeeId: string) {
    if (!confirm("ยืนยันการลบข้อมูลนี้?")) return;
    await apiFetch(`/api/employees/${employeeId}`, { method: "DELETE" });
    fetchData();
  }

  function formatDate(d?: string | null) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("th-TH");
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ข้อมูลพนักงานที่พ้นสภาพ</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {total.toLocaleString()} รายการ</p>
        </div>
        {canEdit && (
          <div className="sm:ml-auto flex gap-2">
            <Link
              to="/records/import"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              📥 นำเข้า Excel
            </Link>
            <Link
              to="/records/add"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ➕ เพิ่มรายการ
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="ค้นหาชื่อ, รหัสพนักงาน..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="กรองตามหน่วยงาน..."
          value={bureau}
          onChange={(e) => { setBureau(e.target.value); setPage(1); }}
          className="w-full sm:w-48 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["#", "รหัส", "ชื่อ-สกุล", "ตำแหน่ง", "หน่วยงาน", "วันพ้นสภาพ", "FMIS", "eMeeting", "Website", "3CX", "Intranet", "บค.ส่ง", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={13} className="py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={13} className="py-12 text-center text-slate-400">ไม่พบข้อมูล</td></tr>
              ) : employees.map((emp, i) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{emp.employeeId}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{emp.nameTh}</div>
                    {emp.nameEn && <div className="text-xs text-slate-400">{emp.nameEn}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{emp.position ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{emp.bureau ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(emp.endDate)}</td>
                  <StatusCell value={emp.fmis} />
                  <StatusCell value={emp.eMeeting} />
                  <StatusCell value={emp.website} />
                  <StatusCell value={emp.phone3cx} />
                  <StatusCell value={emp.intranet} />
                  <StatusCell value={emp.hrSent} />
                  <td className="px-4 py-3 whitespace-nowrap">
                    {canEdit && (
                      <div className="flex gap-2">
                        <Link to={`/records/${emp.employeeId}/edit`} className="text-blue-600 hover:underline text-xs">แก้ไข</Link>
                        {role === "SUPER_ADMIN" && (
                          <button onClick={() => handleDelete(emp.employeeId)} className="text-red-500 hover:underline text-xs">ลบ</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 text-slate-400">ไม่พบข้อมูล</div>
        ) : employees.map((emp) => (
          <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-slate-800">{emp.nameTh}</div>
                <div className="text-xs text-slate-500 font-mono">{emp.employeeId}</div>
              </div>
              {canEdit && (
                <Link to={`/records/${emp.employeeId}/edit`} className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1">แก้ไข</Link>
              )}
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>ตำแหน่ง: {emp.position ?? "-"}</div>
              <div>หน่วยงาน: {emp.bureau ?? "-"}</div>
              <div>วันพ้นสภาพ: {formatDate(emp.endDate)}</div>
            </div>
            <button
              onClick={() => setExpanded(expanded === emp.id ? null : emp.id)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              {expanded === emp.id ? "ซ่อนข้อมูล ▲" : "ดูเพิ่มเติม ▼"}
            </button>
            {expanded === emp.id && (
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>FMIS: {emp.fmis ?? "-"}</div>
                <div>eMeeting: {emp.eMeeting ?? "-"}</div>
                <div>Website: {emp.website ?? "-"}</div>
                <div>3CX: {emp.phone3cx ?? "-"}</div>
                <div>Intranet: {emp.intranet ?? "-"}</div>
                <div>บค.ส่ง: {emp.hrSent ?? "-"}</div>
                {emp.remarks && <div className="col-span-2">หมายเหตุ: {emp.remarks}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-slate-500">หน้า {page} จาก {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">← ก่อนหน้า</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50">ถัดไป →</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function StatusCell({ value }: { value?: string | null }) {
  const isCleared = value && value !== "-" && value.trim() !== "";
  return (
    <td className="px-4 py-3 text-center">
      {isCleared ? (
        <span className="inline-block w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs leading-5 text-center">✓</span>
      ) : (
        <span className="inline-block w-5 h-5 rounded-full bg-red-50 text-red-400 text-xs leading-5 text-center">✕</span>
      )}
    </td>
  );
}
