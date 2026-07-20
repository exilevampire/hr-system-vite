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
  "ข้อมูลต้นทาง": "sourceType",
  "เดือน": "sourceMonth",
  "ปี": "sourceYear",
  "วันที่ได้รับข้อมูล": "receivedDate",
  "รหัสประจำตัว": "employeeId",
  "ชื่อ-สกุล": "nameTh",
  "name-eng": "nameEn",
  "name eng": "nameEn",
  "ตำแหน่ง": "position",
  "ประเภท": "level",
  "ระดับตำแหน่ง": "level",
  "ฝ่าย/กลุ่ม/งาน": "department",
  "ฝ่าย/กลุ่มงาน": "department",
  "หน่วยงาน": "bureau",
  "หน่วยงาน/สำนัก": "bureau",
  "วันที่พ้นสภาพ": "endDate",
  "อีเมล": "email",
  "เมล": "email",
  "e-mail": "email",
  "email": "email",
  "fmis": "fmis",
  "วันที่ fmis": "fmisDate",
  "emeeting": "eMeeting",
  "วันที่ emeeting": "eMeetingDate",
  "software": "software",
  "วันที่ software": "softwareDate",
  "phonebook": "phonebook",
  "วันที่ phonebook": "phonebookDate",
};

const SOURCE_TYPE_NAMES: Record<number, string> = { 1: "สบค.", 2: "ศล." };

async function resolveDataSource(
  sourceType: unknown, sourceMonth: unknown, sourceYear: unknown
): Promise<number | null> {
  const st = parseInt(String(sourceType ?? "")) || 0;
  const sm = parseInt(String(sourceMonth ?? "")) || 0;
  const sy = parseInt(String(sourceYear ?? "")) || 0;
  if (!st || !sm || !sy) return null;
  let ds = await prisma.dataSource.findFirst({ where: { sourceType: st, month: sm, year: sy } });
  if (!ds) ds = await prisma.dataSource.create({ data: { sourceType: st, month: sm, year: sy } });
  return ds.id;
}

const VALID_IT_VALUES = new Set(["ดำเนินการแล้ว", "ยังไม่ดำเนินการ"]);

function normalizeITStatus(val: unknown): string {
  const s = String(val ?? "").trim();
  return VALID_IT_VALUES.has(s) ? s : "ยังไม่ดำเนินการ";
}

