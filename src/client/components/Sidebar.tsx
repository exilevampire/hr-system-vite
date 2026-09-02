import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: "📊" },
  { to: "/records/all", label: "ข้อมูลพนักงานที่พ้นสภาพ", icon: "📋" },
  { to: "/records/import", label: "นำเข้าข้อมูล", icon: "📥", roles: ["SUPER_ADMIN", "ADMIN"] },
  { to: "/records/update-it-status", label: "อัพเดตสถานะ IT", icon: "🔄", roles: ["SUPER_ADMIN"] },
  { to: "/records/add", label: "เพิ่มบุคคลพ้นสภาพ", icon: "➕", roles: ["SUPER_ADMIN", "ADMIN"] },
  { to: "/logs", label: "Audit Log", icon: "📝", roles: ["SUPER_ADMIN", "ADMIN"] },
  { to: "/settings", label: "จัดการผู้ใช้งาน", icon: "⚙️", roles: ["SUPER_ADMIN"] },
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
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
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

  const filtered = navItems.filter((item) => !item.roles || item.roles.includes(role));

  // Collapsing is a desktop affordance only — on mobile the drawer slides in at
  // full width, so every "hide this when collapsed" rule is md-scoped.
  const hideWhenCollapsed = collapsed ? "md:hidden" : "";

  function handleLogout() {
    logout();
    navigate("/login");
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
    </>
  );
}
