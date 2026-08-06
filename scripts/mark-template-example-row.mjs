import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, "../public/Import_Template.xlsx");

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(templatePath);

const sheet = workbook.worksheets[0];
const row2 = sheet.getRow(2);

// Set default font for the workbook
workbook.properties = workbook.properties ?? {};
workbook.defaultFont = { name: "TH Sarabun New", size: 14 };

// Set TH Sarabun New size 14 for all cells that have explicit font set
sheet.eachRow({ includeEmpty: false }, (row) => {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...cell.font, name: "TH Sarabun New", size: 14 };
  });
});

const FONT = "TH Sarabun New";
const SIZE = 14;

// Color all cells in row 2 with light yellow background
row2.eachCell({ includeEmpty: true }, (cell) => {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFD966" }, // yellow
  };
  cell.font = {
    name: FONT,
    size: SIZE,
    italic: true,
    color: { argb: "FF7F6000" }, // dark amber text
  };
});

// Restore first cell if it has the old warning prefix
const firstCell = row2.getCell(1);
if (firstCell.value && String(firstCell.value).startsWith("⚠️ ลบแถวนี้ออก — ")) {
  firstCell.value = String(firstCell.value).replace("⚠️ ลบแถวนี้ออก — ", "");
}

// Put warning in ชื่อ-สกุล column (column 6 = F)
const nameCell = row2.getCell(6);
nameCell.value = "⚠️ ลบแถวนี้ออกก่อนใช้งาน";
nameCell.font = {
  name: FONT,
  size: SIZE,
  italic: true,
  bold: true,
  color: { argb: "FFFF0000" }, // red
};

// Find column indices for IT status fields from header row
const headerRow = sheet.getRow(1);
const itStatusCols = [];
headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
  const val = String(cell.value ?? "").trim().toLowerCase();
  if (["fmis", "emeeting", "software", "phonebook"].includes(val)) {
    itStatusCols.push(colNum);
  }
});

// Add dropdown validation to IT status columns (rows 3–200)
const statusOptions = '"ดำเนินการแล้ว,ยังไม่ดำเนินการ,ไม่พบบัญชี"';
for (const colNum of itStatusCols) {
  for (let r = 3; r <= 200; r++) {
    const cell = sheet.getCell(r, colNum);
    cell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [statusOptions],
      showDropDown: false,
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "ค่าไม่ถูกต้อง",
      error: "กรุณาเลือก: ดำเนินการแล้ว, ยังไม่ดำเนินการ หรือ ไม่พบบัญชี",
    };
  }
}

await workbook.xlsx.writeFile(templatePath);

// Also copy to dist/client if it exists
const distPath = path.join(__dirname, "../dist/client/Import_Template.xlsx");
if (fs.existsSync(path.dirname(distPath))) {
  fs.copyFileSync(templatePath, distPath);
  console.log("Copied to dist/client/");
}

console.log("Done: row 2 marked in Import_Template.xlsx");