// Returns undefined when blank (skip), or the normalized status string for UPDATE
function parseITStatusForImport(val: unknown): string | undefined {
  const s = String(val ?? "").trim();
  if (!s) return undefined; // blank → skip, don't touch existing value
  if (s === "ดำเนินการแล้ว" || s === "ยังไม่ดำเนินการ" || s === "ไม่พบบัญชี") return s;
  return undefined; // unrecognized → skip
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    let year = val.getUTCFullYear();
    if (year > 2500) year -= 543;
    return new Date(Date.UTC(year, val.getUTCMonth(), val.getUTCDate()));
  }
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      let year = d.y;
      if (year > 2500) year -= 543; // user typed BE year → Excel stored CE year 2569+
      return new Date(Date.UTC(year, d.m - 1, d.d));
    }
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
  const softwareStatus = String(req.query.softwareStatus ?? "");
  const phonebookStatus = String(req.query.phonebookStatus ?? "");
  const itDateFrom = String(req.query.itDateFrom ?? "");
  const itDateTo = String(req.query.itDateTo ?? "");
  const sourceTypeFilter = String(req.query.sourceType ?? "");
  const sourceMonthFilter = String(req.query.sourceMonth ?? "");
  const sourceYearFilter = String(req.query.sourceYear ?? "");
  const closedStatus = String(req.query.closedStatus ?? "");
  const ALLOWED_SORT = ["employeeId", "nameTh", "nameEn", "position", "level", "bureau", "department", "endDate", "email", "createdAt"];
  const sortBy = ALLOWED_SORT.includes(String(req.query.sortBy)) ? String(req.query.sortBy) : "createdAt";
  const sortDir: "asc" | "desc" = req.query.sortDir === "asc" ? "asc" : "desc";

  const where: Record<string, unknown> = {};
  const conditions: unknown[] = [];

  if (search) {
    conditions.push({
      OR: [
        { nameTh: { contains: search } },
        { nameEn: { contains: search } },
        { employeeId: { contains: search } },
        { email: { contains: search } },
      ],
    });
  }
  if (bureau) conditions.push({ bureau: { contains: bureau } });
  if (position) conditions.push({ position: { contains: position } });
  if (level) conditions.push({ level: { contains: level } });
  if (department) conditions.push({ department: { contains: department } });
  // DataSource filters
  {
    const dsFilter: Record<string, number> = {};
    if (sourceTypeFilter) dsFilter.sourceType = Number(sourceTypeFilter);
    if (sourceMonthFilter) dsFilter.month = Number(sourceMonthFilter);
    if (sourceYearFilter) dsFilter.year = Number(sourceYearFilter);
    if (Object.keys(dsFilter).length > 0) conditions.push({ dataSource: dsFilter });
  }

  if (closedStatus === "closed") {
    // NULL = ไม่มีบัญชี = ผ่านแล้ว; ปิดสิทธิ์ = ไม่มีฟิลด์ไหนเป็น "ยังไม่ดำเนินการ"
    conditions.push({
      AND: [
        { OR: [{ fmis: null }, { NOT: { fmis: "ยังไม่ดำเนินการ" } }] },
        { OR: [{ eMeeting: null }, { NOT: { eMeeting: "ยังไม่ดำเนินการ" } }] },
        { OR: [{ software: null }, { NOT: { software: "ยังไม่ดำเนินการ" } }] },
        { OR: [{ phonebook: null }, { NOT: { phonebook: "ยังไม่ดำเนินการ" } }] },
      ],
    });
  } else if (closedStatus === "pending") {
    conditions.push({
      OR: [
        { fmis: "ยังไม่ดำเนินการ" }, { eMeeting: "ยังไม่ดำเนินการ" },
        { software: "ยังไม่ดำเนินการ" }, { phonebook: "ยังไม่ดำเนินการ" },
      ],
    });
  }

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
    ["software", softwareStatus, "softwareDate"],
    ["phonebook", phonebookStatus, "phonebookDate"],
  ];

  for (const [field, status, dateField] of itFilters) {
    if (!status) continue;
    const statusCond = status === "ไม่พบบัญชี" ? null : status;
    const cond: Record<string, unknown> = { [field]: statusCond };
    if (itDateCond && statusCond !== null) cond[dateField] = itDateCond;
    conditions.push(cond);
  }

  // ถ้าระบุ IT date โดยไม่เลือก status ใด → กรองด้วย OR ของ date ทุก field
  if (itDateCond && !fmisStatus && !eMeetingStatus && !softwareStatus && !phonebookStatus) {
    conditions.push({
      OR: [
        { fmisDate: itDateCond },
        { eMeetingDate: itDateCond },
        { softwareDate: itDateCond },
        { phonebookDate: itDateCond },
      ],
    });
  }

  if (conditions.length > 0) where.AND = conditions;

  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { dataSource: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortDir },
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

