import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, requireRole, AuthenticatedRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";

const router = Router();

router.get("/", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
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
  const user = await prisma.user.update({
    where: { id },
    data: { role: req.body.role },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(user);
});

router.delete("/:id", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const { id } = _req.params;
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
