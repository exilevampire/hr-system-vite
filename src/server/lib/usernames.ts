import { prisma } from "./prisma";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

export function normalizeUsername(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function validateUsername(value: unknown): string | null {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username)) {
    return "Username ต้องมี 3-50 ตัวอักษร และใช้ได้เฉพาะ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง";
  }
  return null;
}

function usernameBase(email: string, id: string): string {
  const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const base = local.replace(/^[._-]+/, "").slice(0, 42);
  return base.length >= 3 ? base : `user-${id.slice(-8).toLowerCase()}`;
}

export async function backfillUsernames(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  for (const user of users) {
    const base = usernameBase(user.email, user.id);
    let suffix = 0;
    while (true) {
      const ending = suffix ? `-${suffix}` : "";
      const username = `${base.slice(0, 50 - ending.length)}${ending}`;
      const conflict = await prisma.user.findFirst({ where: { username }, select: { id: true } });
      if (!conflict) {
        await prisma.user.update({ where: { id: user.id }, data: { username } });
        break;
      }
      suffix++;
    }
  }
}
