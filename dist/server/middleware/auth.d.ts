import { Request, Response, NextFunction } from "express";
import { Permission } from "../lib/permissions";
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        name?: string | null;
        role: string;
        permissions: Permission[];
    };
}
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
export declare function requirePermission(permission: Permission): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare function requireRole(...roles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
