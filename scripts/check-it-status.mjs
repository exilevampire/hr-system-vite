import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const fields = ["fmis", "eMeeting", "software", "phonebook"];

for (const field of fields) {
  const rows = await prisma.employee.groupBy({
    by: [field],
    _count: { [field]: true },
  });
  console.log(`\n${field}:`);
  for (const r of rows) {
    console.log(`  "${r[field] ?? "(null)"}" → ${r._count[field]} records`);
  }
}

await prisma.$disconnect();