router.post("/", authMiddleware, requireRole("SUPER_ADMIN", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  const body = req.body;
  const adminUser = body.adminUser ?? req.user?.email ?? "unknown";

  if (!body.employeeId?.trim()) {
    res.status(400).json({ error: "กรุณากรอกรหัสพนักงาน" });
    return;
  }
  if (!body.nameTh?.trim()) {
    res.status(400).json({ error: "กรุณากรอกชื่อ-สกุล (ไทย)" });
    return;
  }

  try {
    const dataSourceId = await resolveDataSource(body.sourceType, body.sourceMonth, body.sourceYear);

    const employee = await prisma.employee.create({
      data: {
        employeeId: body.employeeId,
        dataSourceId,
        nameTh: body.nameTh,
        nameEn: body.nameEn || null,
        position: body.position || null,
        level: body.level || null,
        department: body.department || null,
        bureau: body.bureau || null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        receivedDate: body.receivedDate ? new Date(body.receivedDate) : new Date(),
        fmis: body.fmis || null,
        fmisDate: body.fmisDate ? new Date(body.fmisDate) : null,
        eMeeting: body.eMeeting || null,
        eMeetingDate: body.eMeetingDate ? new Date(body.eMeetingDate) : null,
        software: body.software || null,
        softwareDate: body.softwareDate ? new Date(body.softwareDate) : null,
        phonebook: body.phonebook || null,
        phonebookDate: body.phonebookDate ? new Date(body.phonebookDate) : null,
        email: body.email || null,
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
    console.error("[POST /employees]", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
});

router.post("/import", authMiddleware, requireRole("SUPER_ADMIN", "ADMIN"), upload.single("file"), async (req: AuthenticatedRequest, res) => {
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

  const UPDATABLE_LABELS: Record<string, string> = {
    nameTh: "ชื่อ-สกุล (ไทย)", nameEn: "ชื่อ-สกุล (อังกฤษ)", position: "ตำแหน่ง",
    level: "ประเภท", department: "ฝ่าย/กลุ่มงาน", bureau: "หน่วยงาน/สำนัก",
    endDate: "วันพ้นสภาพ", dataSourceId: "ข้อมูลต้นทาง",
  };

  function toDateStr(d: Date | null | undefined): string {
    if (!d) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const errors: string[] = [];
  const updatedDetails: { employeeId: string; nameTh: string; changedFields: string[] }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const raw: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const mapped = HEADER_MAP[h] ?? HEADER_MAP[h.replace(/\s+/g, " ")];
      if (!mapped) return;
      let v = row[idx];
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

    const dataSourceId = await resolveDataSource(raw.sourceType, raw.sourceMonth, raw.sourceYear);

    const newData = {
      dataSourceId,
      nameTh,
      nameEn: String(raw.nameEn ?? "").trim() || null,
      position: String(raw.position ?? "").trim() || null,
      level: String(raw.level ?? "").trim() || null,
      department: String(raw.department ?? "").trim() || null,
      bureau: String(raw.bureau ?? "").trim() || null,
      endDate: parseDate(raw.endDate),
      email: String(raw.email ?? "").trim() || null,
    };

    try {
      const exists = await prisma.employee.findUnique({ where: { employeeId } });

      if (!exists) {
        // ── สร้างใหม่ ──────────────────────────────────────────
        const fmisStatus    = normalizeITStatus(raw.fmis);
        const eMtgStatus    = normalizeITStatus(raw.eMeeting);
        const softStatus    = normalizeITStatus(raw.software);
        const phonStatus    = normalizeITStatus(raw.phonebook);
        const today         = new Date();
        const DONE          = "ดำเนินการแล้ว";

        const emp = await prisma.employee.create({
          data: {
            employeeId,
            ...newData,
            startDate:    parseDate(raw.startDate),
            receivedDate: parseDate(raw.receivedDate) ?? new Date(),
            fmis:          fmisStatus,
            fmisDate:      fmisStatus === DONE ? (parseDate(raw.fmisDate) ?? today) : null,
            eMeeting:      eMtgStatus,
            eMeetingDate:  eMtgStatus === DONE ? (parseDate(raw.eMeetingDate) ?? today) : null,
            software:      softStatus,
            softwareDate:  softStatus === DONE ? (parseDate(raw.softwareDate) ?? today) : null,
            phonebook:     phonStatus,
            phonebookDate: phonStatus === DONE ? (parseDate(raw.phonebookDate) ?? today) : null,
            createdBy:  adminUser,
            updatedBy:  adminUser,
          },
        });
        await createAuditLog(emp.employeeId, "CREATE", adminUser);
        created++;
      } else {
        // ── เปรียบเทียบ field ที่ update ได้ ──────────────────
        const changedFields: string[] = [];
        const normalize = (v: string | null | undefined) => (v ?? "").trim();

        if (normalize(newData.nameTh) !== normalize(exists.nameTh)) changedFields.push(UPDATABLE_LABELS.nameTh);
        if (normalize(newData.nameEn) !== normalize(exists.nameEn)) changedFields.push(UPDATABLE_LABELS.nameEn);
        if (normalize(newData.position) !== normalize(exists.position)) changedFields.push(UPDATABLE_LABELS.position);
        if (normalize(newData.level) !== normalize(exists.level)) changedFields.push(UPDATABLE_LABELS.level);
        if (normalize(newData.department) !== normalize(exists.department)) changedFields.push(UPDATABLE_LABELS.department);
        if (normalize(newData.bureau) !== normalize(exists.bureau)) changedFields.push(UPDATABLE_LABELS.bureau);
        if (newData.dataSourceId !== exists.dataSourceId) changedFields.push(UPDATABLE_LABELS.dataSourceId);
        if (toDateStr(newData.endDate) !== toDateStr(exists.endDate)) changedFields.push(UPDATABLE_LABELS.endDate);

        // ── IT status fields (blank column = skip, non-blank = update) ──
        const IT_IMPORT_FIELDS = [
          { statusKey: "fmis",      dateKey: "fmisDate",      label: "FMIS" },
          { statusKey: "eMeeting",  dateKey: "eMeetingDate",  label: "eMeeting" },
          { statusKey: "software",  dateKey: "softwareDate",  label: "Software" },
          { statusKey: "phonebook", dateKey: "phonebookDate", label: "Phonebook" },
        ] as const;

        const itUpdateData: Record<string, string | Date | null> = {};
        const today = new Date();
        const DONE  = "ดำเนินการแล้ว";

        for (const f of IT_IMPORT_FIELDS) {
          const newStatus = parseITStatusForImport(raw[f.statusKey]);
          if (newStatus === undefined) continue; // blank → skip

          const existingStatus = String((exists as Record<string, unknown>)[f.statusKey] ?? "");
          const existingDate   = (exists as Record<string, unknown>)[f.dateKey] as Date | null;

          // Store status (ไม่พบบัญชี → null in DB, others as-is)
          itUpdateData[f.statusKey] = newStatus === "ไม่พบบัญชี" ? null : newStatus || null;

          // Use provided date → fall back to existing date → fall back to today
          itUpdateData[f.dateKey] = newStatus === DONE
            ? (parseDate(raw[f.dateKey]) ?? existingDate ?? today)
            : null;

          if (newStatus !== existingStatus) changedFields.push(f.label);
        }

        if (changedFields.length > 0) {
          await prisma.employee.update({
            where: { employeeId },
            data: { ...newData, ...itUpdateData, updatedBy: adminUser },
          });
          await createAuditLog(employeeId, "UPDATE", adminUser,
            exists as unknown as Record<string, unknown>,
            { ...exists, ...newData, ...itUpdateData } as unknown as Record<string, unknown>
          );
          updatedDetails.push({ employeeId, nameTh, changedFields });
          updated++;
        } else {
          unchanged++;
        }
      }
    } catch (err) {
      errors.push(`แถว ${i + 1} (${employeeId}): ${err instanceof Error ? err.message : "error"}`);
    }
  }

  res.json({ created, updated, unchanged, errors, updatedDetails });
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
  const employee = await prisma.employee.findUnique({
    where: { employeeId },
    include: { dataSource: true },
  });
  if (!employee) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(employee);
});

router.patch("/:employeeId", authMiddleware, requireRole("SUPER_ADMIN", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  const { employeeId } = req.params;
  const body = req.body;
  const role = req.user?.role ?? "";
  const adminUser = body.adminUser ?? req.user?.email ?? "unknown";

  const old = await prisma.employee.findUnique({ where: { employeeId } });
  if (!old) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const itOnlyData = {
    fmis: body.fmis || null,
    fmisDate: body.fmisDate ? new Date(body.fmisDate) : null,
    eMeeting: body.eMeeting || null,
    eMeetingDate: body.eMeetingDate ? new Date(body.eMeetingDate) : null,
    software: body.software || null,
    softwareDate: body.softwareDate ? new Date(body.softwareDate) : null,
    phonebook: body.phonebook || null,
    phonebookDate: body.phonebookDate ? new Date(body.phonebookDate) : null,
    updatedBy: adminUser,
  };

  const dataSourceId = role === "SUPER_ADMIN"
    ? await resolveDataSource(body.sourceType, body.sourceMonth, body.sourceYear)
    : null;

  const pick = <T,>(val: T | undefined, fallback: T | null = null): T | null | undefined =>
    val !== undefined ? (val || fallback) : undefined;

  const fullData = role === "SUPER_ADMIN" ? {
    ...("nameTh" in body && { nameTh: body.nameTh }),
    ...("nameEn" in body && { nameEn: pick(body.nameEn) }),
    ...("position" in body && { position: pick(body.position) }),
    ...("level" in body && { level: pick(body.level) }),
    ...("department" in body && { department: pick(body.department) }),
    ...("bureau" in body && { bureau: pick(body.bureau) }),
    ...("endDate" in body && { endDate: body.endDate ? new Date(body.endDate) : null }),
    ...("receivedDate" in body && body.receivedDate && { receivedDate: new Date(body.receivedDate) }),
    ...("email" in body && { email: pick(body.email) }),
    ...itOnlyData,
    ...(dataSourceId !== null ? { dataSourceId } : body.sourceType === "" ? { dataSourceId: null } : {}),
  } : itOnlyData;

  let updated;
  try {
    updated = await prisma.employee.update({
      where: { employeeId },
      data: fullData,
    });
  } catch (err) {
    console.error("[PATCH /employees]", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    return;
  }

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

  const existing = await prisma.employee.findUnique({ where: { employeeId } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await createAuditLog(employeeId, "DELETE", adminUser);
  await prisma.employee.delete({ where: { employeeId } });

  res.json({ success: true });
});

export default router;
