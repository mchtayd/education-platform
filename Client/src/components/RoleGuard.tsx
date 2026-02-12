//src\components\RoleGuard.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { ReactNode } from "react";

type RoleGuardProps = {
  allow: ReadonlyArray<string>;
  children: ReactNode;
};

export default function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user } = useAuth();
  const loc = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  const role = String((user as any)?.role ?? "").trim().toLowerCase();
  const allowSet = new Set(allow.map((x) => String(x).trim().toLowerCase()));

  if (!allowSet.has(role)) {
    // ✅ trainer/educator admin alanında kalsın
    const adminAreaRoles = new Set(["admin", "trainer", "educator"]);
    const dest = adminAreaRoles.has(role) ? "/admin" : "/app";
    return <Navigate to={dest} state={{ from: loc }} replace />;
  }

  return <>{children}</>;
}
