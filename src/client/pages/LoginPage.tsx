import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type User } from "../contexts/AuthContext";

type LoginStep = "credentials" | "otp" | "setup" | "backup";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verify2FA, setupRequired2FA, enableRequired2FA, completeRequired2FA } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [tempToken, setTempToken] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [pendingSession, setPendingSession] = useState<{ token: string; user: User } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "otp" || step === "setup") otpRef.current?.focus();
  }, [step, useBackup]);

  async function beginRequiredSetup(token: string) {
    setLoading(true);
    const result = await setupRequired2FA(token);
    setLoading(false);
    if (result.error || !result.qrDataUrl || !result.secret) {
      setError(result.error ?? "ไม่สามารถเริ่มตั้งค่า 2FA ได้");
      setStep("credentials");
      return;
    }
    setSetupToken(token);
    setQrDataUrl(result.qrDataUrl);
    setSecret(result.secret);
    setStep("setup");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await login(identifier, password, rememberMe);
    setLoading(false);
    if (result.error) setError(result.error);
    else if (result.requires2fa && result.tempToken) {
      setTempToken(result.tempToken);
      setStep("otp");
    } else if (result.requires2faSetup && result.setupToken) {
      await beginRequiredSetup(result.setupToken);
    } else navigate("/");
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setLoading(true);
    setError("");
    const result = await verify2FA(tempToken, otpCode.trim(), rememberMe);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setOtpCode("");
    } else navigate("/");
  }

  async function handleEnableRequired(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    setLoading(true);
    setError("");
    const result = await enableRequired2FA(setupToken, otpCode);
    setLoading(false);
    if (result.error || !result.token || !result.user || !result.backupCodes) {
      setError(result.error ?? "ไม่สามารถเปิดใช้งาน 2FA ได้");
      setOtpCode("");
      return;
    }
    setPendingSession({ token: result.token, user: result.user });
    setBackupCodes(result.backupCodes);
    setStep("backup");
  }

  function finishSetup() {
    if (!pendingSession) return;
    completeRequired2FA(pendingSession.token, pendingSession.user, rememberMe);
    navigate("/");
  }

  function resetLogin() {
    setStep("credentials");
    setError("");
    setOtpCode("");
    setUseBackup(false);
    setTempToken("");
    setSetupToken("");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5"><img src="/logo.png" alt="สภากาชาดไทย" className="h-48 object-contain drop-shadow-md pt-3" /></div>
            <h1 className="text-xl font-bold text-white">ระบบจัดเก็บและรายงานข้อมูลพ้นสภาพ</h1>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {step === "credentials" && <>
              <h2 className="text-xl font-bold text-slate-800 mb-6">เข้าสู่ระบบ</h2>
              {error && <ErrorBox message={error} />}
              <form onSubmit={handleLogin} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Username หรือ Email</label><input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="username หรือ admin@example.com" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" /></div>
                <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-blue-600" /><span className="text-sm text-slate-600">จดจำการเข้าสู่ระบบ</span></label>
                <PrimaryButton loading={loading} label="เข้าสู่ระบบ" loadingLabel="กำลังตรวจสอบ..." />
              </form>
            </>}

            {step === "otp" && <>
              <StepHeader title="ยืนยันตัวตน 2 ขั้นตอน" subtitle={useBackup ? "กรอก Backup Code" : "กรอกรหัส 6 หลักจาก Authenticator App"} />
              {error && <ErrorBox message={error} />}
              <form onSubmit={handleVerifyOTP} className="space-y-4"><OtpInput inputRef={otpRef} value={otpCode} onChange={setOtpCode} backup={useBackup} /><PrimaryButton loading={loading} disabled={otpCode.length < (useBackup ? 8 : 6)} label="ยืนยัน" loadingLabel="กำลังตรวจสอบ..." /></form>
              <div className="mt-4 flex items-center justify-between text-xs"><button type="button" onClick={resetLogin} className="text-slate-400 hover:text-slate-600">← กลับ</button><button type="button" onClick={() => { setUseBackup(!useBackup); setOtpCode(""); setError(""); }} className="text-blue-500 hover:text-blue-700">{useBackup ? "ใช้ Authenticator App แทน" : "ใช้ Backup Code แทน"}</button></div>
            </>}

            {step === "setup" && <>
              <StepHeader title="จำเป็นต้องตั้งค่า 2FA" subtitle="ระบบกำหนดให้ทุกบัญชีเปิดใช้การยืนยันตัวตนสองขั้นตอน" />
              {error && <ErrorBox message={error} />}
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">สแกน QR Code ด้วย Google Authenticator, Microsoft Authenticator หรือแอป TOTP แล้วกรอกรหัส 6 หลัก คุณจะยังไม่สามารถเข้าระบบได้จนกว่าจะตั้งค่าสำเร็จ</div>
              <div className="flex justify-center mb-4"><div className="p-2 border-2 border-slate-200 rounded-xl"><img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44" /></div></div>
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500 mb-1">Secret Key สำหรับกรอกด้วยมือ</p><p className="font-mono text-sm font-bold tracking-wider break-all select-all">{secret}</p></div>
              <form onSubmit={handleEnableRequired} className="space-y-4"><OtpInput inputRef={otpRef} value={otpCode} onChange={setOtpCode} /><PrimaryButton loading={loading} disabled={otpCode.length !== 6} label="ยืนยันและเปิดใช้งาน 2FA" loadingLabel="กำลังยืนยัน..." /></form>
              <button type="button" onClick={resetLogin} className="mt-4 text-xs text-slate-400 hover:text-slate-600">← กลับไปหน้า Login</button>
            </>}

            {step === "backup" && <>
              <StepHeader title="เปิดใช้งาน 2FA สำเร็จ" subtitle="บันทึก Backup Codes ก่อนเข้าใช้งานระบบ" />
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 mb-4">แต่ละรหัสใช้ได้ครั้งเดียว สำหรับเข้าสู่ระบบเมื่อไม่สามารถใช้ Authenticator App ได้ ระบบจะไม่แสดงรหัสชุดนี้อีก</div>
              <div className="bg-slate-900 rounded-lg p-4 grid grid-cols-2 gap-2 mb-3">{backupCodes.map((code) => <code key={code} className="text-green-400 font-mono text-sm tracking-widest text-center py-1">{code}</code>)}</div>
              <button type="button" onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")); setCopied(true); }} className="w-full mb-3 px-4 py-2 text-sm border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg">{copied ? "✓ คัดลอกแล้ว" : "คัดลอก Backup Codes ทั้งหมด"}</button>
              <button type="button" onClick={finishSetup} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm">ฉันบันทึกรหัสแล้ว — เข้าใช้งานระบบ</button>
            </>}

            <p className="text-xs text-slate-400 text-center mt-6">ระบบสำหรับเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น</p>
          </div>
        </div>
      </div>
      <footer className="py-5 px-4 text-center text-xs text-blue-200">สงวนลิขสิทธิ์ โดย สภากาชาดไทย</footer>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">🔐</div><div><h2 className="text-lg font-bold text-slate-800">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div></div>;
}

function ErrorBox({ message }: { message: string }) {
  return <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{message}</div>;
}

function OtpInput({ inputRef, value, onChange, backup = false }: { inputRef: React.RefObject<HTMLInputElement | null>; value: string; onChange: (value: string) => void; backup?: boolean }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1">{backup ? "Backup Code" : "รหัส OTP"}</label><input ref={inputRef} type="text" inputMode={backup ? "text" : "numeric"} value={value} onChange={(e) => onChange(backup ? e.target.value.toUpperCase().slice(0, 9) : e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={backup ? "XXXX-XXXX" : "000000"} maxLength={backup ? 9 : 6} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.35em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>;
}

function PrimaryButton({ loading, disabled = false, label, loadingLabel }: { loading: boolean; disabled?: boolean; label: string; loadingLabel: string }) {
  return <button type="submit" disabled={loading || disabled} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm">{loading ? loadingLabel : label}</button>;
}
