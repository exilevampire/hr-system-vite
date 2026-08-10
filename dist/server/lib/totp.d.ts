export declare function generateSecret(): string;
export declare function generateTOTP(secret: string): string;
export declare function verifyTOTP(secret: string, token: string, windowSteps?: number): boolean;
export declare function buildOtpauthURL(issuer: string, email: string, secret: string): string;
