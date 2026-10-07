"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"));
function generateApiKey() {
    const apiKey = `hr_live_${crypto_1.default.randomBytes(32).toString("hex")}`;
    return { apiKey, keyHash: crypto_1.default.createHash("sha256").update(apiKey).digest("hex"), keyPrefix: `${apiKey.slice(0, 16)}...` };
}
function parseIps(value) {
    if (value === undefined || value === null)
        return [];
    if (!Array.isArray(value) || !value.every((ip) => typeof ip === "string" && ip.trim().length > 0))
        return null;
    return [...new Set(value.map((ip) => ip.trim()))];
}
router.get("/", async (_req, res) => {
    const clients = await prisma_1.prisma.integrationClient.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, keyPrefix: true, isActive: true, expiresAt: true, ipAllowlist: true, allowFullSync: true, fullSyncCompletedAt: true, fullSyncRequestId: true, lastUsedAt: true, createdBy: true, createdAt: true },
    });
    res.json(clients);
});
router.post("/", async (req, res) => {
    const { name, expiresAt, ipAllowlist, allowFullSync = true } = req.body;
    if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "กรุณาระบุชื่อระบบ" });
        return;
    }
    const ips = parseIps(ipAllowlist);
    if (!ips) {
        res.status(400).json({ error: "IP Allowlist ไม่ถูกต้อง" });
        return;
    }
    const expiry = expiresAt ? new Date(expiresAt) : null;
    if (expiry && Number.isNaN(expiry.getTime())) {
        res.status(400).json({ error: "วันหมดอายุไม่ถูกต้อง" });
        return;
    }
    const generated = generateApiKey();
    try {
        const client = await prisma_1.prisma.integrationClient.create({
            data: { name: name.trim(), keyHash: generated.keyHash, keyPrefix: generated.keyPrefix, expiresAt: expiry, ipAllowlist: ips, allowFullSync: Boolean(allowFullSync), createdBy: req.user.email },
        });
        await prisma_1.prisma.integrationClientAudit.create({ data: { clientId: client.id, clientName: client.name, action: "CREATE", actorEmail: req.user.email, ipAddress: req.ip ?? null } });
        res.status(201).json({ ...client, keyHash: undefined, apiKey: generated.apiKey });
    }
    catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
            res.status(409).json({ error: "ชื่อระบบนี้มีอยู่แล้ว" });
            return;
        }
        throw error;
    }
});
router.patch("/:id", async (req, res) => {
    const { isActive, expiresAt, ipAllowlist, allowFullSync } = req.body;
    const ips = ipAllowlist === undefined ? undefined : parseIps(ipAllowlist);
    if (ips === null) {
        res.status(400).json({ error: "IP Allowlist ไม่ถูกต้อง" });
        return;
    }
    const expiry = expiresAt === undefined ? undefined : expiresAt ? new Date(expiresAt) : null;
    if (expiry instanceof Date && Number.isNaN(expiry.getTime())) {
        res.status(400).json({ error: "วันหมดอายุไม่ถูกต้อง" });
        return;
    }
    const current = await prisma_1.prisma.integrationClient.findUnique({ where: { id: req.params.id } });
    if (!current) {
        res.status(404).json({ error: "ไม่พบ API Client" });
        return;
    }
    const client = await prisma_1.prisma.integrationClient.update({
        where: { id: current.id },
        data: { ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}), ...(expiresAt !== undefined ? { expiresAt: expiry } : {}), ...(ips !== undefined ? { ipAllowlist: ips } : {}), ...(allowFullSync !== undefined ? { allowFullSync: Boolean(allowFullSync) } : {}) },
    });
    await prisma_1.prisma.integrationClientAudit.create({ data: { clientId: client.id, clientName: client.name, action: "UPDATE", actorEmail: req.user.email, ipAddress: req.ip ?? null, details: { isActive, expiresAt, ipAllowlist: ips, allowFullSync } } });
    res.json(client);
});
router.post("/:id/rotate-key", async (req, res) => {
    const current = await prisma_1.prisma.integrationClient.findUnique({ where: { id: req.params.id } });
    if (!current) {
        res.status(404).json({ error: "ไม่พบ API Client" });
        return;
    }
    const generated = generateApiKey();
    const client = await prisma_1.prisma.integrationClient.update({ where: { id: current.id }, data: { keyHash: generated.keyHash, keyPrefix: generated.keyPrefix } });
    await prisma_1.prisma.integrationClientAudit.create({ data: { clientId: client.id, clientName: client.name, action: "ROTATE_KEY", actorEmail: req.user.email, ipAddress: req.ip ?? null } });
    res.json({ apiKey: generated.apiKey, keyPrefix: generated.keyPrefix });
});
router.post("/:id/reset-full-sync", async (req, res) => {
    const { reason } = req.body;
    if (typeof reason !== "string" || reason.trim().length < 5) {
        res.status(400).json({ error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" });
        return;
    }
    const current = await prisma_1.prisma.integrationClient.findUnique({ where: { id: req.params.id } });
    if (!current) {
        res.status(404).json({ error: "ไม่พบ API Client" });
        return;
    }
    const client = await prisma_1.prisma.integrationClient.update({ where: { id: current.id }, data: { fullSyncCompletedAt: null, fullSyncRequestId: null } });
    await prisma_1.prisma.integrationClientAudit.create({ data: { clientId: client.id, clientName: client.name, action: "RESET_FULL_SYNC", actorEmail: req.user.email, ipAddress: req.ip ?? null, details: { reason: reason.trim() } } });
    res.json({ success: true });
});
router.get("/:id/logs", async (req, res) => {
    const logs = await prisma_1.prisma.integrationApiLog.findMany({ where: { clientId: req.params.id }, orderBy: { createdAt: "desc" }, take: 100, select: { requestId: true, endpoint: true, method: true, recordedFrom: true, recordedTo: true, resultCount: true, statusCode: true, ipAddress: true, durationMs: true, errorCode: true, createdAt: true } });
    res.json(logs);
});
exports.default = router;
