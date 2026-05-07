import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";
const APP_NAME = process.env.APP_NAME ?? "HR System";

function generateBackupCodes(): string[] {
  return Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
}

function formatBackupCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function normalizeCode(input: string): string {
  return input.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
}

// GET /api/auth/2fa/status
router.get("/status", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { totpEnabled: true, backupCodes: true },
  });
  const backupCodesRemaining = user?.backupCodes
    ? (JSON.parse(user.backupCodes) as string[]).length
    : 0;
  res.json({ enabled: user?.totpEnabled ?? false, backupCodesRemaining });
});

// POST /api/auth/2fa/setup — generate secret + QR code (not yet active)
router.post("/setup", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) { res.status(404).json({ error: "ไม่พบผู้ใช้" }); return; }
  if (user.totpEnabled) { res.status(400).json({ error: "2FA เปิดใช้งานอยู่แล้ว" }); return; }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, APP_NAME, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 256, margin: 2 });

  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });

  res.json({ secret, qrDataUrl });
});

// POST /api/auth/2fa/enable — confirm first code → activate + return backup codes
router.post("/enable", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "กรุณากรอกรหัส OTP" }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !user.totpSecret) { res.status(400).json({ error: "กรุณาตั้งค่า 2FA ก่อน" }); return; }
  if (user.totpEnabled) { res.status(400).json({ error: "2FA เปิดใช้งานอยู่แล้ว" }); return; }

  const isValid = authenticator.verify({ token: code, secret: user.totpSecret });
  if (!isValid) { res.status(400).json({ error: "รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่" }); return; }

  const plainCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, backupCodes: JSON.stringify(hashedCodes) },
  });

  res.json({ backupCodes: plainCodes.map(formatBackupCode) });
});

// POST /api/auth/2fa/disable — turn off 2FA (requires TOTP or backup code)
router.post("/disable", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "กรุณากรอกรหัส" }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !user.totpEnabled) { res.status(400).json({ error: "2FA ไม่ได้เปิดใช้งาน" }); return; }

  let valid = false;

  // Try TOTP (6-digit)
  if (/^\d{6}$/.test(code.trim()) && user.totpSecret) {
    valid = authenticator.verify({ token: code.trim(), secret: user.totpSecret });
  }

  // Try backup code
  if (!valid && user.backupCodes) {
    const normalized = normalizeCode(code);
    const hashed: string[] = JSON.parse(user.backupCodes);
    for (let i = 0; i < hashed.length; i++) {
      if (await bcrypt.compare(normalized, hashed[i])) {
        hashed.splice(i, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { backupCodes: JSON.stringify(hashed) },
        });
        valid = true;
        break;
      }
    }
  }

  if (!valid) { res.status(400).json({ error: "รหัสไม่ถูกต้อง" }); return; }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, backupCodes: null },
  });

  res.json({ success: true });
});

// POST /api/auth/2fa/verify — second step of login (tempToken + code)
router.post("/verify", async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) { res.status(400).json({ error: "ข้อมูลไม่ครบ" }); return; }

  let payload: { id: string; type: string };
  try {
    payload = jwt.verify(tempToken, JWT_SECRET) as typeof payload;
  } catch {
    res.status(401).json({ error: "Token หมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" });
    return;
  }
  if (payload.type !== "2fa_pending") {
    res.status(401).json({ error: "Token ไม่ถูกต้อง" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(401).json({ error: "ไม่พบผู้ใช้หรือ 2FA ไม่ได้เปิดใช้งาน" });
    return;
  }

  let valid = false;

  // Try TOTP
  if (/^\d{6}$/.test(code.trim())) {
    valid = authenticator.verify({ token: code.trim(), secret: user.totpSecret });
  }

  // Try backup code
  if (!valid && user.backupCodes) {
    const normalized = normalizeCode(code);
    const hashed: string[] = JSON.parse(user.backupCodes);
    for (let i = 0; i < hashed.length; i++) {
      if (await bcrypt.compare(normalized, hashed[i])) {
        hashed.splice(i, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { backupCodes: JSON.stringify(hashed) },
        });
        valid = true;
        break;
      }
    }
  }

  if (!valid) { res.status(401).json({ error: "รหัส OTP ไม่ถูกต้อง" }); return; }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

export default router;
