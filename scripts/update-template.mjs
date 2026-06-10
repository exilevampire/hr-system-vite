import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "../public/employee_import_template.xlsx");

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Template");

const headers = [
  { header: "ข้อมูลต้นทาง",       note: "1=สบค., 2=ศล." },
  { header: "เดือน",               note: "1-12" },
  { header: "ปี",                  note: "พ.ศ. เช่น 2567" },
  { header: "วันที่ได้รับข้อมูล", note: "วัน/เดือน/ปี พ.ศ." },
  { header: "รหัสประจำตัว",        note: "required" },
  { header: "ชื่อ-สกุล",           note: "required" },
  { header: "Name-Eng",            note: "" },
  { header: "ตำแหน่ง",             note: "" },
  { header: "ประเภท",              note: "" },
  { header: "ฝ่าย/กลุ่ม/งาน",     note: "" },
  { header: "หน่วยงาน",            note: "" },
  { header: "วันที่พ้นสภาพ",       note: "วัน/เดือน/ปี พ.ศ." },
];

// Header row
const headerRow = ws.addRow(headers.map((h) => h.header));
headerRow.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
});
headerRow.height = 24;

// Note row
const noteRow = ws.addRow(headers.map((h) => h.note));
noteRow.eachCell((cell) => {
  cell.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
});

// Example rows
const examples = [
  [1, 6, 2568, "15/6/2568", "EMP001", "สมชาย ใจดี",    "Somchai Jaidee",  "นักวิชาการคอมพิวเตอร์",        "ข้าราชการ",    "ฝ่ายเทคโนโลยีสารสนเทศ", "สำนักงานบริหารทรัพยากรบุคคล", "30/6/2568"],
  [2, 6, 2568, "15/6/2568", "EMP002", "สมหญิง รักงาน", "Somying Rakngam", "เจ้าหน้าที่บริหารงานทั่วไป",  "ลูกจ้างประจำ", "ฝ่ายบริหาร",             "ศูนย์บริการโลหิตแห่งชาติ",     "30/6/2568"],
];

examples.forEach((rowData) => {
  const row = ws.addRow(rowData);
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });
});

// Column widths
const widths = [16, 8, 8, 20, 14, 24, 24, 24, 14, 22, 30, 18];
headers.forEach((_, i) => {
  ws.getColumn(i + 1).width = widths[i] ?? 14;
});

ws.views = [{ state: "frozen", ySplit: 2 }];

await wb.xlsx.writeFile(OUTPUT);
console.log("Template written to:", OUTPUT);
