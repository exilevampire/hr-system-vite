import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { apiFetch } from "../lib/api";

const REFERENCE_FIELDS = [
  { key: "bureau", label: "หน่วยงาน/สำนัก" },
  { key: "department", label: "ฝ่าย/กลุ่มงาน" },
  { key: "position", label: "ตำแหน่ง" },
  { key: "level", label: "ประเภทเจ้าหน้าที่" },
] as const;

type ReferenceField = (typeof REFERENCE_FIELDS)[number]["key"];

interface ReferenceItem {
  value: string;
  bureau?: string;
  activeCount: number;
  deletedCount: number;
}

interface Member {
  employeeId: string;
  nameTh: string;
  bureau?: string | null;
  department?: string | null;
  position?: string | null;
  level?: string | null;
  deletedAt?: string | null;
}

interface MembersResponse {
  total: number;
  page: number;
  pageSize: number;
  members: Member[];
}

function comparable(value: string): string {
  return value.trim().replace(/\s+/g, " ").normalize("NFKC").toLocaleLowerCase("th-TH");
}

export default function ReferenceDataPage() {
  const [field, setField] = useState<ReferenceField>("bureau");
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReferenceItem | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const pageSize = 50;

  const currentLabel = REFERENCE_FIELDS.find((entry) => entry.key === field)?.label ?? field;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await apiFetch(`/api/reference-data/${field}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถโหลดข้อมูลได้");
      setItems(data.items ?? []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [field]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!selected) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setSelected(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saving, selected]);

  const fetchMembers = useCallback(async (item: ReferenceItem, page: number) => {
    setMembersLoading(true);
    setModalError("");
    try {
      const params = new URLSearchParams({
        value: item.value,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (field === "department" && item.bureau) params.set("bureau", item.bureau);
      const response = await apiFetch(`/api/reference-data/${field}/members?${params}`);
      const data = await response.json() as MembersResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถโหลดรายชื่อได้");
      setMembers(data.members ?? []);
      setMembersTotal(data.total ?? 0);
      setMembersPage(data.page ?? page);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "ไม่สามารถโหลดรายชื่อได้");
    } finally {
      setMembersLoading(false);
    }
  }, [field]);

  const filteredItems = useMemo(() => {
    const query = comparable(search);
    if (!query) return items;
    return items.filter((item) => comparable(item.value).includes(query) || comparable(item.bureau ?? "").includes(query));
  }, [items, search]);

  const targetItem = useMemo(() => {
    if (!selected || !newValue.trim()) return undefined;
    const target = comparable(newValue);
    return items.find((item) =>
      item !== selected
      && comparable(item.value) === target
      && (field !== "department" || item.bureau === selected.bureau)
    );
  }, [field, items, newValue, selected]);

  function openModal(item: ReferenceItem, mode: "view" | "edit") {
    setSelected(item);
    setModalMode(mode);
    setNewValue(item.value);
    setConfirming(false);
    setModalError("");
    setMembers([]);
    setMembersTotal(item.activeCount + item.deletedCount);
    setMembersPage(1);
    void fetchMembers(item, 1);
  }

  function closeModal() {
    if (saving) return;
    setSelected(null);
    setConfirming(false);
    setModalError("");
  }

  function reviewChange() {
    if (!selected) return;
    const cleaned = newValue.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      setModalError("กรุณาระบุชื่อใหม่");
      return;
    }
    if (cleaned === selected.value) {
      setModalError("ชื่อใหม่ไม่แตกต่างจากชื่อปัจจุบัน");
      return;
    }
    setNewValue(cleaned);
    setModalError("");
    setConfirming(true);
  }

  async function saveRename() {
    if (!selected) return;
    setSaving(true);
    setModalError("");
    try {
      const response = await apiFetch(`/api/reference-data/${field}/rename`, {
        method: "PATCH",
        body: JSON.stringify({
          currentValue: selected.value,
          newValue,
          bureau: field === "department" ? selected.bureau : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "ไม่สามารถแก้ไขข้อมูลได้");
      setSelected(null);
      setConfirming(false);
      setSuccess(
        data.merged
          ? `รวม “${selected.value}” เข้ากับ “${data.newValue}” แล้ว ${data.affectedCount.toLocaleString()} รายการ`
          : `เปลี่ยน “${selected.value}” เป็น “${data.newValue}” แล้ว ${data.affectedCount.toLocaleString()} รายการ`
      );
      await fetchItems();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "ไม่สามารถแก้ไขข้อมูลได้");
    } finally {
      setSaving(false);
    }
  }

  const memberPages = Math.ceil(membersTotal / pageSize);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขข้อมูลพื้นฐาน</h1>
          <p className="mt-1 text-sm text-slate-500">
            ตรวจสอบจำนวนและรายชื่อเจ้าหน้าที่ก่อนเปลี่ยนชื่อหรือรวมข้อมูลที่ซ้ำกัน
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          หน้านี้แก้ไขได้เฉพาะชื่อที่มีอยู่แล้ว ไม่สามารถเพิ่มหรือลบรายการได้ การเปลี่ยนชื่อจะมีผลกับเจ้าหน้าที่ทั้งหมดรวมถึงข้อมูลในถังขยะ
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
            {REFERENCE_FIELDS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => { setField(entry.key); setSearch(""); setSuccess(""); }}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  field === entry.key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">{currentLabel}</h2>
              <p className="mt-0.5 text-xs text-slate-500">พบ {items.length.toLocaleString()} ชื่อที่ใช้งานอยู่ในข้อมูล</p>
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`ค้นหา${currentLabel}`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80"
            />
          </div>

          {success && <div className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
          {pageError && <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">ชื่อปัจจุบัน</th>
                  {field === "department" && <th className="px-4 py-3">หน่วยงาน/สำนัก</th>}
                  <th className="px-4 py-3 text-center">ใช้งานอยู่</th>
                  <th className="px-4 py-3 text-center">ในถังขยะ</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={field === "department" ? 5 : 4} className="px-4 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={field === "department" ? 5 : 4} className="px-4 py-12 text-center text-slate-400">ไม่พบข้อมูล</td></tr>
                ) : filteredItems.map((item) => (
                  <tr key={`${item.bureau ?? ""}-${item.value}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{item.value}</td>
                    {field === "department" && <td className="px-4 py-3 text-slate-500">{item.bureau}</td>}
                    <td className="px-4 py-3 text-center text-slate-600">{item.activeCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{item.deletedCount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openModal(item, "view")} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">ดูรายชื่อ</button>
                        <button type="button" onClick={() => openModal(item, "edit")} className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">แก้ไขชื่อ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reference-modal-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <h2 id="reference-modal-title" className="text-lg font-bold text-slate-800">{modalMode === "edit" ? `แก้ไข${currentLabel}` : `รายชื่อเจ้าหน้าที่ใน${currentLabel}`}</h2>
                <p className="mt-1 break-words text-sm text-slate-500">{selected.value}</p>
                {field === "department" && <p className="mt-1 text-xs text-slate-400">ภายใต้ {selected.bureau}</p>}
              </div>
              <button type="button" onClick={closeModal} aria-label="ปิด" className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100">×</button>
            </div>

            <div className="overflow-y-auto p-6">
              {modalMode === "edit" && (
                <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  {!confirming ? (
                    <>
                      <label htmlFor="reference-new-value" className="block text-sm font-semibold text-slate-700">ชื่อใหม่</label>
                      <input
                        id="reference-new-value"
                        value={newValue}
                        onChange={(event) => { setNewValue(event.target.value); setModalError(""); }}
                        maxLength={191}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        หากชื่อใหม่นี้มีอยู่แล้ว ระบบจะรวมข้อมูลเข้ากับชื่อนั้นโดยอัตโนมัติ
                      </p>
                    </>
                  ) : (
                    <div>
                      <h3 className="font-semibold text-slate-800">ตรวจสอบก่อนยืนยัน</h3>
                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-400">ชื่อปัจจุบัน</span><span className="mt-1 block text-slate-700">{selected.value}</span></div>
                        <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-400">ชื่อใหม่</span><span className="mt-1 block font-medium text-blue-700">{newValue}</span></div>
                      </div>
                      <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${targetItem ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {targetItem
                          ? `ชื่อนี้มีอยู่แล้ว ระบบจะรวมกับอีก ${(targetItem.activeCount + targetItem.deletedCount).toLocaleString()} รายการ`
                          : "ยังไม่มีชื่อนี้ในระบบ ระบบจะเปลี่ยนเป็นชื่อใหม่"}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">ข้อมูลที่จะถูกแก้ไขทั้งหมด {membersTotal.toLocaleString()} รายการ รวมข้อมูลในถังขยะ</p>
                    </div>
                  )}
                </div>
              )}

              {modalError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{modalError}</div>}

              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-700">เจ้าหน้าที่ที่ได้รับผลกระทบ ({membersTotal.toLocaleString()} รายการ)</h3>
                {membersLoading && <span className="text-xs text-blue-600">กำลังโหลด...</span>}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500">
                    <tr><th className="px-3 py-2">รหัส</th><th className="px-3 py-2">ชื่อ-สกุล</th><th className="px-3 py-2">หน่วยงาน/สำนัก</th><th className="px-3 py-2">ฝ่าย/กลุ่มงาน</th><th className="px-3 py-2">สถานะข้อมูล</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!membersLoading && members.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">ไม่พบรายชื่อ</td></tr>
                    ) : members.map((member) => (
                      <tr key={member.employeeId}>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{member.employeeId}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">{member.nameTh}</td>
                        <td className="px-3 py-2 text-slate-500">{member.bureau || "-"}</td>
                        <td className="px-3 py-2 text-slate-500">{member.department || "-"}</td>
                        <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${member.deletedAt ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>{member.deletedAt ? "ถังขยะ" : "ใช้งานอยู่"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {memberPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button type="button" disabled={membersPage <= 1 || membersLoading} onClick={() => selected && void fetchMembers(selected, membersPage - 1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 disabled:cursor-default disabled:opacity-40">← ก่อนหน้า</button>
                  <span className="text-slate-500">หน้า {membersPage.toLocaleString()} จาก {memberPages.toLocaleString()}</span>
                  <button type="button" disabled={membersPage >= memberPages || membersLoading} onClick={() => selected && void fetchMembers(selected, membersPage + 1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 disabled:cursor-default disabled:opacity-40">ถัดไป →</button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              {modalMode === "edit" && confirming && <button type="button" disabled={saving} onClick={() => setConfirming(false)} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">ย้อนกลับ</button>}
              <button type="button" disabled={saving} onClick={closeModal} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50">ปิด</button>
              {modalMode === "edit" && !confirming && <button type="button" onClick={reviewChange} className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">ตรวจสอบการเปลี่ยนแปลง</button>}
              {modalMode === "edit" && confirming && <button type="button" disabled={saving} onClick={() => void saveRename()} className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">{saving ? "กำลังแก้ไข..." : "ยืนยันการแก้ไขทั้งหมด"}</button>}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
