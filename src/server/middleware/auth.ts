import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { Permission, resolvePermissions } from "../lib/permissions";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; name?: string | null; role: string; permissions: Permission[] };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id?: string };
    if (!payload.id) throw new Error("Invalid token payload");
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true, email: true, name: true, role: true, permissionsConfigured: true,
        permissions: { select: { permission: true } },
      },
    });
    if (!user) throw new Error("User not found");
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role, permissions: resolvePermissions(user) };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(permission)) {
      res.status(403).json({ error: "คุณไม่มีสิทธิ์ดำเนินการนี้" });
      return;
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
