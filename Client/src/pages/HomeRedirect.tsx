// src/pages/HomeRedirect.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function HomeRedirect() {
  const { isAuthenticated, user } = useAuth();

  // giriş yoksa login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // ✅ ilk giriş: şifre değiştir zorunlu
  if (user.mustChangePassword) {
    return <Navigate to="/force-password" replace />;
  }

  // role yönlendirme
  const role = String(user.role ?? "").toLowerCase();
  const to = role === "admin" || role === "educator" || role === "trainer" ? "/admin" : "/app";
  return <Navigate to={to} replace />;
}
