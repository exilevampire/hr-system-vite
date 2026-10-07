"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../lib/permissions");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";
router.post("/login", async (req, res) => {
    const identifier = String(req.body.identifier ?? req.body.email ?? "").trim().toLowerCase();
    const { password } = req.body;
    if (!identifier || !password) {
        res.status(400).json({ error: "Username หรือ Email และรหัสผ่านจำเป็น" });
        return;
    }
    let user;
    try {
        user = await prisma_1.prisma.user.findFirst({
            where: identifier.includes("@") ? { email: identifier } : { username: identifier },
            include: { permissions: { select: { permission: true } } },
        });
    }
    catch (err) {
        console.error("[Auth] database error during login:", err);
        res.status(503).json({ error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่ภายหลัง" });
        return;
    }
    if (!user) {
        console.warn(`[Auth] login failed - unknown identifier: ${identifier} from IP: ${req.ip} at ${new Date().toISOString()}`);
        res.status(401).json({ error: "Username, Email หรือรหัสผ่านไม่ถูกต้อง" });
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, user.password);
    if (!valid) {
        console.warn(`[Auth] login failed - wrong password for: ${identifier} from IP: ${req.ip} at ${new Date().toISOString()}`);
        res.status(401).json({ error: "Username, Email หรือรหัสผ่านไม่ถูกต้อง" });
        return;
    }
    if (user.totpEnabled) {
        const tempToken = jsonwebtoken_1.default.sign({ id: user.id, type: "2fa_pending" }, JWT_SECRET, { expiresIn: "5m" });
        res.json({ requires2fa: true, tempToken });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, permissions: (0, permissions_1.resolvePermissions)(user) } });
});
router.get("/me", auth_1.authMiddleware, (req, res) => {
    res.json(req.user);
});
exports.default = router;
