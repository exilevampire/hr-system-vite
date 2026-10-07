import { AppLayout } from "../components/AppLayout";
import { IntegrationApiSection } from "../components/IntegrationApiSection";

export default function ApiManagementPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">จัดการ API</h1>
        <p className="text-slate-500 text-sm mt-1">จัดการการเชื่อมต่อ API Key และประวัติการเรียกใช้งานจากระบบภายนอก</p>
      </div>
      <IntegrationApiSection />
    </AppLayout>
  );
}
