//src\pages\admin\AdminIndexRedirect.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminPortal from "./AdminPortal";

export default function AdminIndexRedirect() {
  const { user } = useAuth();
  const role = String(user?.role ?? "").trim().toLowerCase();

  if (role === "admin") return <AdminPortal />;

  // trainer/educator /admin'e gelince direkt eğitimler
  return <Navigate to="/admin/trainings" replace />;
}
