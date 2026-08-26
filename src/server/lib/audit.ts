import { prisma } from "./prisma";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";
type AuditSource = "MANUAL" | "IMPORT";

interface AuditMeta {
  source?: AuditSource;
  fileName?: string;
  importBatchId?: string;
}

const SKIP_FIELDS = new Set(["createdAt", "updatedAt", "updatedBy", "createdBy", "id"]);

function normalizeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function createAuditLog(
  employeeId: string,
  action: AuditAction,
  adminUser: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  meta?: AuditMeta
) {
  let changedFields: Record<string, { old: unknown; new: unknown }> | null = null;

  if (action === "UPDATE" && oldData && newData) {
    changedFields = {};
    for (const key of Object.keys(newData)) {
      if (SKIP_FIELDS.has(key)) continue;
      if (normalizeValue(oldData[key]) !== normalizeValue(newData[key])) {
        changedFields[key] = { old: oldData[key] ?? null, new: newData[key] ?? null };
      }
    }
    if (Object.keys(changedFields).length === 0) return;
  }

  await prisma.auditLog.create({
    data: {
      employeeId,
      action,
      changedFields: changedFields ? JSON.parse(JSON.stringify(changedFields)) : undefined,
      adminUser,
      source: meta?.source ?? "MANUAL",
      fileName: meta?.fileName,
      importBatchId: meta?.importBatchId,
    },
  });
}
