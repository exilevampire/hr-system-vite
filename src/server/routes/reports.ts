import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import ExcelJS from "exceljs";

const router = Router();

const HEADER_DARK = "1E3A5F";
const HEADER_MID = "2D5F9E";
const WHITE = "FFFFFFFF";
const ROW_ODD = "FFEEF4FF";
const ROW_EVEN = "FFFFFFFF";
const GREEN_BG = "FFD1FAE5";
const GREEN_FG = "FF065F46";
const ORANGE_BG = "FFFEF3C7";
const ORANGE_FG = "FF92400E";
const GRAY_BG = "FFE5E7EB";
const BLUE_MID = "FFDBEAFE";

const SOURCE_TYPE_NAMES: Record<number, string> = { 1: "สบค.", 2: "ศล." };
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatDataSource(ds: { sourceType: number; month: number; year: number } | null | undefined): string {
  if (!ds) return "";
  const name = SOURCE_TYPE_NAMES[ds.sourceType] ?? `ต้นทาง ${ds.sourceType}`;
  return `${name} ${THAI_MONTHS_SHORT[ds.month - 1] ?? ds.month} ${ds.year}`;
}

function toBE(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = d.getUTCFullYear() + 543;
  return `${day}/${month}/${year}`;
}

const itLabel = (v: string | null) => v || "ไม่พบบัญชี";

function isItCleared(e: {
  fmis: string | null;
  eMeeting: string | null;
  software: string | null;
  phonebook: string | null;
}): boolean {
  const itFields = [e.fmis, e.eMeeting, e.software, e.phonebook];
  const noneIsPending = itFields.every((v) => !v || v === "ดำเนินการแล้ว");
  const atLeastOneDone = itFields.some((v) => v === "ดำเนินการแล้ว");
  return noneIsPending && atLeastOneDone;
}

