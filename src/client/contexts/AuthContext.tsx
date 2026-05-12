import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  name?: string | null;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ error?: string; requires2fa?: boolean; tempToken?: string }>;
  verify2FA: (tempToken: string, code: string, rememberMe?: boolean) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token") ?? sessionStorage.getItem("token")
  );
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (t: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
      }
    } catch {
      setToken(null);
      setUser(null);
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, [token, fetchMe]);

  function saveToken(t: string, rememberMe: boolean) {
    if (rememberMe) {
      localStorage.setItem("token", t);
      sessionStorage.removeItem("token");
    } else {
      sessionStorage.setItem("token", t);
      localStorage.removeItem("token");
    }
  }

  async function login(email: string, password: string, rememberMe = false): Promise<{ error?: string; requires2fa?: boolean; tempToken?: string }> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) return { error: data.error ?? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

    if (data.requires2fa) {
      return { requires2fa: true, tempToken: data.tempToken };
    }

    saveToken(data.token, rememberMe);
    setToken(data.token);
    setUser(data.user);
    return {};
  }

  async function verify2FA(tempToken: string, code: string, rememberMe = false): Promise<{ error?: string }> {
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempToken, code }),
    });

    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "รหัสไม่ถูกต้อง" };

    saveToken(data.token, rememberMe);
    setToken(data.token);
    setUser(data.user);
    return {};
  }

  function logout() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, verify2FA, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
