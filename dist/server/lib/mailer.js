"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendImportNotification = sendImportNotification;
exports.sendRetireNotification = sendRetireNotification;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
async function sendImportNotification(recipients, summary) {
    if (recipients.length === 0)
        return;
    const { inserted, updated, unchanged, errors, sourceName, importedBy, appUrl } = summary;
    const total = inserted + updated + unchanged;
    const html = `
<div style="font-family:Sarabun,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
  <div style="background:#1e40af;padding:20px 24px;">
    <h2 style="color:#fff;margin:0;font-size:18px;">📋 แจ้งเตือน: นำเข้าข้อมูลพนักงานพ้นสภาพ</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#374151;margin:0 0 16px;">มีการนำเข้าข้อมูลพนักงานพ้นสภาพใหม่เข้าสู่ระบบเรียบร้อยแล้ว</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr style="background:#f8fafc;">
        <td style="padding:10px 12px;color:#6b7280;border:1px solid #e2e8f0;">ต้นทางข้อมูล</td>
        <td style="padding:10px 12px;font-weight:600;color:#1e293b;border:1px solid #e2e8f0;">${sourceName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#6b7280;border:1px solid #e2e8f0;">รายการทั้งหมด</td>
        <td style="padding:10px 12px;font-weight:600;color:#1e293b;border:1px solid #e2e8f0;">${total.toLocaleString()} รายการ</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 12px;color:#6b7280;border:1px solid #e2e8f0;">เพิ่มใหม่</td>
        <td style="padding:10px 12px;font-weight:600;color:#15803d;border:1px solid #e2e8f0;">${inserted.toLocaleString()} รายการ</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#6b7280;border:1px solid #e2e8f0;">อัพเดตข้อมูล</td>
        <td style="padding:10px 12px;font-weight:600;color:#1d4ed8;border:1px solid #e2e8f0;">${updated.toLocaleString()} รายการ</td>
      </tr>
      ${errors > 0 ? `
      <tr style="background:#fef2f2;">
        <td style="padding:10px 12px;color:#6b7280;border:1px solid #e2e8f0;">มีข้อผิดพลาด</td>
        <td style="padding:10px 12px;font-weight:600;color:#dc2626;border:1px solid #e2e8f0;">${errors.toLocaleString()} รายการ</td>
      </tr>` : ""}
      <tr style="background:#f8fafc;">
        <td style="padding:10px 12px;color:#6b7280;border:1px solid #e2e8f0;">ดำเนินการโดย</td>
        <td style="padding:10px 12px;font-weight:600;color:#1e293b;border:1px solid #e2e8f0;">${importedBy}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#6b7280;border:1px solid #e2e8f0;">วันที่/เวลา</td>
        <td style="padding:10px 12px;font-weight:600;color:#1e293b;border:1px solid #e2e8f0;">${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</td>
      </tr>
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${appUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">ดูข้อมูลในระบบ</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">อีเมล์นี้ส่งอัตโนมัติจากระบบข้อมูลพนักงานพ้นสภาพ — กรุณาอย่าตอบกลับ</p>
  </div>
</div>`;
    await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: recipients.join(", "),
        subject: `[RedCrossRetire] มีการนำเข้าข้อมูล (${inserted + updated} รายการ)`,
        html,
    });
}
async function sendRetireNotification(recipients, employees, appUrl) {
    if (recipients.length === 0 || employees.length === 0)
        return;
    const dateStr = new Date().toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const rows = employees
        .map((e) => `
      <tr>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#1e293b;">${e.nameTh}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${e.position ?? "-"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${e.bureau ?? "-"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${e.department ?? "-"}</td>
      </tr>`)
        .join("");
    const html = `
<div style="font-family:Sarabun,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
  <div style="background:#1e40af;padding:20px 24px;">
    <h2 style="color:#fff;margin:0;font-size:18px;">📋 แจ้งเตือน: พนักงานพ้นสภาพประจำวันที่ ${dateStr}</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#374151;margin:0 0 16px;">มีพนักงานพ้นสภาพในวันนี้จำนวน <strong>${employees.length} ราย</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;color:#475569;font-weight:600;">ชื่อ-สกุล</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;color:#475569;font-weight:600;">ตำแหน่ง</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;color:#475569;font-weight:600;">หน่วยงาน/สำนัก</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;color:#475569;font-weight:600;">ฝ่าย/กลุ่มงาน</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${appUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">ดูข้อมูลในระบบ</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">อีเมล์นี้ส่งอัตโนมัติจากระบบข้อมูลพนักงานพ้นสภาพ — กรุณาอย่าตอบกลับ</p>
  </div>
</div>`;
    await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: recipients.join(", "),
        subject: `[RedCrossRetire] พนักงานพ้นสภาพประจำวัน (${employees.length} ราย)`,
        html,
    });
}
