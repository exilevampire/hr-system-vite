import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import type { Permission } from "./lib/permissions";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AllRecordsPage = lazy(() => import("./pages/records/AllRecordsPage"));
const AddRecordPage = lazy(() => import("./pages/records/AddRecordPage"));
const ImportPage = lazy(() => import("./pages/records/ImportPage"));
const LogsPage = lazy(() => import("./pages/LogsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const ApiManagementPage = lazy(() => import("./pages/ApiManagementPage"));
const TrashPage = lazy(() => import("./pages/records/TrashPage"));
const ReferenceDataPage = lazy(() => import("./pages/ReferenceDataPage"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-lg text-blue-600 animate-pulse">กำลังโหลด...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "SUPER_ADMIN") return <Navigate to="/" replace />;
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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<PermissionRoute permission="dashboard.view"><DashboardPage /></PermissionRoute>} />
        <Route path="/records/all" element={<PermissionRoute permission="employees.view"><AllRecordsPage /></PermissionRoute>} />
        <Route path="/records/add" element={<PermissionRoute permission="employees.create"><AddRecordPage /></PermissionRoute>} />
        <Route path="/records/import" element={<PermissionRoute permission="employees.import"><ImportPage /></PermissionRoute>} />
        <Route path="/logs" element={<PermissionRoute permission="audit_logs.view"><LogsPage /></PermissionRoute>} />
        <Route path="/settings" element={<SuperAdminRoute><SettingsPage /></SuperAdminRoute>} />
        <Route path="/api-management" element={<SuperAdminRoute><ApiManagementPage /></SuperAdminRoute>} />
        <Route path="/records/trash" element={<SuperAdminRoute><TrashPage /></SuperAdminRoute>} />
        <Route path="/reference-data" element={<SuperAdminRoute><ReferenceDataPage /></SuperAdminRoute>} />
        <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      </Routes>
    </Suspense>
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
