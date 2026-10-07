"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requirePermission = requirePermission;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const permissions_1 = require("../lib/permissions");
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";
async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (!payload.id)
            throw new Error("Invalid token payload");
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.id },
            select: {
                id: true, email: true, name: true, role: true, permissionsConfigured: true,
                permissions: { select: { permission: true } },
            },
        });
        if (!user)
            throw new Error("User not found");
        req.user = { id: user.id, email: user.email, name: user.name, role: user.role, permissions: (0, permissions_1.resolvePermissions)(user) };
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid token" });
    }
}
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user?.permissions.includes(permission)) {
            res.status(403).json({ error: "คุณไม่มีสิทธิ์ดำเนินการนี้" });
            return;
        }
        next();
    };
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        next();
    };
}
