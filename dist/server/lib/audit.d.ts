type AuditAction = "CREATE" | "UPDATE" | "DELETE";
export declare function createAuditLog(employeeId: string, action: AuditAction, adminUser: string, oldData?: Record<string, unknown>, newData?: Record<string, unknown>): Promise<void>;
export {};
