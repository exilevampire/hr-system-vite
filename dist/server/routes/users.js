"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const router = (0, express_1.Router)();
const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "VIEWER"];
router.get("/", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, notifyOnImport: true, notifyOnRetire: true, createdAt: true },
        orderBy: { createdAt: "asc" },
    });
    res.json(users);
});
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: "Email และรหัสผ่านจำเป็น" });
        return;
    }
    if (typeof password !== "string" || password.length < 8) {
        res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
        return;
    }
    if (role && !VALID_ROLES.includes(role)) {
        res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
        return;
    }
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        res.status(400).json({ error: "Email นี้มีในระบบแล้ว" });
        return;
    }
    const hashed = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.prisma.user.create({
        data: { name: name || null, email, password: hashed, role: role ?? "VIEWER" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
});
router.patch("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (req, res) => {
    const { id } = req.params;
    const { name, email, password, role, notifyOnImport, notifyOnRetire } = req.body;
    if (role !== undefined && !VALID_ROLES.includes(role)) {
        res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
        return;
    }
    if (password !== undefined && password !== "") {
        if (typeof password !== "string" || password.length < 8) {
            res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
            return;
        }
    }
    if (email !== undefined) {
        const conflict = await prisma_1.prisma.user.findFirst({ where: { email, NOT: { id } } });
        if (conflict) {
            res.status(400).json({ error: "Email นี้มีในระบบแล้ว" });
            return;
        }
    }
    const data = {};
    if (name !== undefined)
        data.name = name || null;
    if (email !== undefined)
        data.email = email;
    if (role !== undefined)
        data.role = role;
    if (notifyOnImport !== undefined)
        data.notifyOnImport = Boolean(notifyOnImport);
    if (notifyOnRetire !== undefined)
        data.notifyOnRetire = Boolean(notifyOnRetire);
    if (password)
        data.password = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, notifyOnImport: true, notifyOnRetire: true },
    });
    res.json(user);
});
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (_req, res) => {
    const { id } = _req.params;
    await prisma_1.prisma.user.delete({ where: { id } });
    res.json({ success: true });
});
exports.default = router;
