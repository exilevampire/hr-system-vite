import cron, { ScheduledTask } from "node-cron";
import { prisma } from "./prisma";
import { sendRetireNotification } from "./mailer";

let task: ScheduledTask | null = null;

export function scheduleRetireNotify(time: string) {
  if (task) task.stop();
  const parts = time.split(":");
  const hour = parts[0];
  const minute = parts[1];
  if (!hour || !minute) return;
  task = cron.schedule(
    `${minute} ${hour} * * *`,
    runRetireCheck,
    { timezone: "Asia/Bangkok" }
  );
  console.log(`🔔 Retire notify scheduled at ${time} (Bangkok)`);
}

async function runRetireCheck() {
  try {
    // Use Bangkok timezone to avoid server timezone mismatch on production
    const bangkokDateStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
    const now = new Date(bangkokDateStr);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const retirees = await prisma.employee.findMany({
      where: { endDate: { gte: now, lt: tomorrow } },
      select: { nameTh: true, position: true, bureau: true, department: true },
    });

    if (retirees.length === 0) {
      console.log("🔔 Retire check: no retirees today");
      return;
    }

    const notifyUsers = await prisma.user.findMany({
      where: { notifyOnRetire: true },
      select: { email: true },
    });

    const recipients = notifyUsers.map((u) => u.email);
    if (recipients.length === 0) return;

    await sendRetireNotification(
      recipients,
      retirees,
      process.env.FRONTEND_URL ?? ""
    );

    console.log(`✉️  Retire notification sent: ${retirees.length} employees → ${recipients.length} recipients`);
  } catch (err) {
    console.error("Retire cron error:", err);
  }
}
