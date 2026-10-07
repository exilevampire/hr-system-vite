import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, requireRole, AuthenticatedRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { DEFAULT_ADMIN_PERMISSIONS, VIEWER_PERMISSIONS, isPermission, resolvePermissions } from "../lib/permissions";

const router = Router();
const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "VIEWER"];
const allowedForRole = (role: string, permissions: string[]) =>
  role !== "VIEWER" || permissions.every((permission) => VIEWER_PERMISSIONS.includes(permission as (typeof VIEWER_PERMISSIONS)[number]));

router.get("/", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, totpEnabled: true, notifyOnImport: true, notifyOnRetire: true, createdAt: true, permissionsConfigured: true, permissions: { select: { permission: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(users.map((user) => ({ ...user, permissions: resolvePermissions(user) })));
});

router.post("/", authMiddleware, requireRole("SUPER_ADMIN"), async (req, res) => {
  const { name, email, password, role, permissions } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email และรหัสผ่านจำเป็น" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    return;
  }
  if (role && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
    return;
  }
  if (permissions !== undefined && (!Array.isArray(permissions) || !permissions.every(isPermission))) {
    res.status(400).json({ error: "รายการสิทธิ์ไม่ถูกต้อง" });
    return;
  }
  if (Array.isArray(permissions) && !allowedForRole(role ?? "VIEWER", permissions)) {
    res.status(400).json({ error: "Viewer สามารถใช้ได้เฉพาะสิทธิ์แบบอ่าน" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(400).json({ error: "Email นี้มีในระบบแล้ว" });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const selectedPermissions = role === "ADMIN"
    ? (permissions ?? DEFAULT_ADMIN_PERMISSIONS)
    : role === "VIEWER" || !role ? (permissions ?? VIEWER_PERMISSIONS) : [];
  const user = await prisma.user.create({
    data: {
      name: name || null, email, password: hashed, role: role ?? "VIEWER",
      permissionsConfigured: role !== "SUPER_ADMIN",
      permissions: { create: selectedPermissions.map((permission: string) => ({ permission })) },
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json(user);
});

router.patch("/:id", authMiddleware, requireRole("SUPER_ADMIN"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, email, password, role, notifyOnImport, notifyOnRetire, permissions } = req.body;

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
    return;
  }
  if (permissions !== undefined && (!Array.isArray(permissions) || !permissions.every(isPermission))) {
    res.status(400).json({ error: "รายการสิทธิ์ไม่ถูกต้อง" });
    return;
  }
  if (password !== undefined && password !== "") {
    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
      return;
    }
  }
  if (email !== undefined) {
    const conflict = await prisma.user.findFirst({ where: { email, NOT: { id } } });
    if (conflict) {
      res.status(400).json({ error: "Email นี้มีในระบบแล้ว" });
      return;
    }
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name || null;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (notifyOnImport !== undefined) data.notifyOnImport = Boolean(notifyOnImport);
  if (notifyOnRetire !== undefined) data.notifyOnRetire = Boolean(notifyOnRetire);
  if (password) data.password = await bcrypt.hash(password, 12);

  const current = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!current) { res.status(404).json({ error: "ไม่พบผู้ใช้" }); return; }
  const nextRole = role ?? current.role;
  if (Array.isArray(permissions) && !allowedForRole(nextRole, permissions)) {
    res.status(400).json({ error: "Viewer สามารถใช้ได้เฉพาะสิทธิ์แบบอ่าน" });
    return;
  }
  const configurableRole = nextRole === "ADMIN" || nextRole === "VIEWER";
  const shouldConfigure = configurableRole && (permissions !== undefined || current.role !== nextRole);
  const selectedPermissions = shouldConfigure
    ? (permissions ?? (nextRole === "ADMIN" ? DEFAULT_ADMIN_PERMISSIONS : VIEWER_PERMISSIONS))
    : undefined;

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { ...data, ...(shouldConfigure ? { permissionsConfigured: true } : !configurableRole ? { permissionsConfigured: false } : {}) },
      select: { id: true, name: true, email: true, role: true, notifyOnImport: true, notifyOnRetire: true, permissionsConfigured: true },
    });
    if (selectedPermissions !== undefined || !configurableRole) {
      await tx.userPermission.deleteMany({ where: { userId: id } });
    }
    if (selectedPermissions?.length) {
      await tx.userPermission.createMany({ data: selectedPermissions.map((permission: string) => ({ userId: id, permission })) });
    }
    const rows = await tx.userPermission.findMany({ where: { userId: id }, select: { permission: true } });
    return { ...updated, permissions: resolvePermissions({ ...updated, permissions: rows }) };
  });
  res.json(user);
});

router.post("/:id/reset-2fa", authMiddleware, requireRole("SUPER_ADMIN"), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (id === req.user!.id) {
    res.status(400).json({ error: "ไม่สามารถรีเซ็ต 2FA ของบัญชีตัวเองจากหน้านี้ได้" });
    return;
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, totpEnabled: true },
  });
  if (!target) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" });
    return;
  }
  if (!target.totpEnabled) {
    res.status(400).json({ error: "ผู้ใช้นี้ยังไม่ได้เปิดใช้งาน 2FA" });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { totpEnabled: false, totpSecret: null, backupCodes: null },
    }),
    prisma.securityAudit.create({
      data: {
        action: "RESET_2FA",
        actorUserId: req.user!.id,
        targetUserId: id,
        actorEmail: req.user!.email,
        targetEmail: target.email,
        ipAddress: req.ip ?? null,
      },
    }),
  ]);

  console.warn(`[Security] 2FA reset for ${target.email} by ${req.user!.email} from IP ${req.ip ?? "unknown"} at ${new Date().toISOString()}`);
  res.json({ success: true });
});

router.delete("/:id", authMiddleware, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const { id } = _req.params;
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
