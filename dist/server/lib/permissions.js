"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIEWER_PERMISSIONS = exports.DEFAULT_ADMIN_PERMISSIONS = exports.PERMISSIONS = void 0;
exports.isPermission = isPermission;
exports.resolvePermissions = resolvePermissions;
exports.PERMISSIONS = [
    "dashboard.view",
    "employees.view",
    "employees.create",
    "employees.update",
    "employees.delete",
    "employees.import",
    "it_status.update",
    "reports.export",
    "audit_logs.view",
];
exports.DEFAULT_ADMIN_PERMISSIONS = [
    "dashboard.view",
    "employees.view",
    "employees.create",
    "employees.update",
    "employees.import",
    "reports.export",
    "audit_logs.view",
];
exports.VIEWER_PERMISSIONS = [
    "dashboard.view",
    "employees.view",
    "reports.export",
];
function isPermission(value) {
    return typeof value === "string" && exports.PERMISSIONS.includes(value);
}
function resolvePermissions(user) {
    if (user.role === "SUPER_ADMIN")
        return [...exports.PERMISSIONS];
    if (user.role !== "ADMIN" && user.role !== "VIEWER")
        return [];
    if (user.role === "VIEWER" && !user.permissionsConfigured)
        return [...exports.VIEWER_PERMISSIONS];
    if (!user.permissionsConfigured)
        return [...exports.DEFAULT_ADMIN_PERMISSIONS];
    return user.permissions.map((item) => item.permission).filter(isPermission);
}
