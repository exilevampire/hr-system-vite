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

function toBE(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function isItCleared(e: {
  fmis: string | null;
  eMeeting: string | null;
  website: string | null;
  phone3cx: string | null;
  intranet: string | null;
  hrSent: string | null;
}): boolean {
  return [e.fmis, e.eMeeting, e.website, e.phone3cx, e.intranet, e.hrSent].every(
    (f) => f && f.trim() !== ""
  );
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
  const { dateFrom, dateTo, bureau, itStatus } = req.query;

  const where: { endDate?: { gte?: Date; lte?: Date }; bureau?: string } = {};

  if (typeof dateFrom === "string" && dateFrom) {
    where.endDate = { ...where.endDate, gte: new Date(dateFrom) };
  }
  if (typeof dateTo === "string" && dateTo) {
    where.endDate = { ...where.endDate, lte: new Date(dateTo) };
  }
  if (typeof bureau === "string" && bureau && bureau !== "all") {
    where.bureau = bureau;
  }

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ bureau: "asc" }, { endDate: "desc" }],
  });

  const filtered = employees.filter((e) => {
    if (!itStatus || itStatus === "all") return true;
    const cleared = isItCleared(e);
    return itStatus === "cleared" ? cleared : !cleared;
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
    { key: "no",         width: 7   },
    { key: "employeeId", width: 14  },
    { key: "nameTh",     width: 28  },
    { key: "nameEn",     width: 26  },
    { key: "position",   width: 22  },
    { key: "level",      width: 10  },
    { key: "department", width: 20  },
    { key: "bureau",     width: 24  },
    { key: "startDate",  width: 13  },
    { key: "endDate",    width: 13  },
    { key: "itStatus",   width: 13  },
    { key: "fmis",       width: 14  },
    { key: "eMeeting",   width: 14  },
    { key: "website",    width: 14  },
    { key: "phone3cx",   width: 10  },
    { key: "intranet",   width: 12  },
    { key: "hrSent",     width: 12  },
    { key: "email",      width: 28  },
    { key: "remarks",    width: 30  },
  ];

  const HEADERS = [
    "ลำดับ", "รหัสพนักงาน", "ชื่อ-สกุล (ไทย)", "ชื่อ-สกุล (อังกฤษ)", "ตำแหน่ง",
    "ระดับ", "ฝ่าย/กลุ่มงาน", "หน่วยงาน/สำนัก", "วันเริ่มงาน", "วันพ้นสภาพ",
    "สถานะ IT", "FMIS", "eMeeting", "Website", "3CX",
    "Intranet", "บค. ส่ง", "Email", "หมายเหตุ",
  ];

  // Header row (row 2)
  const hRow = ws.getRow(2);
  hRow.height = 30;
  HEADERS.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    applyHeaderStyle(cell);
  });

  // Data rows (starting at row 3)
  const CENTER_COLS = new Set([1, 2, 9, 10, 11, 12, 13, 14, 15, 16, 17]);

  filtered.forEach((e, idx) => {
    const cleared = isItCleared(e);
    const rowNum = idx + 3;
    const row = ws.getRow(rowNum);
    row.height = 19;

    const values = [
      idx + 1,
      e.employeeId,
      e.nameTh,
      e.nameEn ?? "",
      e.position ?? "",
      e.level ?? "",
      e.department ?? "",
      e.bureau ?? "",
      toBE(e.startDate),
      toBE(e.endDate),
      cleared ? "ปิดแล้ว" : "ยังไม่ปิด",
      e.fmis ?? "",
      e.eMeeting ?? "",
      e.website ?? "",
      e.phone3cx ?? "",
      e.intranet ?? "",
      e.hrSent ?? "",
      e.email ?? "",
      e.remarks ?? "",
    ];

    const rowBg = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;

    values.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val;
      cell.font = { name: "TH SarabunPSK", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: CENTER_COLS.has(ci + 1) ? "center" : "left" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    });

    // IT status coloring (col 11)
    const itCell = row.getCell(11);
    itCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cleared ? GREEN_BG : ORANGE_BG } };
    itCell.font = { name: "TH SarabunPSK", size: 10, bold: true, color: { argb: cleared ? GREEN_FG : ORANGE_FG } };
  });

  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2, topLeftCell: "A3", activeCell: "A3" }];
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
  t2.value = `สรุปสถานะ IT ตามหน่วยงาน  —  ณ วันที่ ${reportDate}`;
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
