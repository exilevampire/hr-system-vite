import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, requireRole } from "../middleware/auth";
import { scheduleRetireNotify } from "../lib/retireCron";
import { sendRetireNotification } from "../lib/mailer";

const router = Router();

router.get("/", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const rows = await prisma.systemSetting.findMany();
  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.value;
  res.json(result);
});

router.patch("/", authMiddleware, requireRole("SUPER_ADMIN"), async (req, res) => {
  const { retire_notify_time } = req.body as { retire_notify_time?: string };

  if (retire_notify_time !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(retire_notify_time)) {
      res.status(400).json({ error: "รูปแบบเวลาไม่ถูกต้อง (HH:MM)" });
      return;
    }
    await prisma.systemSetting.upsert({
      where: { key: "retire_notify_time" },
      update: { value: retire_notify_time },
      create: { key: "retire_notify_time", value: retire_notify_time },
    });
    scheduleRetireNotify(retire_notify_time);
  }

  res.json({ ok: true });
});

router.post("/test-retire-notify", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const notifyUsers = await prisma.user.findMany({
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

  await sendRetireNotification(recipients, mockEmployees, process.env.FRONTEND_URL ?? "");
  res.json({ ok: true, sentTo: recipients });
});

export default router;
