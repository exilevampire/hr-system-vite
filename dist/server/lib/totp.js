"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecret = generateSecret;
exports.generateTOTP = generateTOTP;
exports.verifyTOTP = verifyTOTP;
exports.buildOtpauthURL = buildOtpauthURL;
const crypto_1 = __importDefault(require("crypto"));
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(secret) {
    const s = secret.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
    let bits = "";
    for (const char of s) {
        const val = BASE32_CHARS.indexOf(char);
        if (val < 0)
            continue;
        bits += val.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}
function base32Encode(buf) {
    let bits = "";
    for (const byte of buf)
        bits += byte.toString(2).padStart(8, "0");
    let result = "";
    for (let i = 0; i + 5 <= bits.length; i += 5) {
        result += BASE32_CHARS[parseInt(bits.slice(i, i + 5), 2)];
    }
    return result;
}
function generateSecret() {
    return base32Encode(crypto_1.default.randomBytes(20));
}
function computeTOTP(secret, counter) {
    const key = base32Decode(secret);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto_1.default.createHmac("sha1", key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, "0");
}
function generateTOTP(secret) {
    return computeTOTP(secret, Math.floor(Date.now() / 30000));
}
function verifyTOTP(secret, token, windowSteps = 4) {
    const counter = Math.floor(Date.now() / 30000);
    const t = token.trim();
    for (let i = -windowSteps; i <= windowSteps; i++) {
        if (computeTOTP(secret, counter + i) === t)
            return true;
    }
    return false;
}
function buildOtpauthURL(issuer, email, secret) {
    const label = encodeURIComponent(`${issuer}:${email}`);
    const iss = encodeURIComponent(issuer);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}
