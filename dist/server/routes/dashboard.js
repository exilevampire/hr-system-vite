"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.authMiddleware, async (_req, res) => {
    const [total, allEmployees] = await Promise.all([
        prisma_1.prisma.employee.count(),
        prisma_1.prisma.employee.findMany({
            select: { bureau: true, endDate: true, fmis: true, eMeeting: true, software: true, phonebook: true, email: true },
        }),
    ]);
    const bureauMap = {};
    for (const e of allEmployees) {
        const b = e.bureau ?? "ไม่ระบุ";
        bureauMap[b] = (bureauMap[b] ?? 0) + 1;
    }
    const sortedBureau = Object.entries(bureauMap)
        .sort((a, b) => b[1] - a[1])
        .map(([bureau, count]) => ({ bureau, count }));
    const byBureau = sortedBureau.slice(0, 10);
    const allByBureau = sortedBureau;
    const monthMap = {};
    for (const e of allEmployees) {
        if (!e.endDate)
            continue;
        const d = new Date(e.endDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = (monthMap[key] ?? 0) + 1;
    }
    const allByMonth = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));
    const byMonth = allByMonth.slice(-12);
    let cleared = 0;
    let withEmail = 0;
    const itBreakdown = {
        fmis: { done: 0, pending: 0, na: 0, unknown: 0 },
        eMeeting: { done: 0, pending: 0, na: 0, unknown: 0 },
        software: { done: 0, pending: 0, na: 0, unknown: 0 },
        phonebook: { done: 0, pending: 0, na: 0, unknown: 0 },
    };
    for (const e of allEmployees) {
        const itFields = [e.fmis, e.eMeeting, e.software, e.phonebook];
        if (itFields.every((v) => v === "ดำเนินการแล้ว" || v === "ไม่พบบัญชี" || v === "ไม่ทราบสถานะ"))
            cleared++;
        if (e.email)
            withEmail++;
        for (const [key, val] of [
            ["fmis", e.fmis], ["eMeeting", e.eMeeting],
            ["software", e.software], ["phonebook", e.phonebook],
        ]) {
            if (val === "ดำเนินการแล้ว")
                itBreakdown[key].done++;
            else if (val === "ยังไม่ดำเนินการ")
                itBreakdown[key].pending++;
            else if (val === "ไม่ทราบสถานะ")
                itBreakdown[key].unknown++;
            else
                itBreakdown[key].na++;
        }
    }
    const itStatus = { cleared, pending: total - cleared };
    const emailStats = { withEmail, withoutEmail: total - withEmail };
    res.json({ total, byBureau, allByBureau, byMonth, allByMonth, itStatus, itBreakdown, emailStats });
});
exports.default = router;
