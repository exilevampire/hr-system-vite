import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import { RedCrossIcon } from "./RedCrossIcon";

const navItems = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: "📊" },
  { to: "/records/all", label: "ข้อมูลผู้พ้นสภาพ", icon: "📋" },
  { to: "/records/add", label: "เพิ่มข้อมูล", icon: "➕", roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { to: "/records/import", label: "นำเข้า Excel", icon: "📥", roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { to: "/logs", label: "Audit Log", icon: "📝", roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { to: "/settings", label: "จัดการผู้ใช้งาน", icon: "⚙️", roles: ["SUPER_ADMIN"] },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const role = user?.role ?? "VIEWER";

  const filtered = navItems.filter((item) => !item.roles || item.roles.includes(role));

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
        className={`fixed top-0 left-0 h-full w-64 bg-blue-900 text-white flex flex-col z-40 transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="px-6 py-5 border-b border-blue-700 flex items-center gap-3">
          <div className="bg-white rounded-lg p-1 flex-shrink-0">
            <RedCrossIcon size={36} />
          </div>
          <div>
            <div className="text-xs font-bold text-blue-200 uppercase tracking-wider leading-tight">ระบบจัดเก็บและรายงาน</div>
            <div className="text-sm font-bold leading-snug">ข้อมูลพ้นสภาพ</div>
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
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors
                  ${active ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-800"}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-blue-700">
          <div className="text-xs text-blue-300 mb-1">{user?.email}</div>
          <div className="text-xs text-blue-400 mb-3 capitalize">{role.replace("_", " ")}</div>
          <button
            onClick={handleLogout}
            className="w-full text-sm text-blue-200 hover:text-white bg-blue-800 hover:bg-blue-700 rounded px-3 py-2 transition-colors"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  );
}
