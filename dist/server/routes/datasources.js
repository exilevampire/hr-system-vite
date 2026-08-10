"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.authMiddleware, async (_req, res) => {
    const sources = await prisma_1.prisma.dataSource.findMany({
        orderBy: [{ sourceType: "asc" }, { year: "desc" }, { month: "desc" }],
    });
    res.json(sources);
});
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (req, res) => {
    const { sourceType, month, year } = req.body;
    if (!sourceType || !month || !year) {
        res.status(400).json({ error: "ต้องระบุ sourceType, month และ year" });
        return;
    }
    try {
        const existing = await prisma_1.prisma.dataSource.findFirst({
            where: { sourceType: Number(sourceType), month: Number(month), year: Number(year) },
        });
        if (existing) {
            res.json(existing);
            return;
        }
        const ds = await prisma_1.prisma.dataSource.create({
            data: { sourceType: Number(sourceType), month: Number(month), year: Number(year) },
        });
        res.status(201).json(ds);
    }
    catch {
        res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
});
exports.default = router;
