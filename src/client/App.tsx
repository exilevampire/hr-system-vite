import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AllRecordsPage from "./pages/records/AllRecordsPage";
import AddRecordPage from "./pages/records/AddRecordPage";
import EditRecordPage from "./pages/records/EditRecordPage";
import ImportPage from "./pages/records/ImportPage";
import LogsPage from "./pages/LogsPage";
import SettingsPage from "./pages/SettingsPage";
import AccountPage from "./pages/AccountPage";

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

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/records/all" element={<ProtectedRoute><AllRecordsPage /></ProtectedRoute>} />
      <Route path="/records/add" element={<ProtectedRoute><AddRecordPage /></ProtectedRoute>} />
      <Route path="/records/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
      <Route path="/records/:employeeId/edit" element={<ProtectedRoute><EditRecordPage /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
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
