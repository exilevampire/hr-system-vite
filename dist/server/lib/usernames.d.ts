export declare const USERNAME_PATTERN: RegExp;
export declare function normalizeUsername(value: unknown): string;
export declare function validateUsername(value: unknown): string | null;
export declare function backfillUsernames(): Promise<void>;
