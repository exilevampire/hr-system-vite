type AuditAction = "CREATE" | "UPDATE" | "DELETE";
type AuditSource = "MANUAL" | "IMPORT";
interface AuditMeta {
    source?: AuditSource;
    fileName?: string;
    importBatchId?: string;
}
export declare function createAuditLog(employeeId: string, action: AuditAction, adminUser: string, oldData?: Record<string, unknown>, newData?: Record<string, unknown>, meta?: AuditMeta): Promise<void>;
export {};
