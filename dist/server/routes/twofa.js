"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const totp_1 = require("../lib/totp");
const qrcode_1 = __importDefault(require("qrcode"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../middleware/auth");
const permissions_1 = require("../lib/permissions");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";
const APP_ISSUER = "HR-RedCross";
function generateBackupCodes() {
    return Array.from({ length: 10 }, () => crypto_1.default.randomBytes(4).toString("hex").toUpperCase());
}
function formatBackupCode(raw) {
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
function normalizeBackupCode(input) {
    return input.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
}
function verifySetupToken(token) {
    if (typeof token !== "string")
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return payload.id && payload.type === "2fa_setup" ? { id: payload.id, type: payload.type } : null;
    }
    catch {
        return null;
    }
}
function createSession(user) {
    return jsonwebtoken_1.default.sign({ id: user.id, username: user.username, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}
// POST /api/auth/2fa/setup-required — available only with a short-lived setup token
router.post("/setup-required", async (req, res) => {
    const payload = verifySetupToken(req.body.setupToken);
    if (!payload) {
        res.status(401).json({ error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
        return;
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
        res.status(404).json({ error: "ไม่พบผู้ใช้" });
        return;
    }
    if (user.totpEnabled) {
        res.status(400).json({ error: "2FA เปิดใช้งานอยู่แล้ว" });
        return;
    }
    const secret = (0, totp_1.generateSecret)();
    const otpauth = (0, totp_1.buildOtpauthURL)(APP_ISSUER, user.username ?? user.email, secret);
    const qrDataUrl = await qrcode_1.default.toDataURL(otpauth, { width: 256, margin: 2 });
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret, backupCodes: null } });
    res.json({ secret, qrDataUrl });
});
// POST /api/auth/2fa/enable-required — enable 2FA, then issue the normal session
router.post("/enable-required", async (req, res) => {
    const payload = verifySetupToken(req.body.setupToken);
    const code = String(req.body.code ?? "").trim();
    if (!payload) {
        res.status(401).json({ error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
        return;
    }
    if (!/^\d{6}$/.test(code)) {
        res.status(400).json({ error: "กรุณากรอกรหัส OTP 6 หลัก" });
        return;
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: payload.id },
        include: { permissions: { select: { permission: true } } },
    });
    if (!user || !user.totpSecret || user.totpEnabled) {
        res.status(400).json({ error: "ไม่สามารถตั้งค่า 2FA ได้ กรุณาเข้าสู่ระบบใหม่" });
        return;
    }
    if (!(0, totp_1.verifyTOTP)(user.totpSecret.trim(), code)) {
        res.status(400).json({ error: "รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่" });
        return;
    }
    const plainCodes = generateBackupCodes();
    const hashedCodes = await Promise.all(plainCodes.map((backupCode) => bcryptjs_1.default.hash(backupCode, 10)));
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { totpEnabled: true, backupCodes: JSON.stringify(hashedCodes) },
        }),
        prisma_1.prisma.securityAudit.create({
            data: {
                action: "ENABLE_2FA",
                actorUserId: user.id,
                targetUserId: user.id,
                actorEmail: user.email,
                targetEmail: user.email,
                ipAddress: req.ip ?? null,
            },
        }),
    ]);
    res.json({
        token: createSession(user),
        user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, permissions: (0, permissions_1.resolvePermissions)(user) },
        backupCodes: plainCodes.map(formatBackupCode),
    });
});
// GET /api/auth/2fa/status
router.get("/status", auth_1.authMiddleware, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { totpEnabled: true, backupCodes: true },
    });
    const backupCodesRemaining = user?.backupCodes
        ? JSON.parse(user.backupCodes).length
        : 0;
    res.json({ enabled: user?.totpEnabled ?? false, backupCodesRemaining });
});
// POST /api/auth/2fa/setup — generate secret + QR code (not yet active)
router.post("/setup", auth_1.authMiddleware, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
        res.status(404).json({ error: "ไม่พบผู้ใช้" });
        return;
    }
    if (user.totpEnabled) {
        res.status(400).json({ error: "2FA เปิดใช้งานอยู่แล้ว" });
        return;
    }
    const secret = (0, totp_1.generateSecret)();
    // Self-test: verify the secret works before storing
    const testToken = (0, totp_1.generateTOTP)(secret);
    if (!(0, totp_1.verifyTOTP)(secret, testToken)) {
        res.status(500).json({ error: "เกิดข้อผิดพลาดภายใน กรุณาลองใหม่" });
        return;
    }
    const otpauth = (0, totp_1.buildOtpauthURL)(APP_ISSUER, user.username ?? user.email, secret);
    const qrDataUrl = await qrcode_1.default.toDataURL(otpauth, { width: 256, margin: 2 });
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
    res.json({ secret, qrDataUrl });
});
// POST /api/auth/2fa/enable — confirm first code → activate + return backup codes
router.post("/enable", auth_1.authMiddleware, async (req, res) => {
    const { code } = req.body;
    if (!code) {
        res.status(400).json({ error: "กรุณากรอกรหัส OTP" });
        return;
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.totpSecret) {
        res.status(400).json({ error: "กรุณาตั้งค่า 2FA ก่อน" });
        return;
    }
    if (user.totpEnabled) {
        res.status(400).json({ error: "2FA เปิดใช้งานอยู่แล้ว" });
        return;
    }
    const secret = user.totpSecret.trim();
    const isValid = (0, totp_1.verifyTOTP)(secret, code.trim());
    if (!isValid) {
        console.warn(`[2FA] enable failed for ${user.email} at ${new Date().toISOString()}`);
        res.status(400).json({ error: "รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่" });
        return;
    }
    const plainCodes = generateBackupCodes();
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcryptjs_1.default.hash(c, 10)));
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true, backupCodes: JSON.stringify(hashedCodes) },
    });
    res.json({ backupCodes: plainCodes.map(formatBackupCode) });
});
// POST /api/auth/2fa/disable — turn off 2FA (requires TOTP or backup code)
router.post("/disable", auth_1.authMiddleware, async (_req, res) => {
    res.status(403).json({ error: "ระบบบังคับใช้ 2FA จึงไม่อนุญาตให้ปิดใช้งาน กรุณาติดต่อ Super Admin หากต้องการรีเซ็ต" });
});
// POST /api/auth/2fa/verify — second step of login (tempToken + code)
router.post("/verify", async (req, res) => {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
        res.status(400).json({ error: "ข้อมูลไม่ครบ" });
        return;
    }
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(tempToken, JWT_SECRET);
    }
    catch {
        res.status(401).json({ error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
        return;
    }
    if (payload.type !== "2fa_pending") {
        res.status(401).json({ error: "Token ไม่ถูกต้อง" });
        return;
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.id }, include: { permissions: { select: { permission: true } } } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
        res.status(401).json({ error: "ไม่พบผู้ใช้หรือ 2FA ไม่ได้เปิดใช้งาน" });
        return;
    }
    let valid = false;
    // Try TOTP (6-digit)
    if (/^\d{6}$/.test(code.trim())) {
        valid = (0, totp_1.verifyTOTP)(user.totpSecret.trim(), code.trim());
    }
    // Try backup code
    if (!valid && user.backupCodes) {
        const normalized = normalizeBackupCode(code);
        const hashed = JSON.parse(user.backupCodes);
        for (let i = 0; i < hashed.length; i++) {
            if (await bcryptjs_1.default.compare(normalized, hashed[i])) {
                hashed.splice(i, 1);
                await prisma_1.prisma.user.update({ where: { id: user.id }, data: { backupCodes: JSON.stringify(hashed) } });
                valid = true;
                break;
            }
        }
    }
    if (!valid) {
        console.warn(`[2FA] login verify failed for ${user.email} at ${new Date().toISOString()}`);
        res.status(401).json({ error: "รหัส OTP ไม่ถูกต้อง" });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, permissions: (0, permissions_1.resolvePermissions)(user) } });
});
exports.default = router;
