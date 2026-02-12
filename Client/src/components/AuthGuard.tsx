//AuthGuard.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✅ şifre değişmeden başka sayfaya girme
  if (user?.mustChangePassword && location.pathname !== "/force-password") {
    return <Navigate to="/force-password" replace />;
  }

  return <>{children}</>;
}
