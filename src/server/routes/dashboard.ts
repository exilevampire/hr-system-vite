import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, async (_req, res) => {
  const [total, allEmployees] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.findMany({
      select: { bureau: true, endDate: true, fmis: true, eMeeting: true, website: true, phone3cx: true, intranet: true, hrSent: true },
    }),
  ]);

  const bureauMap: Record<string, number> = {};
  for (const e of allEmployees) {
    const b = e.bureau ?? "ไม่ระบุ";
    bureauMap[b] = (bureauMap[b] ?? 0) + 1;
  }
  const byBureau = Object.entries(bureauMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([bureau, count]) => ({ bureau, count }));

  const monthMap: Record<string, number> = {};
  for (const e of allEmployees) {
    if (!e.endDate) continue;
    const d = new Date(e.endDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = (monthMap[key] ?? 0) + 1;
  }
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  let cleared = 0;
  for (const e of allEmployees) {
    const itFields = [e.fmis, e.eMeeting, e.website, e.phone3cx, e.intranet, e.hrSent];
    if (itFields.every((f) => f && f.trim() !== "")) cleared++;
  }
  const itStatus = { cleared, pending: total - cleared };

  res.json({ total, byBureau, byMonth, itStatus });
});

export default router;
