import { createBrowserRouter } from "react-router-dom";

import LoginPage from "../pages/Login";
import RegisterPage from "../pages/Register";
import ForgotPasswordPage from "../pages/ForgotPassword";
import HomeRedirect from "../pages/HomeRedirect";

// ✅ zorunlu şifre değişim sayfası
import ForcePasswordChange from "../pages/ForcePasswordChange";

import AuthGuard from "../components/AuthGuard";
import RoleGuard from "../components/RoleGuard";

// Legacy
import DashboardPage from "../pages/Dashboard";

// Admin
import AdminLayout from "../layouts/AdminLayout";
import AdminTrainings from "../pages/admin/AdminTrainings";
import AdminAnalysis from "../pages/admin/AdminAnalysis";
import AdminExam from "../pages/admin/AdminExam";
import AdminMessages from "../pages/admin/AdminMessages";
import AdminSettings from "../pages/admin/AdminSettings";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminProfile from "../pages/admin/AdminProfile";
import AdminIndexRedirect from "../pages/admin/AdminIndexRedirect";
import AdminAiContent from "../pages/admin/AdminAiContent";

// User portal
import UserLayout from "../layouts/UserLayout";
import UserTrainings from "../pages/users/UserTrainings";
import UserExams from "../pages/users/UserExams";
import UserExamDetail from "../pages/users/UserExamDetail";
import UserExamTake from "../pages/users/UserExamTake";
import UserMessages from "../pages/users/UserMessages";

export const router = createBrowserRouter([
  // public
  { path: "/", element: <HomeRedirect /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },

  // ✅ MUST CHANGE PASSWORD route
  // AuthGuard içinde zaten "mustChangePassword" kontrolü var, ama bu path'e izin veriyor.
  { path: "/force-password", element: <AuthGuard><ForcePasswordChange /></AuthGuard> },

  // legacy
  { path: "/dashboard", element: <AuthGuard><DashboardPage /></AuthGuard> },

  // === User portal ===
  {
    path: "/app",
    element: (
      <AuthGuard>
        {/* ✅ trainer/educator buraya girmesin istiyorsan */}
        <RoleGuard allow={["user", "staff"]}>
          <UserLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <UserTrainings /> },
      { path: "c/:categoryId", element: <UserTrainings /> },

      { path: "exams", element: <UserExams /> },
      { path: "exams/:examId", element: <UserExamDetail /> },
      { path: "exams/take/:attemptId", element: <UserExamTake /> },

      { path: "messages", element: <UserMessages /> },
      {
        path: "ai-content",
        element: (
          <RoleGuard allow={["user"]}>
            <AdminAiContent />
          </RoleGuard>
        ),
      },
    ],
  },

  // === Admin / Trainer / Educator portal ===
  {
    path: "/admin",
    element: (
      <AuthGuard>
        {/* ✅ trainer & educator artık /admin'e girebilir */}
        <RoleGuard allow={["admin", "trainer", "educator"]}>
          <AdminLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <AdminIndexRedirect /> },

      // herkes (admin/trainer/educator)
      { path: "trainings", element: <AdminTrainings /> },
      { path: "exam", element: <AdminExam /> },
      { path: "messages", element: <AdminMessages /> },
      { path: "profile", element: <AdminProfile /> },
      { path: "settings", element: <AdminSettings /> },

      // sadece admin
      {
        path: "analysis",
        element: (
          <RoleGuard allow={["admin"]}>
            <AdminAnalysis />
          </RoleGuard>
        ),
      },
      {
        path: "users",
        element: (
          <RoleGuard allow={["admin"]}>
            <AdminUsers />
          </RoleGuard>
        ),
      },
      {
  path: "ai-content",
  element: (
    <RoleGuard allow={["admin", "trainer", "educator"]}>
      <AdminAiContent />
    </RoleGuard>
  ),
},
    ],
  },

  { path: "*", element: <HomeRedirect /> },
]);
