"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const retireCron_1 = require("../lib/retireCron");
const mailer_1 = require("../lib/mailer");
const router = (0, express_1.Router)();
router.get("/", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (_req, res) => {
    const rows = await prisma_1.prisma.systemSetting.findMany();
    const result = {};
    for (const r of rows)
        result[r.key] = r.value;
    res.json(result);
});
router.patch("/", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (req, res) => {
    const { retire_notify_time } = req.body;
    if (retire_notify_time !== undefined) {
        if (!/^\d{2}:\d{2}$/.test(retire_notify_time)) {
            res.status(400).json({ error: "รูปแบบเวลาไม่ถูกต้อง (HH:MM)" });
            return;
        }
        await prisma_1.prisma.systemSetting.upsert({
            where: { key: "retire_notify_time" },
            update: { value: retire_notify_time },
            create: { key: "retire_notify_time", value: retire_notify_time },
        });
        (0, retireCron_1.scheduleRetireNotify)(retire_notify_time);
    }
    res.json({ ok: true });
});
router.post("/test-retire-notify", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (_req, res) => {
    const notifyUsers = await prisma_1.prisma.user.findMany({
        where: { notifyOnRetire: true },
        select: { email: true },
    });
    const recipients = notifyUsers.map((u) => u.email);
    if (recipients.length === 0) {
        res.status(400).json({ error: "ไม่มีผู้ใช้ที่เปิดการแจ้งเตือนพ้นสภาพ" });
        return;
    }
    const mockEmployees = [
        { nameTh: "นายทดสอบ ระบบแจ้งเตือน", position: "นักวิชาการ", bureau: "สำนักบริหารบุคคล", department: "ฝ่ายทดสอบระบบ" },
    ];
    await (0, mailer_1.sendRetireNotification)(recipients, mockEmployees, process.env.FRONTEND_URL ?? "");
    res.json({ ok: true, sentTo: recipients });
});
exports.default = router;
