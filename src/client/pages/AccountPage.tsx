import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type SetupPhase = "idle" | "qr" | "verify" | "done";

export default function AccountPage() {
  const { user } = useAuth();

  // 2FA status
  const [enabled, setEnabled] = useState(false);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);
  const [statusLoading, setStatusLoading] = useState(true);

  // Setup flow
  const [phase, setPhase] = useState<SetupPhase>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Disable flow
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchStatus() {
    setStatusLoading(true);
    const res = await apiFetch("/api/auth/2fa/status");
    if (res.ok) {
      const d = await res.json();
      setEnabled(d.enabled);
      setBackupCodesRemaining(d.backupCodesRemaining);
    }
    setStatusLoading(false);
  }

  useEffect(() => { fetchStatus(); }, []);

  async function handleSetup() {
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/auth/2fa/setup", { method: "POST" });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error); return; }
    setQrDataUrl(d.qrDataUrl);
    setSecret(d.secret);
    setPhase("qr");
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    if (verifyCode.length !== 6) return;
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code: verifyCode }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error); setVerifyCode(""); return; }
    setBackupCodes(d.backupCodes);
    setPhase("done");
    setEnabled(true);
    setBackupCodesRemaining(10);
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    if (!disableCode.trim()) return;
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ code: disableCode.trim() }),
    });
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error); return; }
    setEnabled(false);
    setBackupCodesRemaining(0);
    setShowDisable(false);
    setDisableCode("");
  }

  function handleCopyAll() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFinish() {
    setPhase("idle");
    setVerifyCode("");
    setQrDataUrl("");
    setSecret("");
    setBackupCodes([]);
    fetchStatus();
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">บัญชีของฉัน</h1>
          <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
        </div>

        {/* 2FA Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="font-semibold text-slate-800 text-lg">การยืนยันตัวตน 2 ขั้นตอน (2FA)</h2>
              <p className="text-slate-500 text-sm mt-0.5">เพิ่มความปลอดภัยด้วย TOTP Authenticator App</p>
            </div>
            {!statusLoading && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {enabled ? "เปิดใช้งาน" : "ปิดอยู่"}
              </span>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* ── Idle / status ── */}
          {phase === "idle" && !showDisable && (
            <div className="mt-5">
              {enabled ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-lg">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-sm font-medium text-green-800">2FA เปิดใช้งานแล้ว</p>
                      <p className="text-xs text-green-600 mt-0.5">Backup codes เหลืออยู่: {backupCodesRemaining} รหัส</p>
                    </div>
                  </div>
                  {backupCodesRemaining <= 3 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      ⚠️ Backup codes ใกล้หมดแล้ว กรุณาปิด-เปิด 2FA ใหม่เพื่อสร้าง codes ชุดใหม่
                    </div>
                  )}
                  <button
                    onClick={() => { setShowDisable(true); setError(""); }}
                    className="px-4 py-2 text-sm border border-red-300 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    ปิดใช้งาน 2FA
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 space-y-1">
                    <p className="font-medium text-slate-700">วิธีการตั้งค่า:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>ติดตั้ง <strong>Google Authenticator</strong> หรือ <strong>Authy</strong> บนมือถือ</li>
                      <li>กดปุ่ม "เริ่มตั้งค่า" แล้วสแกน QR Code</li>
                      <li>กรอกรหัส 6 หลักจาก App เพื่อยืนยัน</li>
                      <li>บันทึก Backup Codes ไว้ในที่ปลอดภัย</li>
                    </ol>
                  </div>
                  <button
                    onClick={handleSetup}
                    disabled={loading}
                    className="px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
                  >
                    {loading ? "กำลังโหลด..." : "เริ่มตั้งค่า 2FA"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Disable confirm ── */}
          {showDisable && (
            <form onSubmit={handleDisable} className="mt-5 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                การปิด 2FA จะลบ Backup Codes ทั้งหมดออกด้วย กรุณากรอกรหัสเพื่อยืนยัน
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  รหัส OTP จาก App หรือ Backup Code
                </label>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="รหัส 6 หลัก หรือ XXXX-XXXX"
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowDisable(false); setDisableCode(""); setError(""); }}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading || !disableCode.trim()}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg transition-colors">
                  {loading ? "กำลังดำเนินการ..." : "ยืนยันการปิด 2FA"}
                </button>
              </div>
            </form>
          )}

          {/* ── QR Code phase ── */}
          {phase === "qr" && (
            <div className="mt-5 space-y-5">
              <p className="text-sm text-slate-600">สแกน QR Code ด้านล่างด้วย Authenticator App ของคุณ</p>
              <div className="flex justify-center">
                <div className="p-3 bg-white border-2 border-slate-200 rounded-xl inline-block">
                  <img src={qrDataUrl} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">หรือกรอก Secret Key ด้วยมือ:</p>
                <p className="text-sm font-mono font-bold text-slate-700 tracking-widest select-all break-all">{secret}</p>
              </div>
              <button
                onClick={() => { setPhase("verify"); setError(""); }}
                className="w-full px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                สแกนแล้ว → กรอกรหัสยืนยัน
              </button>
            </div>
          )}

          {/* ── Verify OTP phase ── */}
          {phase === "verify" && (
            <form onSubmit={handleEnable} className="mt-5 space-y-4">
              <p className="text-sm text-slate-600">กรอกรหัส 6 หลักจาก Authenticator App เพื่อยืนยัน</p>
              <input
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-center text-3xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => { setPhase("qr"); setError(""); }}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                  ← กลับ
                </button>
                <button type="submit" disabled={loading || verifyCode.length !== 6}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors">
                  {loading ? "กำลังยืนยัน..." : "ยืนยันและเปิดใช้งาน"}
                </button>
              </div>
            </form>
          )}

          {/* ── Done: show backup codes ── */}
          {phase === "done" && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">เปิดใช้งาน 2FA สำเร็จ!</p>
                  <p className="text-xs text-green-600">บันทึก Backup Codes ไว้ในที่ปลอดภัย</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">Backup Codes (10 รหัส)</p>
                  <button
                    onClick={handleCopyAll}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {copied ? "✓ คัดลอกแล้ว" : "คัดลอกทั้งหมด"}
                  </button>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="text-green-400 font-mono text-sm tracking-widest text-center py-1">
                      {code}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  แต่ละรหัสใช้ได้ครั้งเดียว หากโทรศัพท์หายให้ใช้รหัสเหล่านี้เข้าสู่ระบบแทน
                </p>
              </div>

              <button
                onClick={handleFinish}
                className="w-full px-4 py-2.5 text-sm bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
              >
                รับทราบ ปิดหน้านี้
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
