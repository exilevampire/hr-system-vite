import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";

import authRouter from "./routes/auth";
import twofaRouter from "./routes/twofa";
import employeesRouter from "./routes/employees";
import dashboardRouter from "./routes/dashboard";
import logsRouter from "./routes/logs";
import usersRouter from "./routes/users";
import reportsRouter from "./routes/reports";
import dataSourcesRouter from "./routes/datasources";
import settingsRouter from "./routes/settings";
import { prisma } from "./lib/prisma";
import { scheduleRetireNotify } from "./lib/retireCron";

const app = express();
const rawPort = process.env.PORT ?? "3001";
const PORT: number | string = isNaN(Number(rawPort)) ? rawPort : Number(rawPort);
const isProd = process.env.NODE_ENV === "production";

// ── Warn on weak JWT secret ────────────────────────────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me") {
  console.warn("⚠️  WARNING: JWT_SECRET is not set or is using the default value. Set a strong secret in .env");
}

// ── Security headers ───────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-origin" },
  contentSecurityPolicy: isProd ? undefined : false,
}));

// ── CORS ───────────────────────────────────────────────────────────────
if (!isProd) {
  app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));
}

// ── Body size limit ────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ──────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที" },
  standardHeaders: true,
  legacyHeaders: false,
});

const twoFALimiter = rateLimit({
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

app.use("/api/auth", authRouter);
app.use("/api/auth/2fa", twofaRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/logs", logsRouter);
app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/datasources", dataSourcesRouter);
app.use("/api/settings", settingsRouter);

if (isProd) {
  const clientDist = path.join(__dirname, "../client");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  const VITE_PORT = parseInt(process.env.VITE_PORT ?? "5173");
  app.get("/", (_req, res) => res.redirect(`http://localhost:${VITE_PORT}`));
}

app.listen(PORT, async () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "retire_notify_time" } });
    scheduleRetireNotify(setting?.value ?? "08:00");
  } catch (err) {
    console.error("⚠️  Failed to init retire cron:", err);
  }
});
