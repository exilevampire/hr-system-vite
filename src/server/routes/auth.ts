import { Router } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { resolvePermissions } from "../lib/permissions";

const router = Router();
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
    user = await prisma.user.findFirst({
      where: identifier.includes("@") ? { email: identifier } : { username: identifier },
      include: { permissions: { select: { permission: true } } },
    });
  } catch (err) {
    console.error("[Auth] database error during login:", err);
    res.status(503).json({ error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่ภายหลัง" });
    return;
  }

  if (!user) {
    console.warn(`[Auth] login failed - unknown identifier: ${identifier} from IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(401).json({ error: "Username, Email หรือรหัสผ่านไม่ถูกต้อง" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    console.warn(`[Auth] login failed - wrong password for: ${identifier} from IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(401).json({ error: "Username, Email หรือรหัสผ่านไม่ถูกต้อง" });
    return;
  }

  if (user.totpEnabled) {
    const tempToken = jwt.sign({ id: user.id, type: "2fa_pending" }, JWT_SECRET, { expiresIn: "5m" });
    res.json({ requires2fa: true, tempToken });
    return;
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role, permissions: resolvePermissions(user) } });
});

router.get("/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

export default router;
