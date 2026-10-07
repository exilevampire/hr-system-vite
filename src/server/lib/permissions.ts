export const PERMISSIONS = [
  "dashboard.view",
  "employees.view",
  "employees.create",
  "employees.update",
  "employees.delete",
  "employees.import",
  "it_status.update",
  "reports.export",
  "audit_logs.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "employees.view",
  "employees.create",
  "employees.update",
  "employees.import",
  "reports.export",
  "audit_logs.view",
];

export const VIEWER_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "employees.view",
  "reports.export",
];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

export function resolvePermissions(user: {
  role: string;
  permissionsConfigured: boolean;
  permissions: { permission: string }[];
}): Permission[] {
  if (user.role === "SUPER_ADMIN") return [...PERMISSIONS];
  if (user.role !== "ADMIN" && user.role !== "VIEWER") return [];
  if (user.role === "VIEWER" && !user.permissionsConfigured) return [...VIEWER_PERMISSIONS];
  if (!user.permissionsConfigured) return [...DEFAULT_ADMIN_PERMISSIONS];
  return user.permissions.map((item) => item.permission).filter(isPermission);
}
