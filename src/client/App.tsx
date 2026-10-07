import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AllRecordsPage from "./pages/records/AllRecordsPage";
import AddRecordPage from "./pages/records/AddRecordPage";
import ImportPage from "./pages/records/ImportPage";
import LogsPage from "./pages/LogsPage";
import SettingsPage from "./pages/SettingsPage";
import AccountPage from "./pages/AccountPage";
import ApiManagementPage from "./pages/ApiManagementPage";
import type { Permission } from "./lib/permissions";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-blue-600 text-lg animate-pulse">กำลังโหลด...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="text-blue-600 text-lg animate-pulse">กำลังโหลด...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (hasPermission("dashboard.view")) return <Navigate to="/dashboard" replace />;
  if (hasPermission("employees.view")) return <Navigate to="/records/all" replace />;
  if (hasPermission("employees.import")) return <Navigate to="/records/import" replace />;
  if (hasPermission("employees.create")) return <Navigate to="/records/add" replace />;
  if (hasPermission("audit_logs.view")) return <Navigate to="/logs" replace />;
  return <Navigate to="/account" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/dashboard" element={<PermissionRoute permission="dashboard.view"><DashboardPage /></PermissionRoute>} />
      <Route path="/records/all" element={<PermissionRoute permission="employees.view"><AllRecordsPage /></PermissionRoute>} />
      <Route path="/records/add" element={<PermissionRoute permission="employees.create"><AddRecordPage /></PermissionRoute>} />
      <Route path="/records/import" element={<PermissionRoute permission="employees.import"><ImportPage /></PermissionRoute>} />
      <Route path="/logs" element={<PermissionRoute permission="audit_logs.view"><LogsPage /></PermissionRoute>} />
      <Route path="/settings" element={user?.role === "SUPER_ADMIN" ? <ProtectedRoute><SettingsPage /></ProtectedRoute> : <Navigate to="/" replace />} />
      <Route path="/api-management" element={user?.role === "SUPER_ADMIN" ? <ProtectedRoute><ApiManagementPage /></ProtectedRoute> : <Navigate to="/" replace />} />
      <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
