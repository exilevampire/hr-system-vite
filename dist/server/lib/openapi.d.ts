export declare const integrationOpenApi: {
    readonly openapi: "3.0.3";
    readonly info: {
        readonly title: "HR Integration API";
        readonly version: "1.0.0";
        readonly description: "API สำหรับส่งข้อมูลพนักงานพ้นสภาพให้ระบบภายนอก วันที่ใช้รูปแบบ DD-MM-YYYY ปี พ.ศ.";
    };
    readonly servers: readonly [{
        readonly url: "/api/integrations/v1";
    }];
    readonly security: readonly [{
        readonly bearerAuth: readonly [];
    }];
    readonly components: {
        readonly securitySchemes: {
            readonly bearerAuth: {
                readonly type: "http";
                readonly scheme: "bearer";
                readonly description: "API Key ที่ได้รับจากผู้ดูแลระบบ";
            };
        };
        readonly schemas: {
            readonly TerminatedEmployee: {
                readonly type: "object";
                readonly properties: {
                    readonly employeeId: {
                        readonly type: "string";
                        readonly example: "123456";
                    };
                    readonly fullName: {
                        readonly type: "string";
                        readonly example: "สมชาย ใจดี";
                    };
                    readonly position: {
                        readonly type: "string";
                        readonly nullable: true;
                    };
                    readonly department: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly description: "ฝ่าย";
                    };
                    readonly office: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly description: "สำนักงาน";
                    };
                    readonly terminationDate: {
                        readonly type: "string";
                        readonly nullable: true;
                        readonly example: "05-10-2569";
                    };
                };
            };
            readonly Error: {
                readonly type: "object";
                readonly properties: {
                    readonly error: {
                        readonly type: "object";
                        readonly properties: {
                            readonly code: {
                                readonly type: "string";
                            };
                            readonly message: {
                                readonly type: "string";
                            };
                            readonly requestId: {
                                readonly type: "string";
                            };
                        };
                    };
                };
            };
        };
    };
    readonly paths: {
        readonly "/health": {
            readonly get: {
                readonly summary: "ตรวจสอบสถานะ API และฐานข้อมูล";
                readonly responses: {
                    readonly "200": {
                        readonly description: "พร้อมใช้งาน";
                    };
                    readonly "401": {
                        readonly description: "API Key ไม่ถูกต้อง";
                    };
                };
            };
        };
        readonly "/terminated-employees": {
            readonly get: {
                readonly summary: "ค้นหาพนักงานพ้นสภาพตามช่วงวันที่บันทึก";
                readonly parameters: readonly [{
                    readonly name: "recordedFrom";
                    readonly in: "query";
                    readonly required: true;
                    readonly schema: {
                        readonly type: "string";
                        readonly example: "01-10-2569";
                    };
                    readonly description: "วันที่เริ่มต้น DD-MM-YYYY ปี พ.ศ.";
                }, {
                    readonly name: "recordedTo";
                    readonly in: "query";
                    readonly required: true;
                    readonly schema: {
                        readonly type: "string";
                        readonly example: "05-10-2569";
                    };
                    readonly description: "วันที่สิ้นสุด DD-MM-YYYY ปี พ.ศ. ช่วงสูงสุด 31 วัน";
                }];
                readonly responses: {
                    readonly "200": {
                        readonly description: "สำเร็จ";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly requestId: {
                                            readonly type: "string";
                                        };
                                        readonly count: {
                                            readonly type: "integer";
                                        };
                                        readonly data: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly $ref: "#/components/schemas/TerminatedEmployee";
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly "400": {
                        readonly description: "วันที่ไม่ถูกต้อง";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly $ref: "#/components/schemas/Error";
                                };
                            };
                        };
                    };
                    readonly "422": {
                        readonly description: "ผลลัพธ์เกิน 1,000 รายการ";
                    };
                };
            };
        };
        readonly "/terminated-employees/full-sync": {
            readonly get: {
                readonly summary: "ดึงข้อมูลทั้งหมดครั้งแรก";
                readonly description: "เรียกสำเร็จได้หนึ่งครั้งต่อ API Client และส่งสูงสุด 10,000 รายการ";
                readonly responses: {
                    readonly "200": {
                        readonly description: "สำเร็จ";
                        readonly content: {
                            readonly "application/json": {
                                readonly schema: {
                                    readonly type: "object";
                                    readonly properties: {
                                        readonly requestId: {
                                            readonly type: "string";
                                        };
                                        readonly count: {
                                            readonly type: "integer";
                                        };
                                        readonly data: {
                                            readonly type: "array";
                                            readonly items: {
                                                readonly $ref: "#/components/schemas/TerminatedEmployee";
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                    readonly "403": {
                        readonly description: "ไม่มีสิทธิ์ Full Sync";
                    };
                    readonly "409": {
                        readonly description: "เคยทำ Full Sync แล้ว";
                    };
                    readonly "422": {
                        readonly description: "ข้อมูลเกิน 10,000 รายการ";
                    };
                };
            };
        };
    };
};
