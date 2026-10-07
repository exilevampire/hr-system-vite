import { NextFunction, Request, Response } from "express";
export interface IntegrationRequest extends Request {
    integrationClient?: {
        id: string;
        name: string;
        allowFullSync: boolean;
        fullSyncCompletedAt: Date | null;
    };
}
export declare function integrationAuth(req: IntegrationRequest, res: Response, next: NextFunction): Promise<void>;
