//UserLayout.tsx
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  Badge,
  Chip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SchoolIcon from "@mui/icons-material/School";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import QuizIcon from "@mui/icons-material/Quiz";
import LogoutIcon from "@mui/icons-material/Logout";
import MailIcon from "@mui/icons-material/Mail";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

type Category = { id: number; name: string; count: number; watched: number };

type ExamNavItem = {
  examId: number;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  attemptId?: number | null;

  // ✅ nav endpoint'i bunu döndürürse sidebar'da başarısız/başarılı ayrımı yapacağız
  isPassed?: boolean | null;
  score?: number | null;
};

const drawerWidth = 280;

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const [openDrawer, setOpenDrawer] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [navExams, setNavExams] = useState<ExamNavItem[]>([]);
  const [unread, setUnread] = useState(0);

  // ---------------- Helpers ----------------
  const isExact = (path: string) => location.pathname === path;
  const isStarts = (path: string) => location.pathname.startsWith(path);

  // "Tüm Eğitimler" sadece /app ve /app/c/* iken seçili olsun (exams dahil olmasın)
  const isTrainingRootSelected = useMemo(() => {
    if (isExact("/app")) return true;
    if (isStarts("/app/c/")) return true;
    return false;
  }, [location.pathname]);

  // ✅ Sidebar chip: Girdi yerine Sınav Tamamlandı / Sınav Başarısız
  const examStatusChip = (x: ExamNavItem) => {
    if (x.status === "completed") {
      if (x.isPassed === false) {
        return (
          <Chip
            size="small"
            color="error"
            label="Sınav Başarısız"
            sx={{ fontWeight: 700 }}
          />
        );
      }
      return (
        <Chip
          size="small"
          color="success"
          label="Sınav Tamamlandı"
          sx={{ fontWeight: 700 }}
        />
      );
    }

    if (x.status === "in_progress")
      return <Chip size="small" color="warning" label="Devam" sx={{ fontWeight: 700 }} />;

    return <Chip size="small" label="Girilmedi" sx={{ fontWeight: 700 }} />;
  };

  const loadUnread = async () => {
    try {
      const { data } = await api.get<{ count: number }>("/api/MyMessages/unread-count");
      setUnread(data?.count ?? 0);
    } catch {}
  };

  useEffect(() => {
    const onChanged = () => loadUnread();
    window.addEventListener("messagesChanged", onChanged);
    const t = setInterval(loadUnread, 15000);
    return () => {
      window.removeEventListener("messagesChanged", onChanged);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Loads ----------------
  const loadCats = async () => {
    try {
      const { data } = await api.get<Category[]>("/api/My/categories");
      setCategories(data);
    } catch {
      // sessiz
    }
  };

  const loadExamNav = async () => {
    try {
      const { data } = await api.get<ExamNavItem[]>("/api/MyExams/nav");
      setNavExams(data ?? []);
    } catch {
      setNavExams([]);
    }
  };

  useEffect(() => {
    loadCats();
    loadExamNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    loadUnread();
  }, [location.pathname]);

  // ---------------- UI ----------------
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={1} color="inherit" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => setOpenDrawer(true)} aria-label="menü">
            <MenuIcon />
          </IconButton>

          <SchoolIcon sx={{ mr: 0.5, color: "primary.main" }} />
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ cursor: "pointer" }}
            onClick={() => navigate("/app")}
          >
            Eğitim Platformu
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Mesajlar">
            <IconButton onClick={() => navigate("/app/messages")} aria-label="mesajlar">
              <Badge badgeContent={unread} color="error">
                <MailIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Çıkış Yap">
            <IconButton onClick={signOut} aria-label="çıkış">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer open={openDrawer} onClose={() => setOpenDrawer(false)} PaperProps={{ sx: { width: drawerWidth } }}>
        <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
            Merhaba, {user?.name} {(user as any)?.surname ?? ""} 👋
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
        <Divider />

        <List sx={{ p: 0 }}>
          {/* Tüm Eğitimler */}
          <ListItemButton
            selected={isTrainingRootSelected}
            onClick={() => {
              navigate("/app");
              setOpenDrawer(false);
            }}
          >
            <ListItemIcon>
              <AnalyticsIcon />
            </ListItemIcon>
            <ListItemText primary="Tüm Eğitimler" />
          </ListItemButton>

          {/* Dinamik kategoriler */}
          {categories.map((c) => (
            <ListItemButton
              key={c.id}
              selected={location.pathname === `/app/c/${c.id}`}
              onClick={() => {
                navigate(`/app/c/${c.id}`);
                setOpenDrawer(false);
              }}
            >
              <ListItemIcon>
                <SchoolIcon />
              </ListItemIcon>
              <ListItemText primary={c.name} secondary={`${c.watched}/${c.count} izlendi`} />
            </ListItemButton>
          ))}

          <Divider sx={{ my: 1 }} />

          {/* Sınav ana menü */}
          <ListItemButton
            selected={isStarts("/app/exams")}
            onClick={() => {
              navigate("/app/exams");
              setOpenDrawer(false);
            }}
          >
            <ListItemIcon>
              <QuizIcon />
            </ListItemIcon>
            <ListItemText primary="Sınav" />
          </ListItemButton>

          {/* Sınavlar (Sınav başlığı altında) */}
          {navExams.length === 0 ? (
            <ListItemButton disabled sx={{ pl: 6, opacity: 0.75 }}>
              <ListItemText primary="Yayınlanan sınav yok" />
            </ListItemButton>
          ) : (
            navExams.map((x) => (
              <ListItemButton
                key={x.examId}
                selected={location.pathname === `/app/exams/${x.examId}`}
                onClick={() => {
                  navigate(`/app/exams/${x.examId}`);
                  setOpenDrawer(false);
                }}
                sx={{ pl: 6 }}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <QuizIcon fontSize="small" />
                </ListItemIcon>

                <ListItemText
                  primary={x.title}
                  secondary={
                    x.status === "completed"
                      ? x.isPassed === false
                        ? "Sınav başarısız"
                        : "Sınav tamamlandı"
                      : x.status === "in_progress"
                      ? "Sınav devam ediyor"
                      : "Henüz girilmedi"
                  }
                />

                {examStatusChip(x)}
              </ListItemButton>
            ))
          )}
        </List>
      </Drawer>

      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
