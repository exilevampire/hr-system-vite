import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

export interface IntegrationRequest extends Request {
  integrationClient?: { id: string; name: string; allowFullSync: boolean; fullSyncCompletedAt: Date | null };
}

function normalizeIp(ip: string | undefined): string {
  return (ip ?? "").replace(/^::ffff:/, "");
}

export async function integrationAuth(req: IntegrationRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: { code: "MISSING_API_KEY", message: "กรุณาส่ง API Key ใน Authorization header" } });
    return;
  }
  const apiKey = header.slice(7).trim();
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const client = await prisma.integrationClient.findUnique({ where: { keyHash } });
  if (!client || !client.isActive) {
    res.status(401).json({ error: { code: "INVALID_API_KEY", message: "API Key ไม่ถูกต้องหรือถูกปิดใช้งาน" } });
    return;
  }
  if (client.expiresAt && client.expiresAt <= new Date()) {
    res.status(401).json({ error: { code: "API_KEY_EXPIRED", message: "API Key หมดอายุแล้ว" } });
    return;
  }
  const allowlist = Array.isArray(client.ipAllowlist) ? client.ipAllowlist.filter((ip): ip is string => typeof ip === "string") : [];
  const requestIp = normalizeIp(req.ip);
  if (allowlist.length && !allowlist.includes(requestIp)) {
    res.status(403).json({ error: { code: "IP_NOT_ALLOWED", message: "IP Address นี้ไม่ได้รับอนุญาต" } });
    return;
  }
  req.integrationClient = {
    id: client.id, name: client.name, allowFullSync: client.allowFullSync,
    fullSyncCompletedAt: client.fullSyncCompletedAt,
  };
  await prisma.integrationClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } });
  next();
}
