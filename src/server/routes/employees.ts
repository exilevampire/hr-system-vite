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
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("อนุญาตเฉพาะไฟล์ Excel (.xlsx, .xls) หรือ CSV (.csv) เท่านั้น"));
    }
  },
});

const HEADER_MAP: Record<string, string> = {
  "ชื่อไฟล์": "sourceFile",
  "ชื่อไฟล์": "sourceFile",
  "รหัสประจำตัว": "employeeId",
  "ชื่อ-สกุล": "nameTh",
  "name-eng": "nameEn",
  "name eng": "nameEn",
  "ตำแหน่ง": "position",
  "ประเภท": "level",
  "ฝ่าย/กลุ่ม/งาน": "department",
  "ฝ่าย/กลุ่มงาน": "department",
  "หน่วยงาน": "bureau",
  "หน่วยงาน/สำนัก": "bureau",
  "วันเริ่มงาน": "startDate",
  "วันที่พ้นสภาพ": "endDate",
  "วันที่ได้รับข้อมูล": "receivedDate",
  "fmis": "fmis",
  "emeeting": "eMeeting",
  "website": "website",
  "3cx": "phone3cx",
  "intranet": "intranet",
};

const VALID_IT_VALUES = new Set(["ดำเนินการแล้ว", "ยังไม่ดำเนินการ"]);

function normalizeITStatus(val: unknown): string | null {
  const s = String(val ?? "").trim();
  return VALID_IT_VALUES.has(s) ? s : null;
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    let year = val.getUTCFullYear();
    if (year > 2500) year -= 543;
    return new Date(Date.UTC(year, val.getUTCMonth(), val.getUTCDate()));
  }
  if (typeof val === "number") {
    // Excel serial number — always CE, no BE conversion needed
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
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
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(d.getTime())) return d;
  }

  // ISO / Thai-ISO: YYYY-MM-DD or YYYY/MM/DD (e.g. "2567-06-17")
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    if (year > 2500) year -= 543; // BE → CE
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

