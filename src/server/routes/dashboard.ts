import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware, async (_req, res) => {
  const [total, allEmployees] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.findMany({
      select: { bureau: true, endDate: true, fmis: true, eMeeting: true, website: true, phone3cx: true, intranet: true },
    }),
  ]);

  const bureauMap: Record<string, number> = {};
  for (const e of allEmployees) {
    const b = e.bureau ?? "ไม่ระบุ";
    bureauMap[b] = (bureauMap[b] ?? 0) + 1;
  }
  const sortedBureau = Object.entries(bureauMap)
    .sort((a, b) => b[1] - a[1])
    .map(([bureau, count]) => ({ bureau, count }));
  const byBureau = sortedBureau.slice(0, 10);
  const allByBureau = sortedBureau;

  const monthMap: Record<string, number> = {};
  for (const e of allEmployees) {
    if (!e.endDate) continue;
    const d = new Date(e.endDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = (monthMap[key] ?? 0) + 1;
  }
  const allByMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
  const byMonth = allByMonth.slice(-12);

  let cleared = 0;
  for (const e of allEmployees) {
    const itFields = [e.fmis, e.eMeeting, e.website, e.phone3cx, e.intranet];
    const noneIsPending = itFields.every((v) => !v || v === "ดำเนินการแล้ว");
    const atLeastOneDone = itFields.some((v) => v === "ดำเนินการแล้ว");
    if (noneIsPending && atLeastOneDone) cleared++;
  }
  const itStatus = { cleared, pending: total - cleared };

  res.json({ total, byBureau, allByBureau, byMonth, allByMonth, itStatus });
});

export default router;
