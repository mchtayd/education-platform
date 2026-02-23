// src/pages/admin/AdminIndexRedirect.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  Divider,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import AddBoxIcon from "@mui/icons-material/AddBox";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AssessmentIcon from "@mui/icons-material/Assessment";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

type StatCard = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
};

type QuickAction = {
  title: string;
  desc: string;
  to: string;
  icon: React.ReactNode;
};

type ActivityItem = {
  title: string;
  time: string;
  type: "info" | "success" | "warning";
};

export default function AdminIndexRedirect() {
  const navigate = useNavigate();

  // ✅ İlk aşama: placeholder veriler (sonra API ile dolduracağız)
  const stats = useMemo<StatCard[]>(
    () => [
      {
        title: "Toplam Kullanıcı",
        value: 0,
        icon: <PeopleIcon fontSize="small" />,
        hint: "Aktif/Pasif dahil",
      },
      {
        title: "Toplam Eğitim",
        value: 0,
        icon: <SchoolIcon fontSize="small" />,
        hint: "Tüm içerikler",
      },
      {
        title: "Toplam Sınav",
        value: 0,
        icon: <QuizIcon fontSize="small" />,
        hint: "Taslak + yayında",
      },
      {
        title: "AI Doküman Havuzu",
        value: 0,
        icon: <SmartToyIcon fontSize="small" />,
        hint: "Yüklenen PDF",
      },
    ],
    []
  );

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        title: "Eğitimler",
        desc: "Eğitimleri görüntüle ve yönet",
        to: "/admin/trainings",
        icon: <SchoolIcon />,
      },
      {
        title: "Sınav Oluştur / Yönet",
        desc: "Sınav işlemlerine git",
        to: "/admin/exam",
        icon: <QuizIcon />,
      },
      {
        title: "Kullanıcılar",
        desc: "Kullanıcı yönetimi ekranı",
        to: "/admin/users",
        icon: <PersonAddAlt1Icon />,
      },
      {
        title: "AI İçerik Sorgulama",
        desc: "PDF yükle ve doküman sorgula",
        to: "/admin/ai-content",
        icon: <AutoAwesomeIcon />,
      },
      {
        title: "Analiz",
        desc: "Rapor ve analiz ekranı",
        to: "/admin/analysis",
        icon: <AssessmentIcon />,
      },
      {
        title: "Mesajlar",
        desc: "Gelen mesajlara git",
        to: "/admin/messages",
        icon: <NotificationsActiveIcon />,
      },
    ],
    []
  );

  const recentActivities = useMemo<ActivityItem[]>(
    () => [
      { title: "Henüz aktivite kaydı yok.", time: "-", type: "info" },
      // API bağlandığında örnek:
      // { title: "Yeni bir eğitim eklendi", time: "5 dk önce", type: "success" },
      // { title: "AI doküman yükleme tamamlandı", time: "18 dk önce", type: "info" },
      // { title: "Yayın bekleyen sınav mevcut", time: "1 saat önce", type: "warning" },
    ],
    []
  );

  const alerts = useMemo(
    () => [
      { text: "AI modülünde PDF yükleyip doküman tabanlı sorgulama yapabilirsiniz.", severity: "info" as const },
      { text: "Dashboard verileri şu an placeholder. İstersen bir sonraki adımda API’den gerçek sayıları bağlayalım.", severity: "warning" as const },
    ],
    []
  );

  const getChipColor = (type: ActivityItem["type"]) => {
    if (type === "success") return "success";
    if (type === "warning") return "warning";
    return "default";
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
      {/* ÜST BAŞLIK */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          mb: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Yönetim Paneli
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Eğitim, sınav, kullanıcı ve AI doküman süreçlerini buradan yönetebilirsin.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip icon={<TrendingUpIcon />} label="Sistem Durumu: Hazır" color="success" variant="outlined" />
            <Chip icon={<SmartToyIcon />} label="AI Modülü Aktif" color="primary" variant="outlined" />
          </Stack>
        </Stack>
      </Paper>

      {/* İSTATİSTİK KARTLARI */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
          mb: 2,
        }}
      >
        {stats.map((s, i) => (
          <Paper
            key={`${s.title}-${i}`}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {s.title}
                </Typography>
                <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.1 }}>
                  {s.value}
                </Typography>
                {s.hint && (
                  <Typography variant="caption" color="text.secondary">
                    {s.hint}
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "action.hover",
                  color: "text.secondary",
                }}
              >
                {s.icon}
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      {/* ORTA ALAN: SOL (HIZLI İŞLEMLER) + SAĞ (SON AKTİVİTELER / UYARILAR) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "1.45fr 1fr" },
          gap: 2,
        }}
      >
        {/* HIZLI İŞLEMLER */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Hızlı İşlemler
            </Typography>
            <Button size="small" onClick={() => navigate("/admin/trainings")}>
              Tümünü Gör
            </Button>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
            {quickActions.map((a) => (
              <Paper
                key={a.title}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: "pointer",
                  transition: "all .15s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: 1,
                    transform: "translateY(-1px)",
                  },
                }}
                onClick={() => navigate(a.to)}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "action.hover",
                      color: "primary.main",
                      flexShrink: 0,
                    }}
                  >
                    {a.icon}
                  </Box>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={600} noWrap>
                      {a.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {a.desc}
                    </Typography>
                  </Box>

                  <ArrowForwardIosIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                </Stack>
              </Paper>
            ))}
          </Box>
        </Paper>

        {/* SAĞ PANEL */}
        <Stack spacing={2}>
          {/* Son aktiviteler */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
              Son Aktiviteler
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            <Stack spacing={1}>
              {recentActivities.map((item, idx) => (
                <Paper
                  key={`${item.title}-${idx}`}
                  variant="outlined"
                  sx={{ p: 1.25, borderRadius: 2 }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.time}
                      </Typography>
                    </Box>

                    <Chip
                      size="small"
                      label={
                        item.type === "success"
                          ? "Başarılı"
                          : item.type === "warning"
                          ? "Uyarı"
                          : "Bilgi"
                      }
                      color={getChipColor(item.type) as any}
                      variant="outlined"
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          {/* Sistem notları / uyarılar */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
              Sistem Notları
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            <Stack spacing={1}>
              {alerts.map((a, i) => (
                <Paper
                  key={i}
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    borderColor:
                      a.severity === "warning"
                        ? "warning.light"
                        : a.severity === "info"
                        ? "info.light"
                        : "divider",
                    bgcolor:
                      a.severity === "warning"
                        ? "warning.50"
                        : a.severity === "info"
                        ? "info.50"
                        : "background.paper",
                  }}
                >
                  <Typography variant="body2">{a.text}</Typography>
                </Paper>
              ))}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
              <Button size="small" startIcon={<AddBoxIcon />} onClick={() => navigate("/admin/trainings")}>
                Eğitim Ekle
              </Button>
              <Button size="small" startIcon={<QuizIcon />} onClick={() => navigate("/admin/exam")}>
                Sınavlara Git
              </Button>
              <Button size="small" startIcon={<SmartToyIcon />} onClick={() => navigate("/admin/ai-content")}>
                AI Modülüne Git
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}