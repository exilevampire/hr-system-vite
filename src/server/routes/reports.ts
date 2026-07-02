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
  return itFields.every((v) => !v || v === "ดำเนินการแล้ว");
}

function applyHeaderStyle(cell: ExcelJS.Cell, center = true) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_DARK}` } };
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12, name: "TH SarabunPSK" };
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
        { email: { contains: search } },
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
  const TOTAL_COLS = 20;
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
    { key: "email",         width: 26  },
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
  const DATE_SUB_COLS = new Set([14, 16, 18, 20]);

  const HEADERS = [
    "ลำดับ", "ข้อมูลต้นทาง", "รหัสพนักงาน", "ชื่อ-สกุล (ไทย)", "ชื่อ-สกุล (อังกฤษ)",
    "ตำแหน่ง", "ประเภท", "ฝ่าย/กลุ่มงาน", "หน่วยงาน/สำนัก", "วันพ้นสภาพ",
    "Email",
    "สถานะการดำเนินงาน",
    "FMIS", "วันที่ FMIS",
    "eMeeting", "วันที่ eMeeting",
    "Software", "วันที่ Software",
    "Phonebook", "วันที่ Phonebook",
  ];

  // Header row (row 2)
  const hRow = ws.getRow(2);
  hRow.height = 32;
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
  // centered cols: no(1), employeeId(3), endDate(10), itStatus(12), and all IT cols (13-20)
  const CENTER_COLS = new Set([1, 3, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

  filtered.forEach((e, idx) => {
    const cleared = isItCleared(e);
    const rowNum = idx + 3;
    const row = ws.getRow(rowNum);
    row.height = 22;

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
      e.email ?? "",                        // 11 Email
      cleared ? "ปิดแล้ว" : "ยังไม่ปิด",  // 12 สถานะการดำเนินงาน
      itLabel(e.fmis),                       // 13 FMIS
      toBE(e.fmisDate),                     // 14 วันที่ FMIS
      itLabel(e.eMeeting),                  // 15 eMeeting
      toBE(e.eMeetingDate),                 // 16 วันที่ eMeeting
      itLabel(e.software),                  // 17 Software
      toBE(e.softwareDate),                 // 18 วันที่ Software
      itLabel(e.phonebook),                 // 19 Phonebook
      toBE(e.phonebookDate),               // 20 วันที่ Phonebook
    ];

    const rowBg = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;

    values.forEach((val, ci) => {
      const colNum = ci + 1;
      const cell = row.getCell(colNum);
      cell.value = val;
      cell.font = { name: "TH SarabunPSK", size: 12 };
      cell.alignment = { vertical: "middle", horizontal: CENTER_COLS.has(colNum) ? "center" : "left" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    });

    // สถานะการดำเนินงาน coloring (col 12 — col 11 is Email)
    const itCell = row.getCell(12);
    itCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cleared ? GREEN_BG : ORANGE_BG } };
    itCell.font = { name: "TH SarabunPSK", size: 12, bold: true, color: { argb: cleared ? GREEN_FG : ORANGE_FG } };
  });

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 2, topLeftCell: "C3", activeCell: "C3" }];
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: TOTAL_COLS } };

  // ── Sheet 2: Dashboard summary ───────────────────────────────────────
  const ws2 = wb.addWorksheet("สรุปภาพรวม");
  ws2.properties.defaultRowHeight = 20;
  ws2.columns = [
    { key: "a", width: 32 },
    { key: "b", width: 16 },
    { key: "c", width: 14 },
    { key: "d", width: 14 },
    { key: "e", width: 14 },
    { key: "f", width: 14 },
  ];

  // Compute summary data
  const bureauMap: Record<string, { total: number; cleared: number }> = {};
  const monthMap: Record<string, number> = {};
  let totalCleared = 0;
  let withEmail = 0;
  const itBreakdown = {
    fmis:      { done: 0, pending: 0, na: 0 },
    eMeeting:  { done: 0, pending: 0, na: 0 },
    software:  { done: 0, pending: 0, na: 0 },
    phonebook: { done: 0, pending: 0, na: 0 },
  };
  for (const e of filtered) {
    const b = e.bureau ?? "ไม่ระบุ";
    if (!bureauMap[b]) bureauMap[b] = { total: 0, cleared: 0 };
    bureauMap[b].total++;
    if (isItCleared(e)) { bureauMap[b].cleared++; totalCleared++; }
    if (e.email) withEmail++;
    if (e.endDate) {
      const d = new Date(e.endDate);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = (monthMap[key] ?? 0) + 1;
    }
    for (const [key, val] of [
      ["fmis", e.fmis], ["eMeeting", e.eMeeting],
      ["software", e.software], ["phonebook", e.phonebook],
    ] as [keyof typeof itBreakdown, string | null][]) {
      if (val === "ดำเนินการแล้ว") itBreakdown[key].done++;
      else if (val === "ยังไม่ดำเนินการ") itBreakdown[key].pending++;
      else itBreakdown[key].na++;
    }
  }
  const totalPending = filtered.length - totalCleared;
  const overallPct = filtered.length > 0 ? totalCleared / filtered.length : 0;
  const bureauList = Object.entries(bureauMap).sort(([, a], [, b]) => b.total - a.total);
  const monthList = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => {
    const [y, m] = key.split("-").map(Number);
    return { label: `${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`, count };
  });

  function s2SectionHeader(row: number, label: string, cols = 6) {
    ws2.mergeCells(row, 1, row, cols);
    const cell = ws2.getCell(row, 1);
    cell.value = label;
    cell.font = { name: "TH SarabunPSK", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_DARK}` } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    ws2.getRow(row).height = 28;
  }

  // ── Title ────────────────────────────────────────────────────────────
  ws2.mergeCells("A1:F1");
  const t2 = ws2.getCell("A1");
  t2.value = `สรุปภาพรวม  —  ณ วันที่ ${reportDate}  (${filtered.length.toLocaleString()} รายการ)`;
  t2.font = { name: "TH SarabunPSK", size: 14, bold: true, color: { argb: `FF${HEADER_DARK}` } };
  t2.alignment = { vertical: "middle", horizontal: "center" };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_MID } };
  ws2.getRow(1).height = 32;

  // ── Section 1: ภาพรวม ─────────────────────────────────────────────
  s2SectionHeader(2, "  ภาพรวม");

  // Stat headers
  const statHeaders = ["พนักงานทั้งหมด", "ปิดสิทธิ์แล้ว", "รอดำเนินการ", "% ปิดสิทธิ์", "จำนวนหน่วยงาน", "มีข้อมูลอีเมล"];
  const statHRow = ws2.getRow(3);
  statHRow.height = 28;
  statHeaders.forEach((h, i) => {
    const cell = statHRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "TH SarabunPSK", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_MID}` } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Stat values
  const statVals = [filtered.length, totalCleared, totalPending, overallPct, bureauList.length, withEmail];
  const statRow = ws2.getRow(4);
  statRow.height = 28;
  statVals.forEach((v, i) => {
    const cell = statRow.getCell(i + 1);
    cell.value = v;
    cell.font = { name: "TH SarabunPSK", size: 14, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    if (i === 1) { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } }; cell.font = { ...cell.font, color: { argb: GREEN_FG } }; }
    else if (i === 2) { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_BG } }; cell.font = { ...cell.font, color: { argb: ORANGE_FG } }; }
    else { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }; }
  });
  statRow.getCell(4).numFmt = "0%";

  // ── Section 2: พนักงานแยกตามหน่วยงาน ────────────────────────────
  s2SectionHeader(6, "  พนักงานแยกตามหน่วยงาน");

  const bureauHRow = ws2.getRow(7);
  bureauHRow.height = 28;
  ["หน่วยงาน/สำนัก", "จำนวนพนักงาน", "ปิด IT แล้ว", "ยังไม่ปิด IT", "% ปิด IT"].forEach((h, i) => {
    const cell = bureauHRow.getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell, i > 0);
    if (i === 0) cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  bureauList.forEach(([bureau, data], idx) => {
    const row = ws2.getRow(idx + 8);
    row.height = 22;
    const bg = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;
    [bureau, data.total, data.cleared, data.total - data.cleared, data.total > 0 ? data.cleared / data.total : 0].forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: "TH SarabunPSK", size: 12 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : "center" };
    });
    row.getCell(5).numFmt = "0%";
  });

  // Total row (bureaus)
  const bureauTotalRow = ws2.getRow(bureauList.length + 8);
  bureauTotalRow.height = 24;
  ["รวมทั้งหมด", filtered.length, totalCleared, totalPending, overallPct].forEach((v, ci) => {
    const cell = bureauTotalRow.getCell(ci + 1);
    cell.value = v;
    cell.font = { name: "TH SarabunPSK", size: 11, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_BG } };
    cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : "center" };
    cell.border = { top: { style: "medium", color: { argb: `FF${HEADER_DARK}` } } };
  });
  bureauTotalRow.getCell(5).numFmt = "0%";

  // ── Section 3: แนวโน้มรายเดือน ───────────────────────────────────
  const monthSectionRow = bureauList.length + 10;
  s2SectionHeader(monthSectionRow, "  แนวโน้มรายเดือน (พนักงานที่พ้นสภาพ)", 2);

  const monthHRow = ws2.getRow(monthSectionRow + 1);
  monthHRow.height = 28;
  ["เดือน", "จำนวน (คน)"].forEach((h, i) => {
    const cell = monthHRow.getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell);
  });

  monthList.forEach(({ label, count }, idx) => {
    const row = ws2.getRow(monthSectionRow + 2 + idx);
    row.height = 22;
    const bg = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;
    [label, count].forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: "TH SarabunPSK", size: 12 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : "center" };
    });
  });

  // Month total row
  const monthTotalRow = ws2.getRow(monthSectionRow + 2 + monthList.length);
  monthTotalRow.height = 24;
  [["รวมทั้งหมด", filtered.length]].forEach(([v, n]) => {
    [v, n].forEach((val, ci) => {
      const cell = monthTotalRow.getCell(ci + 1);
      cell.value = val;
      cell.font = { name: "TH SarabunPSK", size: 11, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_BG } };
      cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : "center" };
      cell.border = { top: { style: "medium", color: { argb: `FF${HEADER_DARK}` } } };
    });
  });

  // ── Section 4: สถานะดำเนินการรายระบบ ─────────────────────────────
  const itSectionRow = monthSectionRow + 2 + monthList.length + 3;
  s2SectionHeader(itSectionRow, "  สถานะดำเนินการรายระบบ", 5);

  const itHRow = ws2.getRow(itSectionRow + 1);
  itHRow.height = 28;
  ["ระบบ", "ดำเนินการแล้ว", "ยังไม่ดำเนินการ", "ไม่พบบัญชี", "% ดำเนินการแล้ว"].forEach((h, i) => {
    const cell = itHRow.getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell, i > 0);
    if (i === 0) cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  const IT_BREAKDOWN_ROWS: [string, keyof typeof itBreakdown][] = [
    ["FMIS", "fmis"],
    ["eMeeting", "eMeeting"],
    ["Software", "software"],
    ["Phonebook", "phonebook"],
  ];

  IT_BREAKDOWN_ROWS.forEach(([label, key], idx) => {
    const cnt = itBreakdown[key];
    const total = cnt.done + cnt.pending + cnt.na;
    const pct = total > 0 ? (cnt.done + cnt.na) / total : 0;
    const row = ws2.getRow(itSectionRow + 2 + idx);
    row.height = 22;
    const bg = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;
    [label, cnt.done, cnt.pending, cnt.na, pct].forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: "TH SarabunPSK", size: 12 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : "center" };
      if (ci === 1 || ci === 3) { cell.font = { ...cell.font, bold: true, color: { argb: GREEN_FG } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } }; }
      else if (ci === 2) { cell.font = { ...cell.font, bold: true, color: { argb: ORANGE_FG } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_BG } }; }
    });
    row.getCell(5).numFmt = "0%";
  });

  ws2.views = [{ state: "frozen", xSplit: 0, ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];

  // ── Stream response ───────────────────────────────────────────────────
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const filename = `HR_Report_${stamp}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
});

export default router;
