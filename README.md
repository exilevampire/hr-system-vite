# HR System — ระบบบริหารข้อมูลพนักงานพ้นสภาพ

ระบบบริหารข้อมูลพนักงานที่พ้นสภาพของสภากาชาดไทย ใช้สำหรับติดตามสถานะการดำเนินการปิดสิทธิ์ระบบ IT ได้แก่ FMIS, eMeeting, Software และ Phonebook

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Recharts |
| Backend | Node.js, Express.js, TypeScript |
| ORM | Prisma 7 |
| Database | MariaDB |
| Auth | JWT (jsonwebtoken), bcryptjs |
| 2FA | TOTP (RFC 6238) — ใช้ได้กับ Google Authenticator, Authy, Microsoft Authenticator |
| Excel | ExcelJS (export), xlsx (import) |
| Security | Helmet, express-rate-limit, CORS |

---

## ฟีเจอร์หลัก

### หน้าข้อมูลพนักงาน (Records)
- แสดงรายการพนักงานพ้นสภาพพร้อม filter หลายมิติ (หน่วยงาน, ตำแหน่ง, ช่วงวันที่, สถานะ IT, ข้อมูลต้นทาง)
- ค้นหาด้วย รหัส / ชื่อ-สกุล (ไทย/อังกฤษ) / Email
- เพิ่ม / แก้ไข / ลบข้อมูลพนักงาน
- ติดตามสถานะดำเนินการ FMIS, eMeeting, Software, Phonebook พร้อมวันที่ดำเนินการ
- นำเข้าข้อมูลจากไฟล์ Excel (รองรับ header หลายรูปแบบ ทั้งภาษาไทยและอังกฤษ)
- ดาวน์โหลดไฟล์ตัวอย่างสำหรับนำเข้า

### หน้าแดชบอร์ด (Dashboard)
- ภาพรวมจำนวนพนักงานพ้นสภาพทั้งหมด
- สถานะการดำเนินการ IT (ปิดแล้ว / รอดำเนินการ) — Pie chart
- สถิติรายระบบ: FMIS / eMeeting / Software / Phonebook (ดำเนินการแล้ว / ยังไม่ดำเนินการ / ไม่พบบัญชี + progress bar)
- พนักงานแยกตามหน่วยงาน (Top 10)
- แนวโน้มรายเดือน (Bar chart)
- Filter ตามช่วงเวลา

### รายงาน Excel
- **Sheet 1**: รายการพนักงานครบทุก field พร้อมสีและ auto filter (รองรับ filter เดียวกับหน้าข้อมูล)
- **Sheet 2**: สรุปภาพรวม — ภาพรวมตัวเลข / แยกตามหน่วยงาน / แนวโน้มรายเดือน / สถิติรายระบบ

### การจัดการผู้ใช้
- 3 roles: `SUPER_ADMIN`, `ADMIN`, `VIEWER`
- SUPER_ADMIN: จัดการผู้ใช้ทั้งหมด, เพิ่ม/แก้ไข/ลบข้อมูลพนักงาน, เห็น field Email
- ADMIN: เพิ่ม/แก้ไขข้อมูล, ไม่เห็น Email
- VIEWER: ดูข้อมูลและดาวน์โหลดรายงานเท่านั้น

### Audit Log
- บันทึกทุกการเปลี่ยนแปลงข้อมูลพนักงาน (เพิ่ม/แก้ไข/ลบ)
- แสดง field ที่เปลี่ยนแปลง ค่าก่อน-หลัง และผู้ดำเนินการ

---

## ระบบ Security

### Authentication
- รหัสผ่านเข้ารหัสด้วย **bcrypt** (salt rounds: 10)
- JWT token อายุ **7 วัน** ส่งผ่าน `Authorization: Bearer <token>`
- Role-based access control ทุก API endpoint

### Two-Factor Authentication (2FA) — TOTP
ใช้มาตรฐาน **RFC 6238 (TOTP)** — ทำงานได้กับ Authenticator app ทุกตัว

| พารามิเตอร์ | ค่า |
|---|---|
| Algorithm | HMAC-SHA1 |
| Digits | 6 หลัก |
| Period | 30 วินาที |
| Window tolerance | ±4 steps (รองรับนาฬิกา drift ±2 นาที) |
| Secret encoding | Base32 |
| QR Code | `otpauth://totp/HR-RedCross:<email>?...` |

**ขั้นตอน Login เมื่อเปิด 2FA:**
1. กรอก Email + Password → รับ `tempToken` (อายุ 5 นาที)
2. กรอก OTP 6 หลักจาก Authenticator app → รับ JWT token เพื่อใช้งานระบบ

