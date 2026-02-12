// src/components/layout/AdminLayout.tsx
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Badge,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import MailIcon from "@mui/icons-material/Mail";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import SchoolIcon from "@mui/icons-material/School";
import PeopleIcon from "@mui/icons-material/People";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import QuizIcon from "@mui/icons-material/Quiz";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsIcon from "@mui/icons-material/Notifications";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const drawerWidth = 280;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const role = String(user?.role ?? "").toLowerCase();
  const isEducator = role === "educator" || role === "trainer";
  const isAdmin = role === "admin";

  const [openDrawer, setOpenDrawer] = useState(false);
  const [accountEl, setAccountEl] = useState<null | HTMLElement>(null);
  const [notifEl, setNotifEl] = useState<null | HTMLElement>(null);

  const [unread, setUnread] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // ✅ QR Dialog state
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");

  const menu = useMemo(() => {
    if (isEducator) {
      return [
        { to: "/admin/trainings", label: "Eğitimler", icon: <SchoolIcon /> },
        { to: "/admin/exam", label: "Sınav", icon: <QuizIcon /> },
      ];
    }

    return [
      { to: "/admin", label: "Dashboard", icon: <DashboardCustomizeIcon /> },
      { to: "/admin/trainings", label: "Eğitimler", icon: <SchoolIcon /> },
      { to: "/admin/users", label: "Kullanıcılar", icon: <PeopleIcon /> },
      { to: "/admin/analysis", label: "Analiz", icon: <AnalyticsIcon /> },
      { to: "/admin/exam", label: "Sınav", icon: <QuizIcon /> },
    ];
  }, [isEducator]);

  const isSel = (to: string) =>
    to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(to);

  const loadUnreadMsgs = async () => {
    try {
      const url = isEducator ? "/api/MyMessages/unread-count" : "/api/Messages/unread-count";
      const { data } = await api.get<{ count: number }>(url);
      setUnread(data?.count ?? 0);
    } catch {
      setUnread(0);
    }
  };

  // educator için bekleyen talep bildirimi gereksiz -> sadece admin
  useEffect(() => {
    if (!isAdmin) return;

    let alive = true;
    const fetchCount = async () => {
      try {
        const { data } = await api.get("/api/Users/requests/count");
        if (alive) setPendingCount(data?.count ?? 0);
      } catch {}
    };

    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isAdmin]);

  useEffect(() => {
    loadUnreadMsgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const onChanged = () => loadUnreadMsgs();
    window.addEventListener("messagesChanged", onChanged);
    const t = setInterval(loadUnreadMsgs, 15000);

    return () => {
      window.removeEventListener("messagesChanged", onChanged);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ QR üret (login ekranına yönlendirir)
  const openQr = async () => {
    setAccountEl(null);

    // login url: bulunduğun domain üzerinden /login
    const url = `${window.location.origin}/login`;
    setQrUrl(url);

    try {
      // qrcode paketini lazy import (bundle şişmesin)
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.default.toDataURL(url, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl("");
    }

    setQrOpen(true);
  };

  const copyQrUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
    } catch {
      // clipboard izin vermezse sessiz geç
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={1} color="inherit" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => setOpenDrawer(true)} aria-label="menüyü aç">
            <MenuIcon />
          </IconButton>

          <DashboardCustomizeIcon sx={{ mr: 0.5, color: "primary.main" }} />
          <Typography
            variant="h6"
            fontWeight={700}
            onClick={() => navigate("/admin")}
            sx={{ cursor: "pointer", userSelect: "none" }}
          >
            Eğitim Platformu
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {/* Mesajlar */}
          <Tooltip title="Mesajlar">
            <IconButton size="large" onClick={() => navigate("/admin/messages")} aria-label="mesajlar">
              <Badge badgeContent={unread} color="error">
                <MailIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Bildirimler sadece admin */}
          {!isEducator && (
            <>
              <Tooltip title="Bildirimler">
                <IconButton size="large" aria-label="bildirimler" onClick={(e) => setNotifEl(e.currentTarget)}>
                  <Badge color="error" badgeContent={pendingCount}>
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={notifEl}
                open={Boolean(notifEl)}
                onClose={() => setNotifEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem
                  onClick={() => {
                    setNotifEl(null);
                    navigate("/admin/users?tab=requests");
                  }}
                  disabled={pendingCount === 0}
                  sx={{ maxWidth: 360, whiteSpace: "normal" }}
                >
                  {pendingCount > 0
                    ? "Yeni bir kullanıcı oluşturma talebi bulunmaktadır. Onaylamak veya Reddetmek istiyorsanız tıklayın."
                    : "Bekleyen kullanıcı oluşturma talebi bulunmuyor."}
                </MenuItem>
              </Menu>
            </>
          )}

          <IconButton size="large" onClick={(e) => setAccountEl(e.currentTarget)} aria-label="hesap">
            <AccountCircleIcon />
          </IconButton>

          {/* ✅ Sağ üst hesap menüsü */}
          <Menu
            anchorEl={accountEl}
            open={Boolean(accountEl)}
            onClose={() => setAccountEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem disabled sx={{ opacity: 1, py: 1 }}>
              <Box>
                <Typography fontWeight={600}>{user?.email}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.name} {(user as any)?.surname ?? ""} • {role}
                </Typography>
              </Box>
            </MenuItem>

            <Divider />

            <MenuItem
              onClick={() => {
                setAccountEl(null);
                navigate("/admin/profile");
              }}
            >
              <PersonIcon fontSize="small" style={{ marginRight: 8 }} /> Profil
            </MenuItem>

            <MenuItem
              onClick={() => {
                setAccountEl(null);
                navigate("/admin/settings");
              }}
            >
              <SettingsIcon fontSize="small" style={{ marginRight: 8 }} /> Ayarlar
            </MenuItem>

            {/* ✅ Ayarların altına QR Oluştur */}
            <MenuItem onClick={openQr}>
              <QrCode2Icon fontSize="small" style={{ marginRight: 8 }} /> QR Oluştur
            </MenuItem>

            <Divider />

            <MenuItem
              onClick={() => {
                setAccountEl(null);
                signOut();
              }}
            >
              <LogoutIcon fontSize="small" style={{ marginRight: 8 }} /> Çıkış Yap
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer open={openDrawer} onClose={() => setOpenDrawer(false)} PaperProps={{ sx: { width: drawerWidth } }}>
        <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Yönetim Menüsü
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isEducator ? "Eğitmen Paneli" : "Admin işlemleri"}
          </Typography>
        </Box>

        <Divider />

        <List sx={{ p: 0 }}>
          {menu.map((m) => (
            <ListItemButton
              key={m.to}
              selected={isSel(m.to)}
              onClick={() => {
                navigate(m.to);
                setOpenDrawer(false);
              }}
            >
              <ListItemIcon>{m.icon}</ListItemIcon>
              <ListItemText primary={m.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>

      {/* ✅ QR Dialog */}
      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Login için QR</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} alignItems="center">
            {qrDataUrl ? (
              <Box
                component="img"
                src={qrDataUrl}
                alt="login qr"
                sx={{ width: 280, height: 280, borderRadius: 2, border: 1, borderColor: "divider" }}
              />
            ) : (
              <Typography color="text.secondary">
                QR üretilemedi. (qrcode paketi yüklü mü?)
              </Typography>
            )}

            <TextField
              fullWidth
              label="Yönlendirme Linki"
              value={qrUrl}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <Tooltip title="Kopyala">
                    <IconButton onClick={copyQrUrl} edge="end">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ),
              }}
            />

            <Typography variant="caption" color="text.secondary" textAlign="center">
              Bu QR kod okutulduğunda doğrudan giriş ekranına yönlendirir.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setQrOpen(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