function applyHeaderStyle(cell: ExcelJS.Cell, center = true) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_DARK}` } };
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "TH SarabunPSK" };
  cell.alignment = { vertical: "middle", horizontal: center ? "center" : "left", wrapText: true };
  cell.border = { bottom: { style: "medium", color: { argb: `FF${HEADER_MID}` } } };
}

// GET /api/reports/meta — unique bureaus for filter dropdown
router.get("/meta", authMiddleware, async (_req, res) => {
  const rows = await prisma.employee.findMany({
    select: { bureau: true },
    distinct: ["bureau"],
    orderBy: { bureau: "asc" },
  });
  const bureaus = rows.map((r) => r.bureau ?? "ไม่ระบุ").filter(Boolean).sort();
  res.json({ bureaus });
});

// GET /api/reports/employees — download styled Excel
router.get("/employees", authMiddleware, async (req, res) => {
  const search          = String(req.query.search          ?? "");
  const bureau          = String(req.query.bureau          ?? "");
  const position        = String(req.query.position        ?? "");
  const level           = String(req.query.level           ?? "");
  const department      = String(req.query.department      ?? "");
  const endDateFrom     = String(req.query.endDateFrom     ?? "");
  const endDateTo       = String(req.query.endDateTo       ?? "");
  const fmisStatus      = String(req.query.fmisStatus      ?? "");
  const eMeetingStatus  = String(req.query.eMeetingStatus  ?? "");
  const softwareStatus  = String(req.query.softwareStatus  ?? "");
  const phonebookStatus = String(req.query.phonebookStatus ?? "");
  const itDateFrom      = String(req.query.itDateFrom      ?? "");
  const itDateTo        = String(req.query.itDateTo        ?? "");
  const sourceTypeFilter  = String(req.query.sourceType  ?? "");
  const sourceMonthFilter = String(req.query.sourceMonth ?? "");
  const sourceYearFilter  = String(req.query.sourceYear  ?? "");
  const closedStatus    = String(req.query.closedStatus    ?? "");

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
  if (bureau)     conditions.push({ bureau:     { contains: bureau     } });
  if (position)   conditions.push({ position:   { contains: position   } });
  if (level)      conditions.push({ level:      { contains: level      } });
  if (department) conditions.push({ department: { contains: department } });

  {
    const dsFilter: Record<string, number> = {};
    if (sourceTypeFilter)  dsFilter.sourceType = Number(sourceTypeFilter);
    if (sourceMonthFilter) dsFilter.month      = Number(sourceMonthFilter);
    if (sourceYearFilter)  dsFilter.year       = Number(sourceYearFilter);
    if (Object.keys(dsFilter).length > 0) conditions.push({ dataSource: dsFilter });
  }

  if (closedStatus === "closed") {
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
      OR: [{ fmis: "ยังไม่ดำเนินการ" }, { eMeeting: "ยังไม่ดำเนินการ" }, { software: "ยังไม่ดำเนินการ" }, { phonebook: "ยังไม่ดำเนินการ" }],
    });
  }

  if (endDateFrom) conditions.push({ endDate: { gte: new Date(endDateFrom) } });
  if (endDateTo)   conditions.push({ endDate: { lte: new Date(endDateTo + "T23:59:59") } });

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
  if (itDateCond && !fmisStatus && !eMeetingStatus && !softwareStatus && !phonebookStatus) {
    conditions.push({ OR: [{ fmisDate: itDateCond }, { eMeetingDate: itDateCond }, { softwareDate: itDateCond }, { phonebookDate: itDateCond }] });
  }

  if (conditions.length > 0) where.AND = conditions;

  const filtered = await prisma.employee.findMany({
    where,
    include: { dataSource: true },
    orderBy: [{ bureau: "asc" }, { endDate: "desc" }],
  });

  // ── Workbook ──────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "HR System";
  wb.created = new Date();
  wb.properties.date1904 = false;

  // ── Sheet 1: Employee list ────────────────────────────────────────────
  const ws = wb.addWorksheet("รายงานพนักงาน", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } },
    properties: { defaultRowHeight: 18 },
  });

  // Title row (merged)
  const TOTAL_COLS = 19;
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const titleCell = ws.getCell("A1");
  const now = new Date();
  const reportDate = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear() + 543}`;
  titleCell.value = `รายงานข้อมูลพนักงานพ้นสภาพ  —  ณ วันที่ ${reportDate}  (${filtered.length.toLocaleString()} รายการ)`;
  titleCell.font = { name: "TH SarabunPSK", size: 14, bold: true, color: { argb: `FF${HEADER_DARK}` } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_MID } };
  ws.getRow(1).height = 32;

  // Column definitions (row 2 = headers)
  ws.columns = [
    { key: "no",           width: 7   },
    { key: "dataSource",   width: 18  },
    { key: "employeeId",   width: 14  },
    { key: "nameTh",       width: 28  },
    { key: "nameEn",       width: 26  },
    { key: "position",     width: 22  },
    { key: "level",        width: 10  },
    { key: "department",   width: 20  },
    { key: "bureau",       width: 24  },
    { key: "endDate",      width: 13  },
    { key: "itStatus",     width: 13  },
    { key: "fmis",         width: 14  },
    { key: "fmisDate",     width: 13  },
    { key: "eMeeting",     width: 14  },
    { key: "eMeetingDate", width: 13  },
    { key: "software",      width: 14  },
    { key: "softwareDate",  width: 13  },
    { key: "phonebook",     width: 14  },
    { key: "phonebookDate", width: 13  },
  ];

  // col index → is date sub-column (1-based)
  const DATE_SUB_COLS = new Set([13, 15, 17, 19]);

  const HEADERS = [
    "ลำดับ", "ข้อมูลต้นทาง", "รหัสพนักงาน", "ชื่อ-สกุล (ไทย)", "ชื่อ-สกุล (อังกฤษ)",
    "ตำแหน่ง", "ประเภท", "ฝ่าย/กลุ่มงาน", "หน่วยงาน/สำนัก", "วันพ้นสภาพ",
    "สถานะการดำเนินงาน",
    "FMIS", "วันที่ FMIS",
    "eMeeting", "วันที่ eMeeting",
    "Software", "วันที่ Software",
    "Phonebook", "วันที่ Phonebook",
  ];

  // Header row (row 2)
  const hRow = ws.getRow(2);
  hRow.height = 30;
  HEADERS.forEach((h, i) => {
    const colNum = i + 1;
    const cell = hRow.getCell(colNum);
    cell.value = h;
    applyHeaderStyle(cell);
    // date sub-columns use slightly lighter header to signal they belong to the column before
    if (DATE_SUB_COLS.has(colNum)) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_MID}` } };
    }
  });

  // Data rows (starting at row 3)
  // centered cols: no(1), employeeId(3), endDate(10), itStatus(11), and all IT cols (12-21)
  const CENTER_COLS = new Set([1, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

  filtered.forEach((e, idx) => {
    const cleared = isItCleared(e);
    const rowNum = idx + 3;
    const row = ws.getRow(rowNum);
    row.height = 19;

    const values = [
      idx + 1,                              // 1  ลำดับ
      formatDataSource(e.dataSource),        // 2  ข้อมูลต้นทาง
      e.employeeId,                         // 3  รหัสพนักงาน
      e.nameTh,                             // 4  ชื่อ-สกุล (ไทย)
      e.nameEn ?? "",                       // 5  ชื่อ-สกุล (อังกฤษ)
      e.position ?? "",                     // 6  ตำแหน่ง
      e.level ?? "",                        // 7  ประเภท
      e.department ?? "",                   // 8  ฝ่าย/กลุ่มงาน
      e.bureau ?? "",                       // 9  หน่วยงาน/สำนัก
      toBE(e.endDate),                      // 10 วันพ้นสภาพ
      cleared ? "ปิดแล้ว" : "ยังไม่ปิด",  // 11 สถานะการดำเนินงาน
      itLabel(e.fmis),                       // 12 FMIS
      toBE(e.fmisDate),                     // 13 วันที่ FMIS
      itLabel(e.eMeeting),                  // 14 eMeeting
      toBE(e.eMeetingDate),                 // 15 วันที่ eMeeting
      itLabel(e.software),                  // 16 Software
      toBE(e.softwareDate),                 // 17 วันที่ Software
      itLabel(e.phonebook),                 // 18 Phonebook
      toBE(e.phonebookDate),                // 19 วันที่ Phonebook
    ];

    const rowBg = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;

    values.forEach((val, ci) => {
      const colNum = ci + 1;
      const cell = row.getCell(colNum);
      cell.value = val;
      cell.font = { name: "TH SarabunPSK", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: CENTER_COLS.has(colNum) ? "center" : "left" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    });

    // สถานะการดำเนินงาน coloring (col 11)
    const itCell = row.getCell(11);
    itCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cleared ? GREEN_BG : ORANGE_BG } };
    itCell.font = { name: "TH SarabunPSK", size: 10, bold: true, color: { argb: cleared ? GREEN_FG : ORANGE_FG } };
  });

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 2, topLeftCell: "C3", activeCell: "C3" }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: TOTAL_COLS } };

  // ── Sheet 2: Bureau summary ───────────────────────────────────────────
  const ws2 = wb.addWorksheet("สรุปตามหน่วยงาน");
  ws2.properties.defaultRowHeight = 20;

  ws2.columns = [
    { key: "bureau",  width: 32 },
    { key: "total",   width: 16 },
    { key: "cleared", width: 14 },
    { key: "pending", width: 14 },
    { key: "pct",     width: 14 },
  ];

  // Title
  ws2.mergeCells("A1:E1");
  const t2 = ws2.getCell("A1");
  t2.value = `สรุปสถานะการดำเนินงาน ตามหน่วยงาน  —  ณ วันที่ ${reportDate}`;
  t2.font = { name: "TH SarabunPSK", size: 14, bold: true, color: { argb: `FF${HEADER_DARK}` } };
  t2.alignment = { vertical: "middle", horizontal: "center" };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_MID } };
  ws2.getRow(1).height = 32;

  // Header row
  const s2Headers = ["หน่วยงาน/สำนัก", "จำนวนพนักงาน", "ปิด IT แล้ว", "ยังไม่ปิด IT", "% ปิด IT"];
  const s2HRow = ws2.getRow(2);
  s2HRow.height = 30;
  s2Headers.forEach((h, i) => {
    const cell = s2HRow.getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell, i > 0);
    if (i === 0) cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  // Bureau map
  const bureauMap: Record<string, { total: number; cleared: number }> = {};
  for (const e of filtered) {
    const b = e.bureau ?? "ไม่ระบุ";
    if (!bureauMap[b]) bureauMap[b] = { total: 0, cleared: 0 };
    bureauMap[b].total++;
    if (isItCleared(e)) bureauMap[b].cleared++;
  }

  Object.entries(bureauMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .forEach(([bureau, data], idx) => {
      const pct = data.total > 0 ? (data.cleared / data.total) * 100 : 0;
      const rowNum = idx + 3;
      const row = ws2.getRow(rowNum);
      row.height = 20;
      const rowBg = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;

      const vals = [bureau, data.total, data.cleared, data.total - data.cleared, pct / 100];
      vals.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.font = { name: "TH SarabunPSK", size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : "center" };
      });
      // Percentage cell format
      row.getCell(5).numFmt = "0%";
    });

  // Total row
  const totalCleared = filtered.filter(isItCleared).length;
  const totalPct = filtered.length > 0 ? totalCleared / filtered.length : 0;
  const lastRow = ws2.getRow(Object.keys(bureauMap).length + 3);
  lastRow.height = 24;
  const totalVals = ["รวมทั้งหมด", filtered.length, totalCleared, filtered.length - totalCleared, totalPct];
  totalVals.forEach((v, ci) => {
    const cell = lastRow.getCell(ci + 1);
    cell.value = v;
    cell.font = { name: "TH SarabunPSK", size: 11, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_BG } };
    cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : "center" };
    cell.border = { top: { style: "medium", color: { argb: `FF${HEADER_DARK}` } } };
  });
  lastRow.getCell(5).numFmt = "0%";

  ws2.views = [{ state: "frozen", xSplit: 0, ySplit: 2, topLeftCell: "A3", activeCell: "A3" }];

  // ── Stream response ───────────────────────────────────────────────────
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const filename = `HR_Report_${stamp}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
});

export default router;
