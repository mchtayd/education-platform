// src/pages/admin/AdminIndexRedirect.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import FolderCopyIcon from "@mui/icons-material/FolderCopy";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AssessmentIcon from "@mui/icons-material/Assessment";
import QuizIcon from "@mui/icons-material/Quiz";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import RefreshIcon from "@mui/icons-material/Refresh";

import api from "../../lib/api";

type AiDocItem = {
  id: number;
  fileName: string;
  uploadedAt?: string;
  sizeBytes?: number;
};

type DashboardStats = {
  usersCount: number | null;
  pendingRequestsCount: number | null;
  trainingsCount: number | null;
  aiDocsCount: number | null;
  projectsCount: number | null;
  latestAiDocName?: string | null;
  latestAiDocUploadedAt?: string | null;
};

type ActivityItem = {
  title: string;
  time: string;
  type: "info" | "success" | "warning";
};

type QuickAction = {
  title: string;
  desc: string;
  to: string;
  icon: React.ReactNode;
};

function formatDateTimeTR(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}

function normalizeAiDoc(x: any): AiDocItem {
  return {
    id: x?.id ?? x?.Id,
    fileName: x?.fileName ?? x?.FileName,
    uploadedAt: x?.uploadedAt ?? x?.UploadedAt,
    sizeBytes: x?.sizeBytes ?? x?.SizeBytes,
  };
}

