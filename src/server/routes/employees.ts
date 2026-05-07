import { Router } from "express";
import { prisma } from "../lib/prisma";
import { createAuditLog } from "../lib/audit";
import { authMiddleware, requireRole, AuthenticatedRequest } from "../middleware/auth";
import multer from "multer";
import * as XLSX from "xlsx";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("อนุญาตเฉพาะไฟล์ Excel (.xlsx, .xls) เท่านั้น"));
    }
  },
});

const HEADER_MAP: Record<string, string> = {
  "รหัสประจำตัว": "employeeId",
  "ชื่อ-สกุล": "nameTh",
  "name-eng": "nameEn",
  "name eng": "nameEn",
  "ตำแหน่ง": "position",
  "ระดับตำแหน่ง": "level",
  "ฝ่าย/กลุ่มงาน": "department",
  "หน่วยงาน/สำนัก": "bureau",
  "วันเริ่มงาน": "startDate",
  "วันที่พ้นสภาพ": "endDate",
  "วันที่ได้รับข้อมูล": "receivedDate",
  "หมายเหตุ": "remarks",
  "email": "email",
  "fmis": "fmis",
  "emeeting": "eMeeting",
  "website": "website",
  "3cx": "phone3cx",
  "intranet": "intranet",
  "บค. ส่ง": "hrSent",
  "บค.ส่ง": "hrSent",
};

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Excel serial number — always CE, no BE conversion needed
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const s = String(val).trim();
  if (!s) return null;

  // Thai format: DD/MM/YYYY (e.g. "17/6/2567" or "17/06/2567")
  const slashMatch = s.match(/^(\d{1,2})[/](\d{1,2})[/](\d{4})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]);
    let year = parseInt(slashMatch[3]);
    if (year > 2500) year -= 543; // BE → CE
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // ISO / Thai-ISO: YYYY-MM-DD or YYYY/MM/DD (e.g. "2567-06-17")
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    if (year > 2500) year -= 543; // BE → CE
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback: let JS try to parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

router.get("/", authMiddleware, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const pageSize = parseInt(String(req.query.pageSize ?? "20"));
  const search = String(req.query.search ?? "");
  const bureau = String(req.query.bureau ?? "");
  const position = String(req.query.position ?? "");

  const where: Record<string, unknown> = {};
  const conditions = [];

  if (search) {
    conditions.push({
      OR: [
        { nameTh: { contains: search } },
        { nameEn: { contains: search } },
        { employeeId: { contains: search } },
      ],
    });
  }
  if (bureau) conditions.push({ bureau: { contains: bureau } });
  if (position) conditions.push({ position: { contains: position } });
  if (conditions.length > 0) where.AND = conditions;

  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

router.post("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const body = req.body;
  const adminUser = body.adminUser ?? req.user?.email ?? "unknown";

  try {
    const employee = await prisma.employee.create({
      data: {
        employeeId: body.employeeId,
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
        position: body.position || null,
        level: body.level || null,
        department: body.department || null,
        bureau: body.bureau || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        receivedDate: body.receivedDate ? new Date(body.receivedDate) : null,
        remarks: body.remarks || null,
        email: body.email || null,
        fmis: body.fmis || null,
        eMeeting: body.eMeeting || null,
        website: body.website || null,
        phone3cx: body.phone3cx || null,
        intranet: body.intranet || null,
        hrSent: body.hrSent || null,
        createdBy: adminUser,
        updatedBy: adminUser,
      },
    });

    await createAuditLog(employee.employeeId, "CREATE", adminUser);
    res.status(201).json(employee);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("Unique constraint")) {
      res.status(400).json({ error: "รหัสพนักงานซ้ำในระบบ" });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

router.post("/import", authMiddleware, requireRole("SUPER_ADMIN", "HR_ADMIN"), upload.single("file"), async (req: AuthenticatedRequest, res) => {
  const adminUser = (req.body.adminUser as string) ?? req.user?.email ?? "unknown";

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

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const raw: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const mapped = HEADER_MAP[h] ?? HEADER_MAP[h.replace(/\s+/g, " ")];
      if (mapped) raw[mapped] = row[idx];
    });

    const employeeId = String(raw.employeeId ?? "").trim();
    const nameTh = String(raw.nameTh ?? "").trim();

    if (!employeeId || !nameTh) {
      if (employeeId || nameTh) errors.push(`แถว ${i + 1}: ข้อมูลไม่ครบถ้วน`);
      continue;
    }

    const exists = await prisma.employee.findUnique({ where: { employeeId } });
    if (exists) { skipped++; continue; }

    try {
      const emp = await prisma.employee.create({
        data: {
          employeeId,
          nameTh,
          nameEn: String(raw.nameEn ?? "").trim() || null,
          position: String(raw.position ?? "").trim() || null,
          level: String(raw.level ?? "").trim() || null,
          department: String(raw.department ?? "").trim() || null,
          bureau: String(raw.bureau ?? "").trim() || null,
          startDate: parseDate(raw.startDate),
          endDate: parseDate(raw.endDate),
          receivedDate: parseDate(raw.receivedDate),
          remarks: String(raw.remarks ?? "").trim() || null,
          email: String(raw.email ?? "").trim() || null,
          fmis: String(raw.fmis ?? "").trim() || null,
          eMeeting: String(raw.eMeeting ?? "").trim() || null,
          website: String(raw.website ?? "").trim() || null,
          phone3cx: String(raw.phone3cx ?? "").trim() || null,
          intranet: String(raw.intranet ?? "").trim() || null,
          hrSent: (() => { const d = parseDate(raw.hrSent); return d ? d.toISOString().split("T")[0] : null; })(),
          createdBy: adminUser,
          updatedBy: adminUser,
        },
      });
      await createAuditLog(emp.employeeId, "CREATE", adminUser);
      success++;
    } catch (err) {
      errors.push(`แถว ${i + 1} (${employeeId}): ${err instanceof Error ? err.message : "error"}`);
    }
  }

  res.json({ success, skipped, errors });
});

