"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const adapter_mariadb_1 = require("@prisma/adapter-mariadb");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const url = process.env.DATABASE_URL ?? "mysql://root:password@localhost:3306/hr_integrity_db";
const match = url.match(/mysql:\/\/([^:]+):([^@]*)@([^:]+):(\d+)\/(.+)/);
if (!match)
    throw new Error("Invalid DATABASE_URL");
const adapter = new adapter_mariadb_1.PrismaMariaDb({
    host: match[3],
    port: parseInt(match[4]),
    user: match[1],
    password: match[2],
    database: match[5],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    const password = await bcryptjs_1.default.hash("admin1234", 12);
    await prisma.user.upsert({
        where: { email: "superadmin@redcross.or.th" },
        update: {},
        create: { name: "Super Admin", email: "superadmin@redcross.or.th", password, role: "SUPER_ADMIN" },
    });
    await prisma.user.upsert({
        where: { email: "hradmin@redcross.or.th" },
        update: {},
        create: { name: "HR Admin", email: "hradmin@redcross.or.th", password, role: "ADMIN" },
    });
    await prisma.user.upsert({
        where: { email: "viewer@redcross.or.th" },
        update: {},
        create: { name: "Viewer", email: "viewer@redcross.or.th", password, role: "VIEWER" },
    });
    console.log("✅ Seed completed");
    console.log("Super Admin: superadmin@redcross.or.th / admin1234");
    console.log("HR Admin:    hradmin@redcross.or.th / admin1234");
    console.log("Viewer:      viewer@redcross.or.th / admin1234");
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
