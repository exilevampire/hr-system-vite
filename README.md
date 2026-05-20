# ระบบจัดเก็บและรายงานข้อมูลพ้นสภาพของบุคคล

ระบบบริหารจัดการข้อมูลพนักงานที่พ้นสภาพ พัฒนาสำหรับ **สำนักงานเทคโนโลยีสารสนเทศและดิจิทัล สภากาชาดไทย**  
ด้วย React + Vite (Frontend) และ Express + Prisma (Backend) รวมอยู่ในโปรเจกต์เดียว (Monorepo)

---

## ฟีเจอร์หลัก

- จัดการข้อมูลพนักงานที่พ้นสภาพ (เพิ่ม / แก้ไข / ลบ / ค้นหา)
- นำเข้าข้อมูลจาก Excel (.xlsx) และ Export รายงาน
- ติดตามสถานะการปิดสิทธิ์ระบบ IT (FMIS, eMeeting, Website, 3CX, Intranet)
- Dashboard สรุปสถิติ
- ระบบ Login พร้อม 2-Factor Authentication (TOTP)
- บันทึก Audit Log การเปลี่ยนแปลงข้อมูล
- จัดการ User และสิทธิ์การใช้งาน 3 ระดับ
- รองรับ Remember Me และ Session-based auth

---

## Tech Stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| **Frontend** | React 19, Vite 6, Tailwind CSS v4, React Router 7 |
| **Backend** | Express.js 4, Prisma ORM 7 |
| **Database** | MariaDB 10.6+ / MySQL 8.0+ |
| **Auth** | JWT, bcryptjs, TOTP (speakeasy) |
| **Language** | TypeScript 5 |

---

## ความต้องการของระบบ (Server Requirements)

| รายการ | เวอร์ชันขั้นต่ำ |
|--------|---------------|
| Node.js | **20 LTS** ขึ้นไป |
| npm | 10 ขึ้นไป |
| MariaDB | 10.6+ |
| RAM | 512 MB ขึ้นไป |
| OS | Linux / Windows Server |

---

## 1. สร้าง Database

```sql
CREATE DATABASE hr_integrity_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

สร้าง User สำหรับระบบ (แนะนำ — ไม่ควรใช้ root):

```sql
CREATE USER 'hruser'@'localhost' IDENTIFIED BY 'รหัสผ่านที่แข็งแกร่ง';
GRANT ALL PRIVILEGES ON hr_integrity_db.* TO 'hruser'@'localhost';
FLUSH PRIVILEGES;
```

---

## 2. ติดตั้งโปรเจกต์

```bash
git clone https://git.redcross.or.th/pornpetch.n/hr-system.git
cd hr-system
npm install
```

> `npm install` จะรัน `prisma generate` อัตโนมัติผ่าน postinstall hook

---

## 3. ตั้งค่า Environment

```bash
# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env
```

แก้ไขไฟล์ `.env`:

```env
DATABASE_URL="mysql://hruser:รหัสผ่าน@localhost:3306/hr_integrity_db"
JWT_SECRET="สุ่มค่าแบบนี้: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
PORT=3001
NODE_ENV=production
```

> **⚠️ สำคัญ:**
> - ต้องตั้ง `NODE_ENV=production` บน production server เสมอ
> - `JWT_SECRET` ต้องสุ่มใหม่ทุก environment — ห้ามใช้ค่าเดียวกับ dev
> - ห้าม commit ไฟล์ `.env` ขึ้น Git เด็ดขาด

---

## 4. สร้างตาราง Database

```bash
npx prisma db push
```

---

## 5. Seed ข้อมูลเริ่มต้น (ครั้งแรกเท่านั้น)

```bash
npm run db:seed
```

บัญชีที่ได้หลัง seed:

| Email | Password เริ่มต้น | Role |
|-------|----------|------|
| superadmin@hr.local | admin1234 | Super Admin |
| hradmin@hr.local | admin1234 | HR Admin |
| viewer@hr.local | admin1234 | Viewer |

> **⚠️ เปลี่ยนรหัสผ่านทันทีหลัง deploy**

---

## 6. Build และ Deploy

```bash
# Build frontend + backend
npm run build

# รัน production server
NODE_ENV=production node dist/server/index.js
```

เปิดใช้งานที่ `http://localhost:3001` (serve ทั้ง API และ Frontend จาก port เดียว)

---

## 7. ตั้งค่า PM2 (แนะนำ — ให้รันค้างไว้)

```bash
npm install -g pm2

pm2 start dist/server/index.js --name "hr-system"

# ให้รันอัตโนมัติเมื่อ server reboot
pm2 startup
pm2 save
```

คำสั่ง PM2 ที่ใช้บ่อย:

```bash
pm2 status          # ดูสถานะ
pm2 logs hr-system  # ดู log
pm2 restart hr-system
pm2 stop hr-system
```

---

## 8. ตั้งค่า Nginx (ถ้าต้องการใช้ domain / HTTPS)

```nginx
server {
    listen 80;
    server_name hr.example.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    client_max_body_size 10M;
}
```

---

## สิทธิ์การใช้งาน (Roles)

| Role | สิทธิ์ |
|------|--------|
| **Super Admin** | เข้าถึงทุกฟังก์ชัน, ลบข้อมูล, จัดการ User |
| **HR Admin** | เพิ่ม/แก้ไขข้อมูล, นำเข้า Excel, ดู Audit Log |
| **Viewer** | ดูข้อมูลและค้นหาเท่านั้น |

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev          # รัน development server (Vite + Express)
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
│   ├── server/              # Express API
│   │   ├── lib/             # Prisma client, Audit log, TOTP
│   │   ├── middleware/      # JWT Auth middleware
│   │   └── routes/          # auth, employees, dashboard, reports...
│   └── client/              # React Frontend
│       ├── components/      # AppLayout, shared components
│       ├── contexts/        # AuthContext
│       ├── lib/             # API fetch utility
│       └── pages/           # Login, Dashboard, Records, Users...
├── prisma/
│   ├── schema.prisma        # Database schema (Employee, User, AuditLog)
│   └── seed.ts              # Seed data (default users)
├── public/                  # Static files (logo, Excel templates)
├── dist/                    # Build output (generated — ไม่อยู่ใน Git)
│   ├── client/              # Built React app
│   └── server/              # Compiled Express JS
├── .env.example             # ตัวอย่าง environment variables
├── tsconfig.json            # TypeScript config (frontend)
├── tsconfig.server.json     # TypeScript config (backend)
└── package.json
```

---

## Security Checklist ก่อน Deploy

- [ ] ตั้ง `NODE_ENV=production` ในไฟล์ `.env`
- [ ] สุ่ม `JWT_SECRET` ใหม่ด้วย `crypto.randomBytes(48)`
- [ ] เปลี่ยนรหัสผ่าน default users ทั้งหมดหลัง seed
- [ ] ไม่ใช้ user `root` สำหรับ database connection
- [ ] ตั้งค่า Firewall ให้เปิดเฉพาะ port ที่จำเป็น
- [ ] ตั้งค่า HTTPS ผ่าน Nginx + Let's Encrypt (ถ้ามี domain)
