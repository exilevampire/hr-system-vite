"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const twofa_1 = __importDefault(require("./routes/twofa"));
const employees_1 = __importDefault(require("./routes/employees"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const logs_1 = __importDefault(require("./routes/logs"));
const users_1 = __importDefault(require("./routes/users"));
const reports_1 = __importDefault(require("./routes/reports"));
const datasources_1 = __importDefault(require("./routes/datasources"));
const settings_1 = __importDefault(require("./routes/settings"));
const prisma_1 = require("./lib/prisma");
const retireCron_1 = require("./lib/retireCron");
const app = (0, express_1.default)();
const rawPort = process.env.PORT ?? "3001";
const PORT = isNaN(Number(rawPort)) ? rawPort : Number(rawPort);
const isProd = process.env.NODE_ENV === "production";
// ── Warn on weak JWT secret ────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me") {
    console.warn("⚠️  WARNING: JWT_SECRET is not set or is using the default value. Set a strong secret in .env");
}
// ── Security headers ───────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "same-origin" },
    contentSecurityPolicy: isProd ? undefined : false,
}));
// ── CORS ───────────────────────────────────────────────────────────────
if (!isProd) {
    app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));
}
// ── Body size limit ────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: "1mb" }));
// ── Rate limiting ──────────────────────────────────────────────────────
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที" },
    standardHeaders: true,
    legacyHeaders: false,
});
const twoFALimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: { error: "พยายามยืนยัน OTP มากเกินไป กรุณารอ 5 นาที" },
    standardHeaders: true,
    legacyHeaders: false,
});
// ── Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/2fa/verify", twoFALimiter);
app.use("/api/auth/2fa/enable", twoFALimiter);
app.use("/api/auth", auth_1.default);
app.use("/api/auth/2fa", twofa_1.default);
app.use("/api/employees", employees_1.default);
app.use("/api/dashboard", dashboard_1.default);
app.use("/api/logs", logs_1.default);
app.use("/api/users", users_1.default);
app.use("/api/reports", reports_1.default);
app.use("/api/datasources", datasources_1.default);
app.use("/api/settings", settings_1.default);
if (isProd) {
    const clientDist = path_1.default.join(__dirname, "../client");
    app.use(express_1.default.static(clientDist));
    app.get("*", (_req, res) => {
        res.sendFile(path_1.default.join(clientDist, "index.html"));
    });
}
else {
    const VITE_PORT = parseInt(process.env.VITE_PORT ?? "5173");
    app.get("/", (_req, res) => res.redirect(`http://localhost:${VITE_PORT}`));
}
app.listen(PORT, async () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    try {
        const setting = await prisma_1.prisma.systemSetting.findUnique({ where: { key: "retire_notify_time" } });
        (0, retireCron_1.scheduleRetireNotify)(setting?.value ?? "08:00");
    }
    catch (err) {
        console.error("⚠️  Failed to init retire cron:", err);
    }
});
