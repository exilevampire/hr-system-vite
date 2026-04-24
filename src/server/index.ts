import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

import authRouter from "./routes/auth";
import employeesRouter from "./routes/employees";
import dashboardRouter from "./routes/dashboard";
import screeningRouter from "./routes/screening";
import logsRouter from "./routes/logs";
import usersRouter from "./routes/users";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001");
const isProd = process.env.NODE_ENV === "production";

if (!isProd) {
  app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));
}

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/screening", screeningRouter);
app.use("/api/logs", logsRouter);
app.use("/api/users", usersRouter);

if (isProd) {
  const clientDist = path.join(__dirname, "../client");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
