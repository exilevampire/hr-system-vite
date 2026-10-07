"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationOpenApi = void 0;
exports.integrationOpenApi = {
    openapi: "3.0.3",
    info: { title: "HR Integration API", version: "1.0.0", description: "API สำหรับส่งข้อมูลพนักงานพ้นสภาพให้ระบบภายนอก วันที่ใช้รูปแบบ DD-MM-YYYY ปี พ.ศ." },
    servers: [{ url: "/api/integrations/v1" }],
    security: [{ bearerAuth: [] }],
    components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "API Key ที่ได้รับจากผู้ดูแลระบบ" } },
        schemas: {
            TerminatedEmployee: { type: "object", properties: {
                    employeeId: { type: "string", example: "123456", description: "รหัสพนักงาน" },
                    fullName: { type: "string", example: "สมชาย ใจดี", description: "ชื่อ-นามสกุลภาษาไทย" },
                } },
            Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, requestId: { type: "string" } } } } },
        },
    },
    paths: {
        "/health": { get: { summary: "ตรวจสอบสถานะ API และฐานข้อมูล", responses: { "200": { description: "พร้อมใช้งาน" }, "401": { description: "API Key ไม่ถูกต้อง" } } } },
        "/terminated-employees": { get: { summary: "ค้นหาพนักงานพ้นสภาพตามช่วงวันที่บันทึก", parameters: [
                    { name: "recordedFrom", in: "query", required: true, schema: { type: "string", example: "01-10-2569" }, description: "วันที่เริ่มต้น DD-MM-YYYY ปี พ.ศ." },
                    { name: "recordedTo", in: "query", required: true, schema: { type: "string", example: "05-10-2569" }, description: "วันที่สิ้นสุด DD-MM-YYYY ปี พ.ศ. ช่วงสูงสุด 31 วัน" },
                ], responses: {
                    "200": { description: "สำเร็จ", content: { "application/json": { schema: { type: "object", properties: { requestId: { type: "string" }, count: { type: "integer" }, data: { type: "array", items: { $ref: "#/components/schemas/TerminatedEmployee" } } } } } } },
                    "400": { description: "วันที่ไม่ถูกต้อง", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "422": { description: "ผลลัพธ์เกิน 1,000 รายการ" },
                } } },
        "/terminated-employees/full-sync": { get: { summary: "ดึงข้อมูลทั้งหมดครั้งแรก", description: "เรียกสำเร็จได้หนึ่งครั้งต่อ API Client และส่งสูงสุด 10,000 รายการ", responses: {
                    "200": { description: "สำเร็จ", content: { "application/json": { schema: { type: "object", properties: { requestId: { type: "string" }, count: { type: "integer" }, data: { type: "array", items: { $ref: "#/components/schemas/TerminatedEmployee" } } } } } } },
                    "403": { description: "ไม่มีสิทธิ์ Full Sync" }, "409": { description: "เคยทำ Full Sync แล้ว" }, "422": { description: "ข้อมูลเกิน 10,000 รายการ" },
                } } },
    },
};