export default function AdminIndexRedirect() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    usersCount: null,
    pendingRequestsCount: null,
    trainingsCount: null,
    aiDocsCount: null,
    projectsCount: null,
    latestAiDocName: null,
    latestAiDocUploadedAt: null,
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        title: "Eğitimler",
        desc: "Eğitimleri görüntüle ve yönet",
        to: "/admin/trainings",
        icon: <SchoolIcon />,
      },
      {
        title: "Sınav Yönetimi",
        desc: "Sınav oluştur / yayınla / kontrol et",
        to: "/admin/exam",
        icon: <QuizIcon />,
      },
      {
        title: "Kullanıcılar",
        desc: "Kullanıcı listesi ve yönetimi",
        to: "/admin/users",
        icon: <PeopleIcon />,
      },
      {
        title: "AI İçerik Sorgulama",
        desc: "PDF yükle ve dokümanlardan cevap al",
        to: "/admin/ai-content",
        icon: <AutoAwesomeIcon />,
      },
      {
        title: "Analiz",
        desc: "Sistem analizleri ve raporlar",
        to: "/admin/analysis",
        icon: <AssessmentIcon />,
      },
      {
        title: "Mesajlar",
        desc: "Destek / iletişim mesajları",
        to: "/admin/messages",
        icon: <NotificationsActiveIcon />,
      },
    ],
    []
  );

  const loadDashboard = useCallback(async () => {
    setLoadError(null);

    try {
      // ✅ Senin controller'larına göre kesin/uyumlu endpointler
      const [usersRes, pendingRes, trainingsRes, aiDocsRes, projectsRes] = await Promise.all([
        api.get("/Users/admin-list"),        // UsersController -> admin-list
        api.get("/Users/requests/count"),    // UsersController -> requests/count
        api.get("/Trainings"),               // TrainingsController -> GET list
        api.get("/AiDocs"),                  // Senin AI docs endpointin
        api.get("/Users/projects"),          // UsersController -> projects (admin tüm projeler)
      ]);

      const users = toArray(usersRes.data);
      const trainings = toArray(trainingsRes.data);
      const aiDocsRaw = toArray(aiDocsRes.data);
      const projects = toArray(projectsRes.data);

      const aiDocs: AiDocItem[] = aiDocsRaw.map(normalizeAiDoc);

      const latestAiDoc = [...aiDocs].sort((a, b) => {
        const ta = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const tb = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return tb - ta;
      })[0];

      const pendingCount =
        typeof pendingRes.data?.count === "number"
          ? pendingRes.data.count
          : typeof pendingRes.data?.Count === "number"
          ? pendingRes.data.Count
          : null;

      setStats({
        usersCount: users.length,
        pendingRequestsCount: pendingCount,
        trainingsCount: trainings.length,
        aiDocsCount: aiDocs.length,
        projectsCount: projects.length,
        latestAiDocName: latestAiDoc?.fileName ?? null,
        latestAiDocUploadedAt: latestAiDoc?.uploadedAt ?? null,
      });

      const nextActivities: ActivityItem[] = [];

      if (pendingCount !== null) {
        nextActivities.push({
          title:
            pendingCount > 0
              ? `${pendingCount} adet bekleyen hesap talebi var`
              : "Bekleyen hesap talebi bulunmuyor",
          time: "Güncel",
          type: pendingCount > 0 ? "warning" : "success",
        });
      }

      nextActivities.push({
        title:
          aiDocs.length > 0
            ? `AI havuzunda ${aiDocs.length} doküman mevcut`
            : "AI havuzu boş (henüz doküman yüklenmemiş)",
        time: "Güncel",
        type: aiDocs.length > 0 ? "info" : "warning",
      });

      if (latestAiDoc) {
        nextActivities.push({
          title: `Son yüklenen AI dokümanı: ${latestAiDoc.fileName}`,
          time: formatDateTimeTR(latestAiDoc.uploadedAt),
          type: "success",
        });
      }

      nextActivities.push({
        title: `Toplam ${trainings.length} eğitim, ${projects.length} proje, ${users.length} kullanıcı`,
        time: "Anlık özet",
        type: "info",
      });

      setActivities(nextActivities.slice(0, 6));
    } catch (err) {
      console.error("Admin dashboard load error:", err);
      setLoadError("Dashboard verileri yüklenirken hata oluştu.");
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      try {
        if (active) await loadDashboard();
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };

  const statCards = [
    {
      key: "users",
      title: "Toplam Kullanıcı",
      value: stats.usersCount,
      hint: "Aktif ve pasit hesaplar dahil",
      icon: <PeopleIcon fontSize="small" />,
    },
    {
      key: "pending",
      title: "Bekleyen Talepler",
      value: stats.pendingRequestsCount,
      hint: "onay bekleyen hesaplar",
      icon: <PersonAddAlt1Icon fontSize="small" />,
    },
    {
      key: "trainings",
      title: "Toplam Eğitim",
      value: stats.trainingsCount,
      hint: "Yayında olan ve olmayan tüm eğitimler",
      icon: <SchoolIcon fontSize="small" />,
    },
    {
      key: "aiDocs",
      title: "AI Doküman Havuzu",
      value: stats.aiDocsCount,
      hint: "yüklenen PDF dokümanlar",
      icon: <SmartToyIcon fontSize="small" />,
    },
  ];

  const getChipColor = (type: ActivityItem["type"]) => {
    if (type === "success") return "success";
    if (type === "warning") return "warning";
    return "default";
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
      {/* Üst Bilgi Kartı */}
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
              Admin Yönetim Paneli
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<TrendingUpIcon />}
              label="Sistem Durumu: Hazır"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<SmartToyIcon />}
              label="AI Modülü Aktif"
              color="primary"
              variant="outlined"
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? "Yenileniyor..." : "Yenile"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {/* İstatistik Kartları */}
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
        {statCards.map((card) => (
          <Paper
            key={card.key}
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
                  {card.title}
                </Typography>

                {loading ? (
                  <Skeleton width={72} height={44} />
                ) : (
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.1 }}>
                    {typeof card.value === "number" ? card.value : "-"}
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary">
                  {card.hint}
                </Typography>
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
                {card.icon}
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      {/* Alt Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "1.45fr 1fr" },
          gap: 2,
        }}
      >
        {/* Hızlı İşlemler */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Hızlı İşlemler
          </Typography>
          <Divider sx={{ my: 1.5 }} />

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
                onClick={() => navigate(a.to)}
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

        {/* Sağ taraf */}
        <Stack spacing={2}>
          {/* Son Aktiviteler */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" fontWeight={700}>
              Son Aktiviteler
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1}>
              {loading ? (
                <>
                  <Skeleton height={56} />
                  <Skeleton height={56} />
                  <Skeleton height={56} />
                </>
              ) : activities.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aktivite bulunamadı.
                </Typography>
              ) : (
                activities.map((item, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
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
                ))
              )}
            </Stack>
          </Paper>

          {/* Sistem Özeti */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" fontWeight={700}>
              Sistem Özeti
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1}>
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FolderCopyIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    Proje sayısı:{" "}
                    <b>{loading ? "..." : typeof stats.projectsCount === "number" ? stats.projectsCount : "-"}</b>
                  </Typography>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Typography variant="body2">
                  Bekleyen talepler varsa önce <b>Kullanıcılar</b> ekranından onaylaman iyi olur.
                </Typography>
              </Paper>

              {stats.latestAiDocName && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    borderColor: "success.light",
                  }}
                >
                  <Typography variant="body2">
                    Son AI dokümanı: <b>{stats.latestAiDocName}</b>{" "}
                    ({formatDateTimeTR(stats.latestAiDocUploadedAt)})
                  </Typography>
                </Paper>
              )}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              <Button size="small" onClick={() => navigate("/admin/users")}>
                Kullanıcılar
              </Button>
              <Button size="small" onClick={() => navigate("/admin/trainings")}>
                Eğitimler
              </Button>
              <Button size="small" onClick={() => navigate("/admin/ai-content")}>
                AI Modülü
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}