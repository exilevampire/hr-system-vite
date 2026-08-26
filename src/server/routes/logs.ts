import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const SOURCE_TYPE_LABELS: Record<number, string> = { 1: "สบค.", 2: "ศล." };
const THAI_MONTHS_FULL = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

async function resolveDataSourceLabels(data: { changedFields: unknown }[]) {
  const ids = new Set<number>();
  for (const log of data) {
    const fields = log.changedFields as Record<string, { old: unknown; new: unknown }> | null;
    const change = fields?.dataSourceId;
    if (!change) continue;
    if (typeof change.old === "number") ids.add(change.old);
    if (typeof change.new === "number") ids.add(change.new);
  }
  if (ids.size === 0) return;

  const sources = await prisma.dataSource.findMany({ where: { id: { in: [...ids] } } });
  const labelById = new Map(
    sources.map((s) => [s.id, `${SOURCE_TYPE_LABELS[s.sourceType] ?? `ต้นทาง ${s.sourceType}`} ${THAI_MONTHS_FULL[s.month] ?? s.month} ${s.year}`])
  );

  for (const log of data) {
    const fields = log.changedFields as Record<string, { old: unknown; new: unknown }> | null;
    const change = fields?.dataSourceId;
    if (!change) continue;
    if (typeof change.old === "number") change.old = labelById.get(change.old) ?? `ไม่พบข้อมูลต้นทาง (#${change.old})`;
    if (typeof change.new === "number") change.new = labelById.get(change.new) ?? `ไม่พบข้อมูลต้นทาง (#${change.new})`;
  }
}

router.get("/", authMiddleware, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const pageSize = parseInt(String(req.query.pageSize ?? "30"));
  const search = String(req.query.search ?? "").trim();
  const action = String(req.query.action ?? "");
  const adminUser = String(req.query.adminUser ?? "").trim();
  const source = String(req.query.source ?? "");
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

  if (source && source !== "ALL") {
    conditions.push({ source });
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

  await resolveDataSourceLabels(data);

  res.json({ data, total, page, pageSize });
});

export default router;
