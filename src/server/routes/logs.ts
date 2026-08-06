import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const pageSize = parseInt(String(req.query.pageSize ?? "30"));
  const search = String(req.query.search ?? "").trim();
  const action = String(req.query.action ?? "");
  const adminUser = String(req.query.adminUser ?? "").trim();
  const dateFrom = String(req.query.dateFrom ?? "");
  const dateTo = String(req.query.dateTo ?? "");

  const conditions: object[] = [];

  if (search) {
    conditions.push({
      OR: [
        { employeeId: { contains: search } },
        { employee: { nameTh: { contains: search } } },
      ],
    });
  }

  if (action && action !== "ALL") {
    conditions.push({ action });
  }

  if (adminUser) {
    conditions.push({ adminUser: { contains: adminUser } });
  }

  if (dateFrom) {
    conditions.push({ createdAt: { gte: new Date(dateFrom) } });
  }

  if (dateTo) {
    conditions.push({ createdAt: { lte: new Date(dateTo + "T23:59:59") } });
  }

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { nameTh: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

export default router;
