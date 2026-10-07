export const PERMISSIONS = [
  "dashboard.view", "employees.view", "employees.create", "employees.update",
  "employees.delete", "employees.import", "it_status.update", "reports.export",
  "audit_logs.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [
  "dashboard.view", "employees.view", "employees.create", "employees.update",
  "employees.import", "reports.export", "audit_logs.view",
];

export const VIEWER_PERMISSIONS: Permission[] = [
  "dashboard.view", "employees.view", "reports.export",
];

export const PERMISSION_GROUPS: { title: string; items: { value: Permission; label: string }[] }[] = [
  { title: "หน้าหลัก", items: [{ value: "dashboard.view", label: "ดูแดชบอร์ด" }] },
  { title: "ข้อมูลพนักงานพ้นสภาพ", items: [
    { value: "employees.view", label: "ดูข้อมูล" },
    { value: "employees.create", label: "เพิ่มข้อมูล" },
    { value: "employees.update", label: "แก้ไขข้อมูล" },
    { value: "employees.delete", label: "ลบข้อมูล" },
    { value: "employees.import", label: "นำเข้าข้อมูล Excel" },
    { value: "it_status.update", label: "อัปเดตสถานะ IT" },
    { value: "reports.export", label: "ดาวน์โหลดรายงาน Excel" },
  ] },
  { title: "ตรวจสอบระบบ", items: [{ value: "audit_logs.view", label: "ดู Audit Log" }] },
];
