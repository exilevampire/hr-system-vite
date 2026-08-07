import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface ImportSummary {
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  sourceName: string;
  importedBy: string;
  appUrl: string;
}

export async function sendImportNotification(
  recipients: string[],
  summary: ImportSummary
): Promise<void> {
  if (recipients.length === 0) return;

  const { inserted, updated, unchanged, errors, sourceName, importedBy, appUrl } = summary;
  const total = inserted + updated + unchanged;

  const html = `
<div style="font-family:Sarabun,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
  <div style="background:#1e40af;padding:20px 24px;">
    <h2 style="color:#fff;margin:0;font-size:18px;">📋 แจ้งเตือน: นำเข้าข้อมูลพนักงานพ้นสภาพ</h2>
  </div>
  <div style="padding:24px;">
    <p style="color:#374151;margin:0 0 16px;">มีการนำเข้าข้อมูลใหม่เข้าสู่ระบบเรียบร้อยแล้ว</p>
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
