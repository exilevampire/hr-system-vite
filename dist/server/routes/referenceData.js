"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const FIELD_LABELS = {
    bureau: "หน่วยงาน/สำนัก",
    department: "ฝ่าย/กลุ่มงาน",
    position: "ตำแหน่ง",
    level: "ประเภทเจ้าหน้าที่",
};
function isReferenceField(value) {
    return value in FIELD_LABELS;
}
function employeeWhere(field, value, bureau) {
    switch (field) {
        case "bureau": return { bureau: value };
        case "department": return { department: value, bureau };
        case "position": return { position: value };
        case "level": return { level: value };
    }
}
function employeeUpdate(field, value) {
    switch (field) {
        case "bureau": return { bureau: value };
        case "department": return { department: value };
        case "position": return { position: value };
        case "level": return { level: value };
    }
}
function cleanNewValue(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}
async function referenceCounts(field, deleted) {
    const deletedAt = deleted ? { not: null } : null;
    if (field === "department") {
        const rows = await prisma_1.prisma.employee.groupBy({
            by: ["bureau", "department"],
            where: { deletedAt, department: { not: null } },
            _count: { _all: true },
        });
        return rows.flatMap((row) => row.department && row.department !== "-"
            ? [{ value: row.department, bureau: row.bureau ?? "-", count: row._count._all }]
            : []);
    }
    if (field === "bureau") {
        const rows = await prisma_1.prisma.employee.groupBy({
            by: ["bureau"],
            where: { deletedAt, bureau: { not: null } },
            _count: { _all: true },
        });
        return rows.flatMap((row) => row.bureau && row.bureau !== "-" ? [{ value: row.bureau, count: row._count._all }] : []);
    }
    if (field === "position") {
        const rows = await prisma_1.prisma.employee.groupBy({
            by: ["position"],
            where: { deletedAt, position: { not: null } },
            _count: { _all: true },
        });
        return rows.flatMap((row) => row.position && row.position !== "-" ? [{ value: row.position, count: row._count._all }] : []);
    }
    const rows = await prisma_1.prisma.employee.groupBy({
        by: ["level"],
        where: { deletedAt, level: { not: null } },
        _count: { _all: true },
    });
    return rows.flatMap((row) => row.level && row.level !== "-" ? [{ value: row.level, count: row._count._all }] : []);
}
router.use(auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"));
router.get("/:field", async (req, res) => {
    const field = String(req.params.field);
    if (!isReferenceField(field)) {
        res.status(400).json({ error: "ประเภทข้อมูลไม่ถูกต้อง" });
        return;
    }
    const [activeCounts, deletedCounts] = await Promise.all([
        referenceCounts(field, false),
        referenceCounts(field, true),
    ]);
    const grouped = new Map();
    for (const item of activeCounts) {
        const key = field === "department" ? `${item.bureau}\u0000${item.value}` : item.value;
        grouped.set(key, {
            value: item.value,
            bureau: item.bureau,
            activeCount: item.count,
            deletedCount: 0,
        });
    }
    for (const item of deletedCounts) {
        const key = field === "department" ? `${item.bureau}\u0000${item.value}` : item.value;
        const current = grouped.get(key) ?? {
            value: item.value,
            bureau: item.bureau,
            activeCount: 0,
            deletedCount: 0,
        };
        current.deletedCount = item.count;
        grouped.set(key, current);
    }
    const items = [...grouped.values()].sort((a, b) => (a.bureau ?? "").localeCompare(b.bureau ?? "", "th") || a.value.localeCompare(b.value, "th"));
    res.json({ field, label: FIELD_LABELS[field], items });
});
router.get("/:field/members", async (req, res) => {
    const field = String(req.params.field);
    if (!isReferenceField(field)) {
        res.status(400).json({ error: "ประเภทข้อมูลไม่ถูกต้อง" });
        return;
    }
    const value = String(req.query.value ?? "");
    const bureau = String(req.query.bureau ?? "");
    if (!value || (field === "department" && !bureau)) {
        res.status(400).json({ error: "ระบุข้อมูลไม่ครบถ้วน" });
        return;
    }
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(String(req.query.pageSize ?? "50"), 10) || 50));
    const where = employeeWhere(field, value, field === "department" ? bureau : undefined);
    const [total, members] = await Promise.all([
        prisma_1.prisma.employee.count({ where }),
        prisma_1.prisma.employee.findMany({
            where,
            select: {
                employeeId: true,
                nameTh: true,
                bureau: true,
                department: true,
                position: true,
                level: true,
                deletedAt: true,
            },
            orderBy: [{ deletedAt: "asc" }, { nameTh: "asc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);
    res.json({ total, page, pageSize, members });
});
router.patch("/:field/rename", async (req, res) => {
    const field = String(req.params.field);
    if (!isReferenceField(field)) {
        res.status(400).json({ error: "ประเภทข้อมูลไม่ถูกต้อง" });
        return;
    }
    const currentValue = String(req.body.currentValue ?? "");
    const newValue = cleanNewValue(req.body.newValue);
    const bureau = String(req.body.bureau ?? "");
    if (!currentValue || !newValue || (field === "department" && !bureau)) {
        res.status(400).json({ error: "ระบุข้อมูลไม่ครบถ้วน" });
        return;
    }
    if (newValue.length > 191) {
        res.status(400).json({ error: "ชื่อใหม่ยาวเกิน 191 ตัวอักษร" });
        return;
    }
    if (currentValue === newValue) {
        res.status(400).json({ error: "ชื่อใหม่ไม่แตกต่างจากชื่อปัจจุบัน" });
        return;
    }
    const sourceWhere = employeeWhere(field, currentValue, field === "department" ? bureau : undefined);
    const targetWhere = employeeWhere(field, newValue, field === "department" ? bureau : undefined);
    const [affectedEmployees, targetEmployees] = await Promise.all([
        prisma_1.prisma.employee.findMany({
            where: sourceWhere,
            select: { employeeId: true },
        }),
        prisma_1.prisma.employee.findMany({ where: targetWhere, select: { employeeId: true } }),
    ]);
    if (affectedEmployees.length === 0) {
        res.status(404).json({ error: "ไม่พบข้อมูลที่ต้องการแก้ไข" });
        return;
    }
    const affectedIds = new Set(affectedEmployees.map(({ employeeId }) => employeeId));
    const targetExistingCount = targetEmployees.filter(({ employeeId }) => !affectedIds.has(employeeId)).length;
    const changedFields = {
        [field]: { old: currentValue, new: newValue },
    };
    const adminUser = req.user?.email ?? "unknown";
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.employee.updateMany({
            where: sourceWhere,
            data: employeeUpdate(field, newValue),
        });
        await tx.auditLog.createMany({
            data: affectedEmployees.map(({ employeeId }) => ({
                employeeId,
                action: "UPDATE",
                changedFields,
                adminUser,
            })),
        });
    });
    res.json({
        ok: true,
        field,
        label: FIELD_LABELS[field],
        currentValue,
        newValue,
        affectedCount: affectedEmployees.length,
        merged: targetExistingCount > 0,
        targetExistingCount,
    });
});
exports.default = router;
