import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
import type { Permission } from "../lib/permissions";
import { APP_UPDATED_AT, APP_VERSION, RELEASE_NOTES } from "../lib/releaseNotes";

const navItems: { to: string; label: string; icon: string; permission?: Permission; roles?: string[] }[] = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: "📊", permission: "dashboard.view" },
  { to: "/records/all", label: "ข้อมูลพนักงานที่พ้นสภาพ", icon: "📋", permission: "employees.view" },
  { to: "/records/import", label: "นำเข้าข้อมูล", icon: "📥", permission: "employees.import" },
  { to: "/records/add", label: "เพิ่มบุคคลพ้นสภาพ", icon: "➕", permission: "employees.create" },
  { to: "/logs", label: "Audit Log", icon: "📝", permission: "audit_logs.view" },
  { to: "/settings", label: "จัดการผู้ใช้งาน", icon: "⚙️", roles: ["SUPER_ADMIN"] },
  { to: "/api-management", label: "จัดการ API", icon: "🔌", roles: ["SUPER_ADMIN"] },
  { to: "/records/trash", label: "ถังขยะข้อมูลพนักงาน", icon: "🗑️", roles: ["SUPER_ADMIN"] },
  { to: "/account", label: "บัญชีของฉัน / 2FA", icon: "🔐" },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [hasUnreadReleaseNotes, setHasUnreadReleaseNotes] = useState(
    () => localStorage.getItem("releaseNotesSeenVersion") !== APP_VERSION
  );
  const role = user?.role ?? "VIEWER";

  const initials = (() => {
    const name = user?.name ?? user?.email ?? "";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return name.slice(0, 2);
  })();

  const avatarColor =
    role === "SUPER_ADMIN" ? "bg-amber-400 text-amber-900" :
    role === "ADMIN"       ? "bg-blue-400 text-blue-900"   :
                             "bg-slate-400 text-slate-900";

  const filtered = navItems.filter((item) =>
    (!item.roles || item.roles.includes(role)) && (!item.permission || hasPermission(item.permission))
  );

  // Collapsing is a desktop affordance only — on mobile the drawer slides in at
  // full width, so every "hide this when collapsed" rule is md-scoped.
  const hideWhenCollapsed = collapsed ? "md:hidden" : "";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function openReleaseNotes() {
    setShowReleaseNotes(true);
    setHasUnreadReleaseNotes(false);
    localStorage.setItem("releaseNotesSeenVersion", APP_VERSION);
  }

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-blue-700 text-white rounded-lg shadow-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full bg-blue-900 text-white flex flex-col z-40 transition-all duration-300
          w-64 ${collapsed ? "md:w-16" : "md:w-64"}
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <button
          onClick={onToggleCollapsed}
          title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          className="hidden md:flex absolute -right-3 top-6 z-50 h-6 w-6 items-center justify-center
            rounded-full bg-blue-700 hover:bg-blue-600 text-white text-xs leading-none
            shadow-md ring-2 ring-slate-50 transition-colors"
        >
          {collapsed ? "›" : "‹"}
        </button>

        <div
          className={`py-5 border-b border-blue-700 flex items-center gap-3 px-6
            ${collapsed ? "md:px-0 md:justify-center" : ""}`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${avatarColor}`}>
            {initials}
          </div>
          <div className={`min-w-0 ${hideWhenCollapsed}`}>
            <div className="text-sm font-semibold leading-snug truncate">{user?.name ?? user?.email}</div>
            <div className="text-xs text-blue-300 leading-tight">{role.replace("_", " ")}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {filtered.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 py-3 text-sm font-medium transition-colors px-6
                  ${collapsed ? "md:px-0 md:justify-center md:gap-0" : ""}
                  ${active ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-800"}`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className={`truncate ${hideWhenCollapsed}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`py-4 border-t border-blue-700 px-6 ${collapsed ? "md:px-2" : ""}`}>
          <button
            type="button"
            onClick={openReleaseNotes}
            title={collapsed ? `มีอะไรใหม่ใน v${APP_VERSION}` : undefined}
            className={`mb-3 w-full rounded-lg border border-blue-700 bg-blue-950/30 px-3 py-2 text-left transition-colors hover:bg-blue-800 ${collapsed ? "md:px-0 md:text-center" : ""}`}
          >
            <span className={collapsed ? "hidden md:inline" : "hidden"}>✨</span>
            <span className={hideWhenCollapsed}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">HR System v{APP_VERSION}</span>
                {hasUnreadReleaseNotes && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">ใหม่</span>}
              </span>
              <span className="mt-0.5 block text-[11px] text-blue-300">มีอะไรใหม่ · {APP_UPDATED_AT}</span>
            </span>
          </button>
          <div className={hideWhenCollapsed}>
            <div className="text-xs text-blue-300 mb-1 truncate">{user?.email}</div>
            <div className="text-xs text-blue-400 mb-3 capitalize">{role.replace("_", " ")}</div>
          </div>
          <button
            onClick={handleLogout}
            title={collapsed ? "ออกจากระบบ" : undefined}
            className={`w-full text-sm text-blue-200 hover:text-white bg-blue-800 hover:bg-blue-700
              rounded py-2 transition-colors px-3 ${collapsed ? "md:px-0" : ""}`}
          >
            <span className={hideWhenCollapsed}>ออกจากระบบ</span>
            <span className={collapsed ? "hidden md:inline" : "hidden"}>⏻</span>
          </button>
        </div>
      </aside>
      {showReleaseNotes && <ReleaseNotesModal onClose={() => setShowReleaseNotes(false)} />}
    </>
  );
}

function ReleaseNotesModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toneClasses = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      role="presentation"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="release-notes-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">✨ อัปเดตล่าสุด</div>
            <h2 id="release-notes-title" className="text-xl font-bold text-slate-800">มีอะไรใหม่ใน HR System</h2>
            <p className="mt-1 text-sm text-slate-500">สรุปฟังก์ชันและการแก้ไขในแต่ละเวอร์ชัน</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">×</button>
        </div>

        <div className="space-y-6 p-6">
          {RELEASE_NOTES.map((release) => (
            <section key={release.version}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-bold text-white">v{release.version}</span>
                <span className="text-sm text-slate-500">{release.date}</span>
              </div>
              <div className="space-y-4">
                {release.sections.map((section) => (
                  <div key={section.title}>
                    <h3 className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${toneClasses[section.tone]}`}>{section.title}</h3>
                    <ul className="space-y-2">
                      {section.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">รับทราบ</button>
        </div>
      </div>
    </div>
  );
}
