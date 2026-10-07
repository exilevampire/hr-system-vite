"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USERNAME_PATTERN = void 0;
exports.normalizeUsername = normalizeUsername;
exports.validateUsername = validateUsername;
exports.backfillUsernames = backfillUsernames;
const prisma_1 = require("./prisma");
exports.USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;
function normalizeUsername(value) {
    return String(value ?? "").trim().toLowerCase();
}
function validateUsername(value) {
    const username = normalizeUsername(value);
    if (!exports.USERNAME_PATTERN.test(username)) {
        return "Username ต้องมี 3-50 ตัวอักษร และใช้ได้เฉพาะ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง";
    }
    return null;
}
function usernameBase(email, id) {
    const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const base = local.replace(/^[._-]+/, "").slice(0, 42);
    return base.length >= 3 ? base : `user-${id.slice(-8).toLowerCase()}`;
}
async function backfillUsernames() {
    const users = await prisma_1.prisma.user.findMany({
        where: { username: null },
        select: { id: true, email: true },
        orderBy: { createdAt: "asc" },
    });
    for (const user of users) {
        const base = usernameBase(user.email, user.id);
        let suffix = 0;
        while (true) {
            const ending = suffix ? `-${suffix}` : "";
            const username = `${base.slice(0, 50 - ending.length)}${ending}`;
            const conflict = await prisma_1.prisma.user.findFirst({ where: { username }, select: { id: true } });
            if (!conflict) {
                await prisma_1.prisma.user.update({ where: { id: user.id }, data: { username } });
                break;
            }
            suffix++;
        }
    }
}
