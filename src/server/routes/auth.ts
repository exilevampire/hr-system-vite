import { Router } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email และรหัสผ่านจำเป็น" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.warn(`[Auth] login failed - unknown email: ${email} from IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    console.warn(`[Auth] login failed - wrong password for: ${email} from IP: ${req.ip} at ${new Date().toISOString()}`);
    res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    return;
  }

  if (user.totpEnabled) {
    const tempToken = jwt.sign({ id: user.id, type: "2fa_pending" }, JWT_SECRET, { expiresIn: "5m" });
    res.json({ requires2fa: true, tempToken });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.get("/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

export default router;