router.get("/meta", authMiddleware, async (_req, res) => {
  const [positions, bureaus] = await Promise.all([
    prisma.employee.findMany({
      where: { position: { not: null } },
      select: { position: true },
      distinct: ["position"],
      orderBy: { position: "asc" },
    }),
    prisma.employee.findMany({
      where: { bureau: { not: null } },
      select: { bureau: true },
      distinct: ["bureau"],
      orderBy: { bureau: "asc" },
    }),
  ]);
  res.json({
    positions: positions.map((p) => p.position).filter(Boolean) as string[],
    bureaus: bureaus.map((b) => b.bureau).filter(Boolean) as string[],
  });
});

router.get("/:employeeId", authMiddleware, async (req, res) => {
  const { employeeId } = req.params;
  const employee = await prisma.employee.findUnique({ where: { employeeId } });
  if (!employee) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(employee);
});

router.patch("/:employeeId", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { employeeId } = req.params;
  const body = req.body;
  const adminUser = body.adminUser ?? req.user?.email ?? "unknown";

  const old = await prisma.employee.findUnique({ where: { employeeId } });
  if (!old) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updated = await prisma.employee.update({
    where: { employeeId },
    data: {
      nameTh: body.nameTh,
      nameEn: body.nameEn || null,
      position: body.position || null,
      level: body.level || null,
      department: body.department || null,
      bureau: body.bureau || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      receivedDate: body.receivedDate ? new Date(body.receivedDate) : null,
      remarks: body.remarks || null,
      email: body.email || null,
      fmis: body.fmis || null,
      eMeeting: body.eMeeting || null,
      website: body.website || null,
      phone3cx: body.phone3cx || null,
      intranet: body.intranet || null,
      hrSent: body.hrSent || null,
      updatedBy: adminUser,
    },
  });

  await createAuditLog(
    employeeId,
    "UPDATE",
    adminUser,
    old as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>
  );

  res.json(updated);
});

router.delete("/:employeeId", authMiddleware, requireRole("SUPER_ADMIN"), async (req: AuthenticatedRequest, res) => {
  const { employeeId } = req.params;
  const adminUser = req.user?.email ?? "unknown";

  await createAuditLog(employeeId, "DELETE", adminUser);
  await prisma.employee.delete({ where: { employeeId } });

  res.json({ success: true });
});

export default router;
