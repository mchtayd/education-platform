// src/pages/admin/AdminPortal.tsx
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import PeopleIcon from "@mui/icons-material/People";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import QuizIcon from "@mui/icons-material/Quiz";

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const drawerWidth = 280;

export default function AdminPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const menuItems = [
    { label: "Eğitimler", icon: <SchoolIcon />, to: "/admin/trainings", key: "trainings" },
    { label: "Kullanıcılar", icon: <PeopleIcon />, to: "/admin/users", key: "users" },
    { label: "Analiz", icon: <AnalyticsIcon />, to: "/admin/analysis", key: "analysis" },
    { label: "Sınav", icon: <QuizIcon />, to: "/admin/exam", key: "exam" },
  ];

  const handleGo = (to: string) => {
    navigate(to);
    setOpen(false);
  };

  const isSelected = (to: string) => location.pathname.startsWith(to);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", position: "relative" }}>
      {/* APP BAR (senin mevcut AppBar'ın hangi dosyadaysa aynen kalabilir; burada dokunmadım) */}

      {/* SOL DRAWER */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: drawerWidth } }}
      >
        <Box sx={{ px: 2, py: 2 }}>
          {/* İstersen burada da yazı istemiyorsan silebilirsin, ama mevcut tasarımı bozmamak için bırakıyorum */}
        </Box>
        <Divider />
        <List sx={{ p: 0 }}>
          {menuItems.map((m) => (
            <ListItemButton
              key={m.key}
              selected={isSelected(m.to)}
              onClick={() => handleGo(m.to)}
            >
              <ListItemIcon>{m.icon}</ListItemIcon>
              <ListItemText primary={m.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* SAYFA İÇERİĞİ: LOGO KALDIRILDI */}
      <Box
        sx={{
          position: "relative",
          p: 3,
          minHeight: "calc(100dvh - 64px)", // AppBar sticky yüksekliği 64px varsayımı
        }}
      >
        {/* İçerik yok - sadece boş alan */}
        <Box sx={{ position: "relative", zIndex: 1 }} />
      </Box>
    </Box>
  );
}
