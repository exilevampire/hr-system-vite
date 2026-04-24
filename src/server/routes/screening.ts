import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import multer from "multer";
import * as XLSX from "xlsx";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", authMiddleware, async (req, res) => {
  const q = String(req.query.q ?? "");
  if (!q.trim()) {
    res.json({ found: false });
    return;
  }

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { nameTh: { contains: q } },
        { nameEn: { contains: q } },
        { employeeId: { contains: q } },
      ],
    },
  });

  if (!employee) {
    res.json({ found: false });
    return;
  }
  res.json({ found: true, employee });
});

router.post("/bulk", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "ไม่พบไฟล์" });
    return;
  }

  const buffer = req.file.buffer;
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  if (rows.length < 2) {
    res.status(400).json({ error: "ไฟล์ว่างเปล่า" });
    return;
  }

  const headers = (rows[0] as string[]).map((h) => String(h ?? "").toLowerCase().trim());
  const nameIdx = headers.findIndex((h) => ["ชื่อ", "name", "ชื่อ-สกุล"].includes(h));
  const idIdx = headers.findIndex((h) => ["รหัส", "id", "รหัสประจำตัว", "employeeid"].includes(h));

  if (nameIdx === -1 && idIdx === -1) {
    res.status(400).json({ error: "ไม่พบคอลัมน์ชื่อหรือรหัสในไฟล์" });
    return;
  }

  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const query = String(row[nameIdx !== -1 ? nameIdx : idIdx] ?? "").trim();
    if (!query) continue;

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { nameTh: { contains: query } },
          { nameEn: { contains: query } },
          { employeeId: { contains: query } },
        ],
      },
      select: { nameTh: true, bureau: true, endDate: true },
    });

    results.push({ query, found: !!employee, employee: employee ?? undefined });
  }

  res.json({ results });
});

export default router;
