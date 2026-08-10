export interface ImportSummary {
    inserted: number;
    updated: number;
    unchanged: number;
    errors: number;
    sourceName: string;
    importedBy: string;
    appUrl: string;
}
export declare function sendImportNotification(recipients: string[], summary: ImportSummary): Promise<void>;
export interface RetireEmployee {
    nameTh: string;
    position?: string | null;
    bureau?: string | null;
    department?: string | null;
}
export declare function sendRetireNotification(recipients: string[], employees: RetireEmployee[], appUrl: string): Promise<void>;
