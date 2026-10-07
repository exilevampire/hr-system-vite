export declare const PERMISSIONS: readonly ["dashboard.view", "employees.view", "employees.create", "employees.update", "employees.delete", "employees.import", "reports.export", "audit_logs.view"];
export type Permission = (typeof PERMISSIONS)[number];
export declare const DEFAULT_ADMIN_PERMISSIONS: Permission[];
export declare const VIEWER_PERMISSIONS: Permission[];
export declare function isPermission(value: unknown): value is Permission;
export declare function resolvePermissions(user: {
    role: string;
    permissionsConfigured: boolean;
    permissions: {
        permission: string;
    }[];
}): Permission[];
