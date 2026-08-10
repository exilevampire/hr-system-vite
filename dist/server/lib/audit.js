"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
const prisma_1 = require("./prisma");
const SKIP_FIELDS = new Set(["createdAt", "updatedAt", "updatedBy", "createdBy", "id"]);
function normalizeValue(v) {
    if (v === null || v === undefined)
        return "";
    if (v instanceof Date)
        return v.toISOString();
    if (typeof v === "object")
        return JSON.stringify(v);
    return String(v);
}
async function createAuditLog(employeeId, action, adminUser, oldData, newData) {
    let changedFields = null;
    if (action === "UPDATE" && oldData && newData) {
        changedFields = {};
        for (const key of Object.keys(newData)) {
            if (SKIP_FIELDS.has(key))
                continue;
            if (normalizeValue(oldData[key]) !== normalizeValue(newData[key])) {
                changedFields[key] = { old: oldData[key] ?? null, new: newData[key] ?? null };
            }
        }
        if (Object.keys(changedFields).length === 0)
            return;
    }
    await prisma_1.prisma.auditLog.create({
        data: {
            employeeId,
            action,
            changedFields: changedFields ? JSON.parse(JSON.stringify(changedFields)) : undefined,
            adminUser,
        },
    });
}
