# ระบบจัดเก็บและรายงานข้อมูลพ้นสภาพของบุคคล

ระบบบริหารจัดการข้อมูลพนักงานที่พ้นสภาพ พัฒนาด้วย React + Vite (Frontend) และ Express + Prisma (Backend) รวมอยู่ในโปรเจกต์เดียว

---

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS
- **Backend:** Express.js, Prisma ORM
- **Database:** MariaDB / MySQL
- **Language:** TypeScript

---

## ความต้องการของระบบ

- Node.js >= 18
- MariaDB >= 10.6 หรือ MySQL >= 8.0
- npm >= 9

---

## 1. สร้าง Database

### เปิด MariaDB / MySQL แล้วรันคำสั่งนี้

```sql
CREATE DATABASE hr_integrity_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### สร้าง User สำหรับระบบ (แนะนำ ไม่ใช้ root)

```sql
CREATE USER 'hruser'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON hr_integrity_db.* TO 'hruser'@'localhost';
FLUSH PRIVILEGES;
```

---

## 2. ติดตั้งโปรเจกต์

```bash
# Clone repository
git clone https://git.redcross.or.th/pornpetch.n/hr-system.git
cd hr-system

# ติดตั้ง dependencies (จะ run prisma generate อัตโนมัติ)
npm install
```

---

## 3. ตั้งค่า Environment

```bash
# Copy ไฟล์ตัวอย่าง
copy .env.example .env
```

แก้ไขไฟล์ `.env` ให้ตรงกับระบบ:

```env
DATABASE_URL="mysql://hruser:your_password@localhost:3306/hr_integrity_db"
JWT_SECRET="เปลี่ยนเป็นค่าสุ่มที่ยาวและปลอดภัย"
PORT=3001
NODE_ENV=development
```

---

## 4. สร้างตาราง Database

```bash
# สร้างตารางทั้งหมดตาม schema
npm run db:push
```

---

## 5. Seed ข้อมูลเริ่มต้น (Admin Users)

```bash
npm run db:seed
```

จะสร้าง User ทดสอบ 3 คน:

| Email | Password | Role |
|-------|----------|------|
| superadmin@hr.local | admin1234 | Super Admin |
| hradmin@hr.local | admin1234 | HR Admin |
| viewer@hr.local | admin1234 | Viewer |

> **⚠️ ควรเปลี่ยนรหัสผ่านหลัง deploy จริง**

---

## 6. รันระบบ

### Development (รัน Vite + Express พร้อมกัน)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

### Production

```bash
# Build
npm run build

# Start server (serve ทั้ง frontend และ API บน port เดียว)
NODE_ENV=production npm start
```

- เปิด http://localhost:3001

---

## สิทธิ์การใช้งาน (Roles)

| Role | สิทธิ์ |
|------|--------|
| **Super Admin** | เข้าถึงทุกฟังก์ชัน, ลบข้อมูล, จัดการ User |
| **HR Admin** | เพิ่ม/แก้ไขข้อมูล, นำเข้า Excel, ดู Log |
| **Viewer** | ดูข้อมูลและค้นหาเท่านั้น |

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev          # รัน development server
npm run build        # build สำหรับ production
npm start            # รัน production server
npm run db:push      # sync schema กับ database
npm run db:seed      # สร้าง user เริ่มต้น
npm run db:studio    # เปิด Prisma Studio (GUI database)
npm run db:migrate   # สร้าง migration file
```

---

## โครงสร้างโปรเจกต์

```
hr-system/
├── src/
│   ├── server/          # Express API
│   │   ├── lib/         # Prisma client, Audit log
│   │   ├── middleware/  # JWT Auth
│   │   └── routes/      # API routes
│   └── client/          # React Frontend
│       ├── components/
│       ├── contexts/
│       └── pages/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data
├── public/              # Static files (Excel templates)
├── .env.example         # ตัวอย่าง environment variables
└── package.json
```