**Backup Codes:**
- ระบบสร้าง backup code 10 รหัสเมื่อเปิดใช้ 2FA
- แต่ละรหัสเป็น hex 8 หลัก รูปแบบ `XXXX-XXXX`
- hash ด้วย bcrypt ก่อนเก็บ DB (ใช้ได้ครั้งเดียว)
- ใช้แทน OTP ได้เมื่อไม่มี Authenticator app

### HTTP Security Headers
- **Helmet** — ตั้งค่า security headers อัตโนมัติ (CSP, HSTS, X-Frame-Options ฯลฯ)
- **express-rate-limit** — จำกัด request เพื่อป้องกัน brute force
- **CORS** — กำหนด allowed origin

---

## โครงสร้างโปรเจกต์

```
hr-system-vite/
├── src/
│   ├── client/
│   │   ├── components/       # Shared components (AppLayout, ThaiDatePicker ฯลฯ)
│   │   ├── contexts/         # AuthContext
│   │   ├── lib/              # apiFetch helper
│   │   └── pages/
│   │       ├── DashboardPage.tsx
│   │       ├── LoginPage.tsx
│   │       ├── LogsPage.tsx
│   │       ├── ReportPage.tsx
│   │       ├── AccountPage.tsx
│   │       ├── SettingsPage.tsx
│   │       └── records/
│   │           ├── AllRecordsPage.tsx
│   │           ├── AddRecordPage.tsx
│   │           ├── EditRecordPage.tsx
│   │           └── ImportPage.tsx
│   └── server/
│       ├── index.ts           # Express app entry point
│       ├── lib/
│       │   ├── prisma.ts
│       │   ├── totp.ts        # TOTP implementation (generate/verify/QR)
│       │   └── audit.ts       # Audit log helpers
│       ├── middleware/
│       │   └── auth.ts        # JWT middleware + requireRole
│       └── routes/
│           ├── auth.ts        # Login, /me
│           ├── twofa.ts       # 2FA setup/enable/disable/verify
│           ├── employees.ts   # CRUD พนักงาน
│           ├── reports.ts     # Excel export
│           ├── dashboard.ts   # Dashboard stats
│           ├── users.ts       # User management (SUPER_ADMIN)
│           ├── logs.ts        # Audit logs
│           └── datasources.ts # ข้อมูลต้นทาง
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
│   └── employee_import_template.xlsx
└── .env
```

---

## การติดตั้ง

### ความต้องการ
- Node.js 18+
- MariaDB 10.6+

### ขั้นตอน

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. สร้างไฟล์ .env
cp .env.example .env
# แก้ไข DATABASE_URL และ JWT_SECRET

# 3. สร้าง schema ใน DB
npm run db:push

# 4. สร้าง admin user เริ่มต้น
npm run db:seed

# 5. รันในโหมด development
npm run dev
```

### Environment Variables

```env
DATABASE_URL="mysql://user:password@localhost:3306/hr_integrity_db"
JWT_SECRET="your-secret-key-here"
PORT=3001
```

---

## Scripts

| Script | คำอธิบาย |
|---|---|
| `npm run dev` | รัน frontend (Vite :5173) + backend (:3001) พร้อมกัน |
| `npm run build` | Build สำหรับ production |
| `npm start` | รัน production build |
| `npm run db:push` | Sync schema กับ DB (ไม่สร้าง migration file) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | สร้างข้อมูลเริ่มต้น (admin user) |
| `npm run db:studio` | เปิด Prisma Studio |
| `npm run kill` | Kill port 3001, 5173, 5174 |

---

## Data Models หลัก

### Employee
| Field | ประเภท | คำอธิบาย |
|---|---|---|
| employeeId | String (unique) | รหัสพนักงาน |
| nameTh / nameEn | String | ชื่อ-สกุล ไทย/อังกฤษ |
| position / level | String | ตำแหน่ง / ประเภท |
| department / bureau | String | ฝ่าย / หน่วยงาน |
| endDate | DateTime | วันที่พ้นสภาพ |
| email | String | อีเมล |
| fmis / eMeeting / software / phonebook | String | สถานะดำเนินการ IT |
| fmisDate / eMeetingDate / softwareDate / phonebookDate | DateTime | วันที่ดำเนินการ |

**ค่าสถานะ IT:** `ดำเนินการแล้ว` / `ยังไม่ดำเนินการ` / `null` (ไม่พบบัญชี)

### User
| Field | ประเภท | คำอธิบาย |
|---|---|---|
| email | String (unique) | อีเมลสำหรับ login |
| password | String | bcrypt hash |
| role | Enum | SUPER_ADMIN / ADMIN / VIEWER |
| totpEnabled | Boolean | เปิด 2FA หรือไม่ |
| totpSecret | String | Base32 secret สำหรับ TOTP |
| backupCodes | Text | JSON array ของ bcrypt-hashed backup codes |
