"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
function createPrismaClient() {
    const url = process.env.DATABASE_URL ?? "";
    const match = url.match(/mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)/);
    if (!match)
        throw new Error("Invalid DATABASE_URL. Expected: mysql://user:pass@host:port/dbname");
    const adapter = new adapter_mariadb_1.PrismaMariaDb({
        host: match[3],
        port: parseInt(match[4]),
        user: match[1],
        password: match[2],
        database: match[5],
        connectionLimit: 5,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new client_1.PrismaClient({ adapter });
}
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
