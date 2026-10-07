import { Router, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { integrationAuth, IntegrationRequest } from "../middleware/integrationAuth";
import { bangkokDayAfter, bangkokDayStart, parseThaiDate } from "../lib/integrationDates";

const router = Router();
const MAX_RANGE_DAYS = 31;
const MAX_RESULTS = 1000;
const MAX_FULL_SYNC_RESULTS = 10000;

function requestId() { return `req_${crypto.randomUUID().replace(/-/g, "")}`; }
function employeeResponse(employee: { employeeId: string; nameTh: string }) {
  return {
    employeeId: employee.employeeId,
    fullName: employee.nameTh,
  };
}

async function saveLog(args: {
  req: IntegrationRequest; requestId: string; statusCode: number; durationMs: number;
  resultCount?: number; errorCode?: string; recordedFrom?: Date; recordedTo?: Date; employeeIds?: string[];
}) {
  const client = args.req.integrationClient!;
  await prisma.integrationApiLog.create({
    data: {
      requestId: args.requestId, clientId: client.id, clientName: client.name,
      endpoint: args.req.path, method: args.req.method,
      recordedFrom: args.recordedFrom, recordedTo: args.recordedTo,
      resultCount: args.resultCount ?? 0, statusCode: args.statusCode,
      ipAddress: args.req.ip ?? null, durationMs: args.durationMs, errorCode: args.errorCode,
      items: args.employeeIds?.length ? { create: args.employeeIds.map((employeeId) => ({ employeeId })) } : undefined,
    },
  });
}

router.get("/health", integrationAuth, async (req: IntegrationRequest, res: Response) => {
  const started = Date.now();
  const id = requestId();
  await prisma.$queryRaw`SELECT 1`;
  await saveLog({ req, requestId: id, statusCode: 200, durationMs: Date.now() - started });
  res.json({ status: "ok", service: "HR Integration API", version: "1.0", requestId: id });
});

router.get("/terminated-employees", integrationAuth, async (req: IntegrationRequest, res: Response) => {
  const started = Date.now();
  const id = requestId();
  const fromInput = req.query.recordedFrom;
  const toInput = req.query.recordedTo;
  const fromDate = parseThaiDate(fromInput);
  const toDate = parseThaiDate(toInput);
  if (!fromDate || !toDate) {
    await saveLog({ req, requestId: id, statusCode: 400, durationMs: Date.now() - started, errorCode: "INVALID_DATE_FORMAT" });
    res.status(400).json({ error: { code: "INVALID_DATE_FORMAT", message: "วันที่ต้องอยู่ในรูปแบบ DD-MM-YYYY ปี พ.ศ. เช่น 05-10-2569", requestId: id } });
    return;
  }
  const rangeDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  if (rangeDays < 1 || rangeDays > MAX_RANGE_DAYS) {
    await saveLog({ req, requestId: id, statusCode: 400, durationMs: Date.now() - started, errorCode: "INVALID_DATE_RANGE", recordedFrom: fromDate, recordedTo: toDate });
    res.status(400).json({ error: { code: "INVALID_DATE_RANGE", message: "ช่วงวันที่ต้องเรียงถูกต้องและไม่เกิน 31 วัน", requestId: id } });
    return;
  }
  const employees = await prisma.employee.findMany({
    where: { createdAt: { gte: bangkokDayStart(fromDate), lt: bangkokDayAfter(toDate) }, endDate: { not: null } },
    orderBy: { id: "asc" }, take: MAX_RESULTS + 1,
    select: { employeeId: true, nameTh: true },
  });
  if (employees.length > MAX_RESULTS) {
    await saveLog({ req, requestId: id, statusCode: 422, durationMs: Date.now() - started, errorCode: "RESULT_LIMIT_EXCEEDED", recordedFrom: fromDate, recordedTo: toDate });
    res.status(422).json({ error: { code: "RESULT_LIMIT_EXCEEDED", message: "พบข้อมูลเกิน 1,000 รายการ กรุณาแบ่งช่วงวันที่ให้สั้นลง", requestId: id } });
    return;
  }
  await saveLog({ req, requestId: id, statusCode: 200, durationMs: Date.now() - started, resultCount: employees.length, recordedFrom: fromDate, recordedTo: toDate, employeeIds: employees.map((e) => e.employeeId) });
  res.json({ requestId: id, count: employees.length, query: { recordedFrom: fromInput, recordedTo: toInput }, data: employees.map(employeeResponse) });
});

router.get("/terminated-employees/full-sync", integrationAuth, async (req: IntegrationRequest, res: Response) => {
  const started = Date.now();
  const id = requestId();
  const client = req.integrationClient!;
  if (!client.allowFullSync) {
    await saveLog({ req, requestId: id, statusCode: 403, durationMs: Date.now() - started, errorCode: "FULL_SYNC_NOT_ALLOWED" });
    res.status(403).json({ error: { code: "FULL_SYNC_NOT_ALLOWED", message: "API Key นี้ไม่มีสิทธิ์ Full Sync", requestId: id } });
    return;
  }
  const claimed = await prisma.integrationClient.updateMany({
    where: { id: client.id, fullSyncCompletedAt: null },
    data: { fullSyncCompletedAt: new Date(), fullSyncRequestId: id },
  });
  if (claimed.count === 0) {
    await saveLog({ req, requestId: id, statusCode: 409, durationMs: Date.now() - started, errorCode: "FULL_SYNC_ALREADY_COMPLETED" });
    res.status(409).json({ error: { code: "FULL_SYNC_ALREADY_COMPLETED", message: "ระบบนี้ได้ดึงข้อมูลทั้งหมดเรียบร้อยแล้ว", requestId: id } });
    return;
  }
  try {
    const employees = await prisma.employee.findMany({
      where: { endDate: { not: null } }, orderBy: { id: "asc" }, take: MAX_FULL_SYNC_RESULTS + 1,
      select: { employeeId: true, nameTh: true },
    });
    if (employees.length > MAX_FULL_SYNC_RESULTS) throw new Error("FULL_SYNC_LIMIT_EXCEEDED");
    await saveLog({ req, requestId: id, statusCode: 200, durationMs: Date.now() - started, resultCount: employees.length, employeeIds: employees.map((e) => e.employeeId) });
    res.json({ requestId: id, count: employees.length, data: employees.map(employeeResponse) });
  } catch (error) {
    await prisma.integrationClient.update({ where: { id: client.id }, data: { fullSyncCompletedAt: null, fullSyncRequestId: null } });
    const code = error instanceof Error && error.message === "FULL_SYNC_LIMIT_EXCEEDED" ? "FULL_SYNC_LIMIT_EXCEEDED" : "INTERNAL_ERROR";
    await saveLog({ req, requestId: id, statusCode: code === "FULL_SYNC_LIMIT_EXCEEDED" ? 422 : 500, durationMs: Date.now() - started, errorCode: code });
    res.status(code === "FULL_SYNC_LIMIT_EXCEEDED" ? 422 : 500).json({ error: { code, message: code === "FULL_SYNC_LIMIT_EXCEEDED" ? "ข้อมูลเกิน 10,000 รายการ ไม่สามารถ Full Sync แบบครั้งเดียวได้" : "เกิดข้อผิดพลาดภายในระบบ", requestId: id } });
  }
});

export default router;
