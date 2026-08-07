import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, requireRole, AuthenticatedRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";

const router = Router();
const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "VIEWER"];

router.get("/", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, notifyOnImport: true, notifyOnRetire: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

router.post("/", authMiddleware, requireRole("SUPER_ADMIN"), async (req, res) => {
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(400).json({ error: "Email นี้มีในระบบแล้ว" });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: name || null, email, password: hashed, role: role ?? "VIEWER" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json(user);
});

router.patch("/:id", authMiddleware, requireRole("SUPER_ADMIN"), async (req: AuthenticatedRequest, res) => {
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
    const conflict = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (conflict) {
      res.status(400).json({ error: "Email นี้มีในระบบแล้ว" });
      return;
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name || null;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (notifyOnImport !== undefined) data.notifyOnImport = Boolean(notifyOnImport);
  if (notifyOnRetire !== undefined) data.notifyOnRetire = Boolean(notifyOnRetire);
  if (password) data.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, notifyOnImport: true, notifyOnRetire: true },
  });
  res.json(user);
});

router.delete("/:id", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const { id } = _req.params;
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
