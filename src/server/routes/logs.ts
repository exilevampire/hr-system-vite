import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const pageSize = parseInt(String(req.query.pageSize ?? "30"));

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { nameTh: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  res.json({ data, total, page, pageSize });
});

export default router;