router.get("/", authMiddleware, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"));
  const pageSize = parseInt(String(req.query.pageSize ?? "20"));
  const search = String(req.query.search ?? "");
  const bureau = String(req.query.bureau ?? "");
  const position = String(req.query.position ?? "");
  const level = String(req.query.level ?? "");
  const department = String(req.query.department ?? "");
  const endDateFrom = String(req.query.endDateFrom ?? "");
  const endDateTo = String(req.query.endDateTo ?? "");
  const fmisStatus = String(req.query.fmisStatus ?? "");
  const eMeetingStatus = String(req.query.eMeetingStatus ?? "");
  const websiteStatus = String(req.query.websiteStatus ?? "");
  const phone3cxStatus = String(req.query.phone3cxStatus ?? "");
  const intranetStatus = String(req.query.intranetStatus ?? "");
  const itDateFrom = String(req.query.itDateFrom ?? "");
  const itDateTo = String(req.query.itDateTo ?? "");

  const where: Record<string, unknown> = {};
  const conditions: unknown[] = [];

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
  if (level) conditions.push({ level: { contains: level } });
  if (department) conditions.push({ department: { contains: department } });

  // วันที่พ้นสภาพ range
  if (endDateFrom) conditions.push({ endDate: { gte: new Date(endDateFrom) } });
  if (endDateTo) conditions.push({ endDate: { lte: new Date(endDateTo + "T23:59:59") } });

  // IT status + IT date range
  const itDateCond = (itDateFrom || itDateTo) ? {
    ...(itDateFrom ? { gte: new Date(itDateFrom) } : {}),
    ...(itDateTo   ? { lte: new Date(itDateTo + "T23:59:59") } : {}),
  } : null;

  const itFilters: [string, string, string][] = [
    ["fmis", fmisStatus, "fmisDate"],
    ["eMeeting", eMeetingStatus, "eMeetingDate"],
    ["website", websiteStatus, "websiteDate"],
    ["phone3cx", phone3cxStatus, "phone3cxDate"],
    ["intranet", intranetStatus, "intranetDate"],
  ];

  for (const [field, status, dateField] of itFilters) {
    if (!status) continue;
    const statusCond = status === "ไม่พบบัญชี" ? null : status;
    const cond: Record<string, unknown> = { [field]: statusCond };
    if (itDateCond && statusCond !== null) cond[dateField] = itDateCond;
    conditions.push(cond);
  }

  // ถ้าระบุ IT date โดยไม่เลือก status ใด → กรองด้วย OR ของ date ทุก field
  if (itDateCond && !fmisStatus && !eMeetingStatus && !websiteStatus && !phone3cxStatus && !intranetStatus) {
    conditions.push({
      OR: [
        { fmisDate: itDateCond },
        { eMeetingDate: itDateCond },
        { websiteDate: itDateCond },
        { phone3cxDate: itDateCond },
        { intranetDate: itDateCond },
      ],
    });
  }

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
        sourceFile: body.sourceFile || "บันทึกจากระบบ",
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
        position: body.position || null,
        level: body.level || null,
        department: body.department || null,
        bureau: body.bureau || null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        receivedDate: new Date(),
        fmis: body.fmis || null,
        fmisDate: body.fmisDate ? new Date(body.fmisDate) : null,
        eMeeting: body.eMeeting || null,
        eMeetingDate: body.eMeetingDate ? new Date(body.eMeetingDate) : null,
        website: body.website || null,
        websiteDate: body.websiteDate ? new Date(body.websiteDate) : null,
        phone3cx: body.phone3cx || null,
        phone3cxDate: body.phone3cxDate ? new Date(body.phone3cxDate) : null,
        intranet: body.intranet || null,
        intranetDate: body.intranetDate ? new Date(body.intranetDate) : null,
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
  const isCsv = /\.csv$/i.test(req.file!.originalname);
  let rows: unknown[][];

  if (isCsv) {
    // สำหรับ CSV: parse ด้วยตัวเองทั้งหมด ไม่ผ่าน XLSX เพื่อป้องกัน date auto-detection
    const text = buffer.toString("utf-8").replace(/^﻿/, ""); // strip BOM
    const lines = text.split(/\r?\n/);
    rows = lines
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const cells: string[] = [];
        let cur = "";
        let inQuote = false;
        for (let ci = 0; ci < line.length; ci++) {
          const ch = line[ci];
          if (ch === '"') {
            inQuote = !inQuote;
          } else if (ch === "," && !inQuote) {
            cells.push(cur.trim());
            cur = "";
          } else {
            cur += ch;
          }
        }
        cells.push(cur.trim());
        return cells;
      });
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  }

  if (rows.length < 2) {
    res.status(400).json({ error: "ไฟล์ว่างเปล่า" });
    return;
  }

  // strip UTF-8 BOM (﻿) ที่อาจติดมากับ CSV
  const headers = (rows[0] as string[]).map((h) => String(h ?? "").replace(/^﻿/, "").toLowerCase().trim());

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const raw: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const mapped = HEADER_MAP[h] ?? HEADER_MAP[h.replace(/\s+/g, " ")];
      if (!mapped) return;
      let v = row[idx];
      // Convert XLSX Date objects → ISO string เพื่อป้องกัน M/D/Y misparse
      if (v instanceof Date) {
        v = `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
      }
      raw[mapped] = v;
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
          sourceFile: String(raw.sourceFile ?? "").trim() || null,
          nameTh,
          nameEn: String(raw.nameEn ?? "").trim() || null,
          position: String(raw.position ?? "").trim() || null,
          level: String(raw.level ?? "").trim() || null,
          department: String(raw.department ?? "").trim() || null,
          bureau: String(raw.bureau ?? "").trim() || null,
          startDate: parseDate(raw.startDate),
          endDate: parseDate(raw.endDate),
          receivedDate: new Date(),
          fmis: normalizeITStatus(raw.fmis),
          eMeeting: normalizeITStatus(raw.eMeeting),
          website: normalizeITStatus(raw.website),
          phone3cx: normalizeITStatus(raw.phone3cx),
          intranet: normalizeITStatus(raw.intranet),
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
  const [positions, bureaus, levels, departments] = await Promise.all([
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
    prisma.employee.findMany({
      where: { level: { not: null } },
      select: { level: true },
      distinct: ["level"],
      orderBy: { level: "asc" },
    }),
    prisma.employee.findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ["department"],
      orderBy: { department: "asc" },
    }),
  ]);
  res.json({
    positions:   positions.map((p) => p.position).filter(Boolean) as string[],
    bureaus:     bureaus.map((b) => b.bureau).filter(Boolean) as string[],
    levels:      levels.map((l) => l.level).filter(Boolean) as string[],
    departments: departments.map((d) => d.department).filter(Boolean) as string[],
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
      endDate: body.endDate ? new Date(body.endDate) : null,
      fmis: body.fmis || null,
      fmisDate: body.fmisDate ? new Date(body.fmisDate) : null,
      eMeeting: body.eMeeting || null,
      eMeetingDate: body.eMeetingDate ? new Date(body.eMeetingDate) : null,
      website: body.website || null,
      websiteDate: body.websiteDate ? new Date(body.websiteDate) : null,
      phone3cx: body.phone3cx || null,
      phone3cxDate: body.phone3cxDate ? new Date(body.phone3cxDate) : null,
      intranet: body.intranet || null,
      intranetDate: body.intranetDate ? new Date(body.intranetDate) : null,
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
