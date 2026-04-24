import { prisma } from "./prisma";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export async function createAuditLog(
  employeeId: string,
  action: AuditAction,
  adminUser: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>
) {
  let changedFields: Record<string, { old: unknown; new: unknown }> | null = null;

  if (action === "UPDATE" && oldData && newData) {
    changedFields = {};
    for (const key of Object.keys(newData)) {
      if (oldData[key] !== newData[key]) {
        changedFields[key] = { old: oldData[key], new: newData[key] };
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
    },
  });
}
