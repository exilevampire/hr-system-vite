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
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.originalname.match(/\.(xlsx|xls)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error("อนุญาตเฉพาะไฟล์ Excel (.xlsx, .xls) เท่านั้น"));
        }
    },
});
router.get("/", auth_1.authMiddleware, async (req, res) => {
    const q = String(req.query.q ?? "");
    if (!q.trim()) {
        res.json({ found: false });
        return;
    }
    const employee = await prisma_1.prisma.employee.findFirst({
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
router.post("/bulk", auth_1.authMiddleware, upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: "ไม่พบไฟล์" });
        return;
    }
    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) {
        res.status(400).json({ error: "ไฟล์ว่างเปล่า" });
        return;
    }
    const headers = rows[0].map((h) => String(h ?? "").toLowerCase().trim());
    const nameIdx = headers.findIndex((h) => ["ชื่อ", "name", "ชื่อ-สกุล"].includes(h));
    const idIdx = headers.findIndex((h) => ["รหัส", "id", "รหัสประจำตัว", "employeeid"].includes(h));
    if (nameIdx === -1 && idIdx === -1) {
        res.status(400).json({ error: "ไม่พบคอลัมน์ชื่อหรือรหัสในไฟล์" });
        return;
    }
    const results = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const query = String(row[nameIdx !== -1 ? nameIdx : idIdx] ?? "").trim();
        if (!query)
            continue;
        const employee = await prisma_1.prisma.employee.findFirst({
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
exports.default = router;
