import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verify2FA } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA step
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [tempToken, setTempToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "otp") otpRef.current?.focus();
  }, [step, useBackup]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await login(email, password, rememberMe);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.requires2fa && result.tempToken) {
      setTempToken(result.tempToken);
      setStep("otp");
    } else {
      navigate("/dashboard");
    }
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
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img src="/logo.png" alt="สภากาชาดไทย" className="h-48 object-contain drop-shadow-md" />
            </div>
            <h1 className="text-xl font-bold text-white">ระบบจัดเก็บและรายงานข้อมูลพ้นสภาพ</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {step === "credentials" ? (
              <>
                <h2 className="text-xl font-bold text-slate-800 mb-6">เข้าสู่ระบบ</h2>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="admin@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm text-slate-600">จดจำการเข้าสู่ระบบ</span>
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {loading && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl flex-shrink-0">
                    🔐
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">ยืนยันตัวตน 2 ขั้นตอน</h2>
                    <p className="text-xs text-slate-500">
                      {useBackup ? "กรอก Backup Code" : "กรอกรหัส 6 หลักจาก Authenticator App"}
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
                )}

                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  {useBackup ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Backup Code</label>
                      <input
                        ref={otpRef}
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.toUpperCase())}
                        placeholder="XXXX-XXXX"
                        maxLength={9}
                        className="w-full border border-slate-300 rounded-lg px-4 py-3 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">รหัส OTP</label>
                      <input
                        ref={otpRef}
                        type="text"
                        inputMode="numeric"
                        value={otpCode}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "");
                          setOtpCode(v);
                        }}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full border border-slate-300 rounded-lg px-4 py-3 text-center text-3xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otpCode.length < (useBackup ? 8 : 6)}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {loading && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {loading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setError(""); setOtpCode(""); setUseBackup(false); }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ← กลับ
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUseBackup(!useBackup); setOtpCode(""); setError(""); }}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {useBackup ? "ใช้ Authenticator App แทน" : "ใช้ Backup Code แทน"}
                  </button>
                </div>
              </>
            )}

            <p className="text-xs text-slate-400 text-center mt-6">
              ระบบสำหรับเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น
            </p>
          </div>
        </div>
      </div>

      <footer className="py-5 px-4 text-center">
        <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-xs text-blue-200">
          <span>สงวนลิขสิทธิ์ โดย สภากาชาดไทย</span>
          <span className="text-blue-400">|</span>
          <a href="https://www.redcross.or.th/trcs-pdpa" target="_blank" rel="noopener noreferrer" className="hover:text-white underline underline-offset-2">
            นโยบายการคุ้มครองข้อมูลส่วนบุคคล
          </a>
          <span className="text-blue-400">|</span>
          <a href="https://www.redcross.or.th/cookie-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline underline-offset-2">
            นโยบายคุกกี้
          </a>
          <span className="text-blue-400">|</span>
          <a href="https://www.redcross.or.th/terms-of-use" target="_blank" rel="noopener noreferrer" className="hover:text-white underline underline-offset-2">
            ข้อตกลงการใช้งาน
          </a>
          <span className="text-blue-400">|</span>
          <a href="https://redcross.or.th/trcs-privacy-safeguard" target="_blank" rel="noopener noreferrer" className="hover:text-white underline underline-offset-2">
            มาตรการรักษาความมั่นคงปลอดภัยข้อมูลส่วนบุคคล
          </a>
        </div>
      </footer>
    </div>
  );
}
