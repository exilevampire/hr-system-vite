"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const audit_1 = require("../lib/audit");
const auth_1 = require("../middleware/auth");
const mailer_1 = require("../lib/mailer");
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error("อนุญาตเฉพาะไฟล์ Excel (.xlsx, .xls) หรือ CSV (.csv) เท่านั้น"));
        }
    },
});
const HEADER_MAP = {
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
const SOURCE_TYPE_NAMES = { 1: "สบค.", 2: "ศล." };
async function resolveDataSource(sourceType, sourceMonth, sourceYear) {
    const st = parseInt(String(sourceType ?? "")) || 0;
    const sm = parseInt(String(sourceMonth ?? "")) || 0;
    const sy = parseInt(String(sourceYear ?? "")) || 0;
    if (!st || !sm || !sy)
        return null;
    let ds = await prisma_1.prisma.dataSource.findFirst({ where: { sourceType: st, month: sm, year: sy } });
    if (!ds)
        ds = await prisma_1.prisma.dataSource.create({ data: { sourceType: st, month: sm, year: sy } });
    return ds.id;
}
const VALID_IT_STATUSES = ["ดำเนินการแล้ว", "ยังไม่ดำเนินการ", "ไม่พบบัญชี", "ไม่ทราบสถานะ"];
function normalizeITStatus(val) {
    const s = String(val ?? "").trim();
    if (VALID_IT_STATUSES.includes(s))
        return s;
    return "ยังไม่ดำเนินการ";
}
// Returns undefined when blank (skip), or the normalized status string for UPDATE
function parseITStatusForImport(val) {
    const s = String(val ?? "").trim();
    if (!s)
        return undefined; // blank → skip, don't touch existing value
    if (VALID_IT_STATUSES.includes(s))
        return s;
    return undefined; // unrecognized → skip
}
function parseDate(val) {
    if (!val)
        return null;
    if (val instanceof Date) {
        let year = val.getUTCFullYear();
        if (year > 2500)
            year -= 543;
        return new Date(Date.UTC(year, val.getUTCMonth(), val.getUTCDate()));
    }
    if (typeof val === "number") {
        const d = XLSX.SSF.parse_date_code(val);
        if (d) {
            let year = d.y;
            if (year > 2500)
                year -= 543; // user typed BE year → Excel stored CE year 2569+
            return new Date(Date.UTC(year, d.m - 1, d.d));
        }
    }
    const s = String(val).trim();
    if (!s)
        return null;
    // Thai format: DD/MM/YYYY (e.g. "17/6/2567" or "17/06/2567")
    const slashMatch = s.match(/^(\d{1,2})[/](\d{1,2})[/](\d{4})$/);
    if (slashMatch) {
        const day = parseInt(slashMatch[1]);
        const month = parseInt(slashMatch[2]);
        let year = parseInt(slashMatch[3]);
        if (year > 2500)
            year -= 543; // BE → CE
        const d = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(d.getTime()))
            return d;
    }
    // ISO / Thai-ISO: YYYY-MM-DD or YYYY/MM/DD (e.g. "2567-06-17")
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        let year = parseInt(isoMatch[1]);
        const month = parseInt(isoMatch[2]);
        const day = parseInt(isoMatch[3]);
        if (year > 2500)
            year -= 543; // BE → CE
        const d = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(d.getTime()))
            return d;
    }
    return null;
}
router.get("/", auth_1.authMiddleware, async (req, res) => {
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
    const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
    const where = {};
    const conditions = [];
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
    if (bureau)
        conditions.push({ bureau: { contains: bureau } });
    if (position)
        conditions.push({ position: { contains: position } });
    if (level)
        conditions.push({ level: { contains: level } });
    if (department)
        conditions.push({ department: { contains: department } });
    // DataSource filters
    {
        const dsFilter = {};
        if (sourceTypeFilter)
            dsFilter.sourceType = Number(sourceTypeFilter);
        if (sourceMonthFilter)
            dsFilter.month = Number(sourceMonthFilter);
        if (sourceYearFilter)
            dsFilter.year = Number(sourceYearFilter);
        if (Object.keys(dsFilter).length > 0)
            conditions.push({ dataSource: dsFilter });
    }
    if (closedStatus === "closed") {
        // NULL = ไม่มีบัญชี = ผ่านแล้ว; ปิดสิทธิ์ = ไม่มีฟิลด์ไหนเป็น "ยังไม่ดำเนินการ"
        conditions.push({
            AND: [
                { NOT: { fmis: "ยังไม่ดำเนินการ" } },
                { NOT: { eMeeting: "ยังไม่ดำเนินการ" } },
                { NOT: { software: "ยังไม่ดำเนินการ" } },
                { NOT: { phonebook: "ยังไม่ดำเนินการ" } },
            ],
        });
    }
    else if (closedStatus === "pending") {
        conditions.push({
            OR: [
                { fmis: "ยังไม่ดำเนินการ" }, { eMeeting: "ยังไม่ดำเนินการ" },
                { software: "ยังไม่ดำเนินการ" }, { phonebook: "ยังไม่ดำเนินการ" },
            ],
        });
    }
    // วันที่พ้นสภาพ range
    if (endDateFrom)
        conditions.push({ endDate: { gte: new Date(endDateFrom) } });
    if (endDateTo)
        conditions.push({ endDate: { lte: new Date(endDateTo + "T23:59:59") } });
    // IT status + IT date range
    const itDateCond = (itDateFrom || itDateTo) ? {
        ...(itDateFrom ? { gte: new Date(itDateFrom) } : {}),
        ...(itDateTo ? { lte: new Date(itDateTo + "T23:59:59") } : {}),
    } : null;
    const itFilters = [
        ["fmis", fmisStatus, "fmisDate"],
        ["eMeeting", eMeetingStatus, "eMeetingDate"],
        ["software", softwareStatus, "softwareDate"],
        ["phonebook", phonebookStatus, "phonebookDate"],
    ];
    for (const [field, status, dateField] of itFilters) {
        if (!status)
            continue;
        const cond = { [field]: status };
        if (itDateCond && status !== "ไม่พบบัญชี")
            cond[dateField] = itDateCond;
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
    if (conditions.length > 0)
        where.AND = conditions;
    const [data, total] = await Promise.all([
        prisma_1.prisma.employee.findMany({
            where,
            include: { dataSource: true },
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { [sortBy]: sortDir },
        }),
        prisma_1.prisma.employee.count({ where }),
    ]);
    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN"), async (req, res) => {
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
        const employee = await prisma_1.prisma.employee.create({
            data: {
                employeeId: body.employeeId,
                dataSourceId,
                nameTh: body.nameTh,
                nameEn: body.nameEn || "-",
                position: body.position || "-",
                level: body.level || "-",
                department: body.department || "-",
                bureau: body.bureau || "-",
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
        await (0, audit_1.createAuditLog)(employee.employeeId, "CREATE", adminUser);
        res.status(201).json(employee);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("Unique constraint")) {
            res.status(400).json({ error: "รหัสพนักงานซ้ำในระบบ" });
            return;
        }
        console.error("[POST /employees]", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
});
// ── Helper: decode filename (browser sends UTF-8 bytes, multer reads as latin1)
function decodeFilename(name) {
    return Buffer.from(name, "latin1").toString("utf8");
}
// ── Helper: parse Excel/CSV file to rows ────────────────────────────────────
function parseFileToRows(file) {
    const buffer = file.buffer;
    if (/\.csv$/i.test(file.originalname)) {
        const text = buffer.toString("utf-8").replace(/^﻿/, "");
        return text.split(/\r?\n/)
            .filter((line) => line.trim() !== "")
            .map((line) => {
            const cells = [];
            let cur = "";
            let inQuote = false;
            for (const ch of line) {
                if (ch === '"') {
                    inQuote = !inQuote;
                }
                else if (ch === "," && !inQuote) {
                    cells.push(cur.trim());
                    cur = "";
                }
                else {
                    cur += ch;
                }
            }
            cells.push(cur.trim());
            return cells;
        });
    }
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
}
// ── Helper: map raw row to field record using HEADER_MAP ─────────────────────
function mapRowToRaw(headers, row) {
    const raw = {};
    headers.forEach((h, idx) => {
        const mapped = HEADER_MAP[h] ?? HEADER_MAP[h.replace(/\s+/g, " ")];
        if (!mapped)
            return;
        let v = row[idx];
        if (v instanceof Date) {
            v = `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
        }
        raw[mapped] = v;
    });
    return raw;
}
const UPDATABLE_LABELS = {
    nameTh: "ชื่อ-สกุล (ไทย)", nameEn: "ชื่อ-สกุล (อังกฤษ)", position: "ตำแหน่ง",
    level: "ประเภท", department: "ฝ่าย/กลุ่มงาน", bureau: "หน่วยงาน/สำนัก",
    endDate: "วันพ้นสภาพ", dataSourceId: "ข้อมูลต้นทาง",
};
function toDateStr(d) {
    if (!d)
        return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
router.post("/import", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN"), (req, res, next) => {
    upload.fields([{ name: "files", maxCount: 20 }, { name: "file", maxCount: 1 }])(req, res, (err) => {
        if (err?.code === "LIMIT_FILE_COUNT") {
            res.status(400).json({ error: "อัปโหลดได้สูงสุด 20 ไฟล์ต่อครั้ง" });
            return;
        }
        if (err) {
            next(err);
            return;
        }
        next();
    });
}, async (req, res) => {
    const adminUser = req.body.adminUser ?? req.user?.email ?? "unknown";
    const filesMap = req.files;
    const files = [...(filesMap?.["files"] ?? []), ...(filesMap?.["file"] ?? [])];
    if (files.length === 0) {
        res.status(400).json({ error: "ไม่พบไฟล์" });
        return;
    }
    // ── Phase 1: Validate ALL files (no DB writes) ───────────────────────────
    const validationErrors = [];
    const parsedFiles = [];
    for (const file of files) {
        const filename = decodeFilename(file.originalname);
        let rows;
        try {
            rows = parseFileToRows(file);
        }
        catch {
            validationErrors.push(`ไฟล์ "${filename}": อ่านไฟล์ไม่ได้`);
            continue;
        }
        if (rows.length < 2) {
            validationErrors.push(`ไฟล์ "${filename}": ไม่มีข้อมูล`);
            continue;
        }
        const headers = rows[0].map((h) => String(h ?? "").replace(/^﻿/, "").toLowerCase().trim());
        const empIdColIdx = headers.findIndex((h) => (HEADER_MAP[h] ?? HEADER_MAP[h.replace(/\s+/g, " ")]) === "employeeId");
        if (empIdColIdx === -1) {
            validationErrors.push(`ไฟล์ "${filename}": ไม่พบคอลัมน์ "รหัสประจำตัว"`);
            continue;
        }
        // ตรวจสอบทุก row ต้องมีรหัสพนักงาน
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const hasAnyData = row.some((v) => String(v ?? "").trim() !== "");
            if (!hasAnyData)
                continue; // row ว่างทั้งหมด → ข้ามได้
            const empId = String(row[empIdColIdx] ?? "").trim();
            if (!empId) {
                validationErrors.push(`ไฟล์ "${filename}" แถว ${i + 1}: ไม่มีรหัสพนักงาน`);
            }
        }
        parsedFiles.push({ filename, headers, rows });
    }
    // ถ้า validation ไม่ผ่าน → คืน error ทั้งหมด ไม่ทำอะไรเลย
    if (validationErrors.length > 0) {
        res.status(422).json({ validationErrors });
        return;
    }
    // ── Phase 2: Process ALL files ───────────────────────────────────────────
    const SOURCE_TYPE_LABELS = { 1: "สบค.", 2: "ศล." };
    const THAI_MONTHS_FULL = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const importedSources = new Set();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const errors = [];
    const updatedDetails = [];
    const IT_IMPORT_FIELDS = [
        { statusKey: "fmis", dateKey: "fmisDate", label: "FMIS" },
        { statusKey: "eMeeting", dateKey: "eMeetingDate", label: "eMeeting" },
        { statusKey: "software", dateKey: "softwareDate", label: "Software" },
        { statusKey: "phonebook", dateKey: "phonebookDate", label: "Phonebook" },
    ];
    for (const { filename, headers, rows } of parsedFiles) {
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const hasAnyData = row.some((v) => String(v ?? "").trim() !== "");
            if (!hasAnyData)
                continue;
            const raw = mapRowToRaw(headers, row);
            const employeeId = String(raw.employeeId ?? "").trim();
            const nameTh = String(raw.nameTh ?? "").trim();
            if (!employeeId || !nameTh) {
                if (employeeId || nameTh)
                    errors.push(`[${filename}] แถว ${i + 1}: ข้อมูลไม่ครบถ้วน`);
                continue;
            }
            const dataSourceId = await resolveDataSource(raw.sourceType, raw.sourceMonth, raw.sourceYear);
            const srcType = Number(raw.sourceType);
            const srcMonth = Number(raw.sourceMonth);
            const srcYear = Number(raw.sourceYear);
            if (srcType && srcMonth && srcYear) {
                const label = `${SOURCE_TYPE_LABELS[srcType] ?? `ต้นทาง ${srcType}`} ${THAI_MONTHS_FULL[srcMonth] ?? srcMonth} ${srcYear}`;
                importedSources.add(label);
            }
            const newData = {
                dataSourceId,
                nameTh,
                nameEn: String(raw.nameEn ?? "").trim() || "-",
                position: String(raw.position ?? "").trim() || "-",
                level: String(raw.level ?? "").trim() || "-",
                department: String(raw.department ?? "").trim() || "-",
                bureau: String(raw.bureau ?? "").trim() || "-",
                endDate: parseDate(raw.endDate),
                email: String(raw.email ?? "").trim() || "-",
            };
            try {
                const exists = await prisma_1.prisma.employee.findUnique({ where: { employeeId } });
                if (!exists) {
                    const fmisStatus = normalizeITStatus(raw.fmis);
                    const eMtgStatus = normalizeITStatus(raw.eMeeting);
                    const softStatus = normalizeITStatus(raw.software);
                    const phonStatus = normalizeITStatus(raw.phonebook);
                    const today = new Date();
                    const DONE = "ดำเนินการแล้ว";
                    const emp = await prisma_1.prisma.employee.create({
                        data: {
                            employeeId,
                            ...newData,
                            startDate: parseDate(raw.startDate),
                            receivedDate: parseDate(raw.receivedDate) ?? new Date(),
                            fmis: fmisStatus,
                            fmisDate: fmisStatus === DONE ? (parseDate(raw.fmisDate) ?? today) : null,
                            eMeeting: eMtgStatus,
                            eMeetingDate: eMtgStatus === DONE ? (parseDate(raw.eMeetingDate) ?? today) : null,
                            software: softStatus,
                            softwareDate: softStatus === DONE ? (parseDate(raw.softwareDate) ?? today) : null,
                            phonebook: phonStatus,
                            phonebookDate: phonStatus === DONE ? (parseDate(raw.phonebookDate) ?? today) : null,
                            createdBy: adminUser,
                            updatedBy: adminUser,
                        },
                    });
                    await (0, audit_1.createAuditLog)(emp.employeeId, "CREATE", adminUser);
                    created++;
                }
                else {
                    const changedFields = [];
                    const normalize = (v) => (v ?? "").trim();
                    if (normalize(newData.nameTh) !== normalize(exists.nameTh))
                        changedFields.push(UPDATABLE_LABELS.nameTh);
                    if (normalize(newData.nameEn) !== normalize(exists.nameEn))
                        changedFields.push(UPDATABLE_LABELS.nameEn);
                    if (normalize(newData.position) !== normalize(exists.position))
                        changedFields.push(UPDATABLE_LABELS.position);
                    if (normalize(newData.level) !== normalize(exists.level))
                        changedFields.push(UPDATABLE_LABELS.level);
                    if (normalize(newData.department) !== normalize(exists.department))
                        changedFields.push(UPDATABLE_LABELS.department);
                    if (normalize(newData.bureau) !== normalize(exists.bureau))
                        changedFields.push(UPDATABLE_LABELS.bureau);
                    if (newData.dataSourceId !== exists.dataSourceId)
                        changedFields.push(UPDATABLE_LABELS.dataSourceId);
                    if (toDateStr(newData.endDate) !== toDateStr(exists.endDate))
                        changedFields.push(UPDATABLE_LABELS.endDate);
                    const itUpdateData = {};
                    const today = new Date();
                    const DONE = "ดำเนินการแล้ว";
                    for (const f of IT_IMPORT_FIELDS) {
                        const newStatus = parseITStatusForImport(raw[f.statusKey]);
                        if (newStatus === undefined)
                            continue;
                        const existingStatus = String(exists[f.statusKey] ?? "");
                        const existingDate = exists[f.dateKey];
                        itUpdateData[f.statusKey] = newStatus;
                        itUpdateData[f.dateKey] = newStatus === DONE
                            ? (parseDate(raw[f.dateKey]) ?? existingDate ?? today)
                            : null;
                        if (newStatus !== existingStatus)
                            changedFields.push(f.label);
                    }
                    if (changedFields.length > 0) {
                        await prisma_1.prisma.employee.update({
                            where: { employeeId },
                            data: { ...newData, ...itUpdateData, updatedBy: adminUser },
                        });
                        await (0, audit_1.createAuditLog)(employeeId, "UPDATE", adminUser, exists, { ...exists, ...newData, ...itUpdateData });
                        updatedDetails.push({ employeeId, nameTh, changedFields });
                        updated++;
                    }
                    else {
                        unchanged++;
                    }
                }
            }
            catch (err) {
                errors.push(`[${filename}] แถว ${i + 1} (${employeeId}): ${err instanceof Error ? err.message : "error"}`);
            }
        }
    }
    res.json({ created, updated, unchanged, errors, updatedDetails });
    // ส่ง email แจ้งเตือนหลัง import — fire-and-forget ไม่บล็อก response
    if (created + updated > 0) {
        prisma_1.prisma.user.findMany({
            where: { notifyOnImport: true },
            select: { email: true },
        }).then((notifyUsers) => {
            const recipients = notifyUsers.map((u) => u.email);
            if (recipients.length === 0)
                return;
            const sourceName = importedSources.size > 0
                ? [...importedSources].join("<br>")
                : parsedFiles.map((f) => f.filename).join("<br>");
            return (0, mailer_1.sendImportNotification)(recipients, {
                inserted: created,
                updated,
                unchanged,
                errors: errors.length,
                sourceName,
                importedBy: adminUser,
                appUrl: process.env.FRONTEND_URL ?? "",
            });
        }).catch((err) => console.error("[mailer] ส่ง email ไม่สำเร็จ:", err));
    }
});
// ── อัพเดตสถานะดำเนินการ IT (SUPER_ADMIN เท่านั้น) ─────────────────────────
const IT_STATUS_HEADER_MAP = {
    "รหัสประจำตัว": "employeeId",
    "fmis": "fmis",
    "วันที่ fmis": "fmisDate",
    "emeeting": "eMeeting",
    "วันที่ emeeting": "eMeetingDate",
    "software": "software",
    "วันที่ software": "softwareDate",
    "phonebook": "phonebook",
    "วันที่ phonebook": "phonebookDate",
};
router.post("/update-it-status", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), upload.single("file"), async (req, res) => {
    const adminUser = req.body.adminUser ?? req.user?.email ?? "unknown";
    if (!req.file) {
        res.status(400).json({ error: "ไม่พบไฟล์" });
        return;
    }
    const buffer = req.file.buffer;
    const isCsv = /\.csv$/i.test(req.file.originalname);
    let rows;
    if (isCsv) {
        const text = buffer.toString("utf-8").replace(/^﻿/, "");
        const lines = text.split(/\r?\n/);
        rows = lines
            .filter((line) => line.trim() !== "")
            .map((line) => {
            const cells = [];
            let cur = "";
            let inQuote = false;
            for (let ci = 0; ci < line.length; ci++) {
                const ch = line[ci];
                if (ch === '"') {
                    inQuote = !inQuote;
                    continue;
                }
                if (ch === "," && !inQuote) {
                    cells.push(cur);
                    cur = "";
                    continue;
                }
                cur += ch;
            }
            cells.push(cur);
            return cells;
        });
    }
    else {
        const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    }
    if (rows.length < 2) {
        res.status(400).json({ error: "ไฟล์ไม่มีข้อมูล" });
        return;
    }
    const headers = rows[0].map((h) => String(h ?? "").replace(/^﻿/, "").toLowerCase().trim());
    const colIndex = {};
    for (let ci = 0; ci < headers.length; ci++) {
        const mapped = IT_STATUS_HEADER_MAP[headers[ci]];
        if (mapped)
            colIndex[mapped] = ci;
    }
    if (colIndex["employeeId"] === undefined) {
        res.status(400).json({ error: "ไม่พบคอลัมน์ รหัสประจำตัว" });
        return;
    }
    let updated = 0;
    let unchanged = 0;
    const errors = [];
    const updatedDetails = [];
    const IT_FIELDS = [
        { statusKey: "fmis", dateKey: "fmisDate", label: "FMIS" },
        { statusKey: "eMeeting", dateKey: "eMeetingDate", label: "eMeeting" },
        { statusKey: "software", dateKey: "softwareDate", label: "Software" },
        { statusKey: "phonebook", dateKey: "phonebookDate", label: "Phonebook" },
    ];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const raw = {};
        for (const [field, idx] of Object.entries(colIndex)) {
            raw[field] = row[idx] ?? "";
        }
        const employeeId = String(raw.employeeId ?? "").trim();
        if (!employeeId)
            continue;
        try {
            const exists = await prisma_1.prisma.employee.findUnique({ where: { employeeId } });
            if (!exists) {
                errors.push(`แถว ${i + 1}: ไม่พบรหัสพนักงาน ${employeeId}`);
                continue;
            }
            const changedFields = [];
            const updateData = {};
            const today = new Date();
            const DONE = "ดำเนินการแล้ว";
            for (const f of IT_FIELDS) {
                const newStatus = parseITStatusForImport(raw[f.statusKey]);
                if (newStatus === undefined)
                    continue;
                const existingStatus = String(exists[f.statusKey] ?? "");
                const existingDate = exists[f.dateKey];
                updateData[f.statusKey] = newStatus;
                updateData[f.dateKey] = newStatus === DONE
                    ? (parseDate(raw[f.dateKey]) ?? existingDate ?? today)
                    : null;
                if (newStatus !== existingStatus)
                    changedFields.push(f.label);
            }
            if (changedFields.length > 0) {
                await prisma_1.prisma.employee.update({
                    where: { employeeId },
                    data: { ...updateData, updatedBy: adminUser },
                });
                await (0, audit_1.createAuditLog)(employeeId, "UPDATE", adminUser, exists, { ...exists, ...updateData });
                updatedDetails.push({ employeeId, nameTh: exists.nameTh ?? employeeId, changedFields });
                updated++;
            }
            else {
                unchanged++;
            }
        }
        catch (err) {
            errors.push(`แถว ${i + 1} (${employeeId}): ${err instanceof Error ? err.message : "error"}`);
        }
    }
    res.json({ updated, unchanged, errors, updatedDetails });
});
router.get("/meta", auth_1.authMiddleware, async (_req, res) => {
    const [positions, bureaus, levels, departments] = await Promise.all([
        prisma_1.prisma.employee.findMany({
            where: { position: { not: null } },
            select: { position: true },
            distinct: ["position"],
            orderBy: { position: "asc" },
        }),
        prisma_1.prisma.employee.findMany({
            where: { bureau: { not: null } },
            select: { bureau: true },
            distinct: ["bureau"],
            orderBy: { bureau: "asc" },
        }),
        prisma_1.prisma.employee.findMany({
            where: { level: { not: null } },
            select: { level: true },
            distinct: ["level"],
            orderBy: { level: "asc" },
        }),
        prisma_1.prisma.employee.findMany({
            where: { department: { not: null } },
            select: { department: true },
            distinct: ["department"],
            orderBy: { department: "asc" },
        }),
    ]);
    res.json({
        positions: positions.map((p) => p.position).filter((p) => !!p && p !== "-"),
        bureaus: bureaus.map((b) => b.bureau).filter((b) => !!b && b !== "-"),
        levels: levels.map((l) => l.level).filter((l) => !!l && l !== "-"),
        departments: departments.map((d) => d.department).filter((d) => !!d && d !== "-"),
    });
});
router.get("/:employeeId", auth_1.authMiddleware, async (req, res) => {
    const { employeeId } = req.params;
    const employee = await prisma_1.prisma.employee.findUnique({
        where: { employeeId },
        include: { dataSource: true },
    });
    if (!employee) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    res.json(employee);
});
router.patch("/:employeeId", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN"), async (req, res) => {
    const { employeeId } = req.params;
    const body = req.body;
    const role = req.user?.role ?? "";
    const adminUser = body.adminUser ?? req.user?.email ?? "unknown";
    const old = await prisma_1.prisma.employee.findUnique({ where: { employeeId } });
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
    const pickStr = (val) => val !== undefined ? (String(val ?? "").trim() || "-") : undefined;
    const pick = (val, fallback = null) => val !== undefined ? (val || fallback) : undefined;
    const fullData = role === "SUPER_ADMIN" ? {
        ...("nameTh" in body && { nameTh: body.nameTh }),
        ...("nameEn" in body && { nameEn: pickStr(body.nameEn) }),
        ...("position" in body && { position: pickStr(body.position) }),
        ...("level" in body && { level: pickStr(body.level) }),
        ...("department" in body && { department: pickStr(body.department) }),
        ...("bureau" in body && { bureau: pickStr(body.bureau) }),
        ...("endDate" in body && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...("receivedDate" in body && body.receivedDate && { receivedDate: new Date(body.receivedDate) }),
        ...("email" in body && { email: pickStr(body.email) }),
        ...itOnlyData,
        ...(dataSourceId !== null ? { dataSourceId } : body.sourceType === "" ? { dataSourceId: null } : {}),
    } : itOnlyData;
    let updated;
    try {
        updated = await prisma_1.prisma.employee.update({
            where: { employeeId },
            data: fullData,
        });
    }
    catch (err) {
        console.error("[PATCH /employees]", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
        return;
    }
    await (0, audit_1.createAuditLog)(employeeId, "UPDATE", adminUser, old, updated);
    res.json(updated);
});
router.delete("/:employeeId", auth_1.authMiddleware, (0, auth_1.requireRole)("SUPER_ADMIN"), async (req, res) => {
    const { employeeId } = req.params;
    const adminUser = req.user?.email ?? "unknown";
    const existing = await prisma_1.prisma.employee.findUnique({ where: { employeeId } });
    if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    await (0, audit_1.createAuditLog)(employeeId, "DELETE", adminUser);
    await prisma_1.prisma.employee.delete({ where: { employeeId } });
    res.json({ success: true });
});
exports.default = router;
