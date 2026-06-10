import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, async (_req, res) => {
  const sources = await prisma.dataSource.findMany({
    orderBy: [{ sourceType: "asc" }, { year: "desc" }, { month: "desc" }],
  });
  res.json(sources);
});

router.post("/", authMiddleware, requireRole("SUPER_ADMIN"), async (req, res) => {
  const { sourceType, month, year } = req.body;
  if (!sourceType || !month || !year) {
    res.status(400).json({ error: "ต้องระบุ sourceType, month และ year" });
    return;
  }
  try {
    const existing = await prisma.dataSource.findFirst({
      where: { sourceType: Number(sourceType), month: Number(month), year: Number(year) },
    });
    if (existing) { res.json(existing); return; }
    const ds = await prisma.dataSource.create({
      data: { sourceType: Number(sourceType), month: Number(month), year: Number(year) },
    });
    res.status(201).json(ds);
  } catch {
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

export default router;
