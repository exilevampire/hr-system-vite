import * as dotenv from "dotenv";
dotenv.config();
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "mysql://root:password@localhost:3306/hr_integrity_db";
const match = url.match(/mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)/);
if (!match) throw new Error("Invalid DATABASE_URL");

const adapter = new PrismaMariaDb({
  host: match[3],
  port: parseInt(match[4]),
  user: match[1],
  password: match[2],
  database: match[5],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const password = await bcrypt.hash("admin1234", 12);

  await prisma.user.upsert({
    where: { email: "superadmin@redcross.or.th" },
    update: {},
    create: { name: "Super Admin", email: "superadmin@redcross.or.th", password, role: "SUPER_ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "hradmin@redcross.or.th" },
    update: {},
    create: { name: "HR Admin", email: "hradmin@redcross.or.th", password, role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "viewer@redcross.or.th" },
    update: {},
    create: { name: "Viewer", email: "viewer@redcross.or.th", password, role: "VIEWER" },
  });

  console.log("✅ Seed completed");
  console.log("Super Admin: superadmin@redcross.or.th / admin1234");
  console.log("HR Admin:    hradmin@redcross.or.th / admin1234");
  console.log("Viewer:      viewer@redcross.or.th / admin1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
