import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";

const COLLAPSE_KEY = "sidebarCollapsed";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Desktop-only: the sidebar shrinks to an icon rail. Kept here rather than in
  // Sidebar because the main column's left margin has to move with it.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // private browsing or blocked storage — the choice just won't persist
    }
  }, [collapsed]);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-blue-600 text-lg animate-pulse">กำลังโหลด...</div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      <main
        className={`flex-1 overflow-y-auto bg-slate-50 transition-[margin] duration-300
          ${collapsed ? "md:ml-16" : "md:ml-64"}`}
      >
        <div className="p-4 md:p-8 pt-16 md:pt-8">{children}</div>
      </main>
    </div>
  );
}
