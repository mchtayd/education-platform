// src/pages/admin/AdminProfile.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  Stack,
  TextField,
  Chip,
  CircularProgress,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import RefreshIcon from "@mui/icons-material/Refresh";
import dayjs from "dayjs";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type ProfileDto = {
  id?: number;
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null; // Kurum
  workAddress?: string | null;  // İş Yeri Adres
  projectName?: string | null;  // Proje adı
  role?: string | null;         // admin/user/staff vs.
  createdAt?: string | null;    // kayıt tarihi
};

const ro = { readOnly: true } as const;

export default function AdminProfile() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error" | "info" | "warning";
  }>({ open: false, msg: "", severity: "info" });

  const fallbackFromAuth: ProfileDto | null = useMemo(() => {
    if (!user) return null;
    return {
      id: (user as any)?.id,
      name: (user as any)?.name ?? null,
      surname: (user as any)?.surname ?? null,
      email: (user as any)?.email ?? null,
      phone: (user as any)?.phone ?? null,
      organization: (user as any)?.organization ?? (user as any)?.institution ?? null,
      workAddress: (user as any)?.workAddress ?? (user as any)?.address ?? null,
      projectName: (user as any)?.projectName ?? null,
      role: (user as any)?.role ?? null,
      createdAt: (user as any)?.createdAt ?? null,
    };
  }, [user]);

  const fullName = useMemo(() => {
    const n = profile?.name || fallbackFromAuth?.name || "";
    const s = profile?.surname || fallbackFromAuth?.surname || "";
    const t = `${n} ${s}`.trim();
    return t || "—";
  }, [profile, fallbackFromAuth]);

  const email = profile?.email ?? fallbackFromAuth?.email ?? "—";
  const role = (profile?.role ?? fallbackFromAuth?.role ?? "—").toString();

  const safe = (v?: string | null) => (v && v.trim() ? v : "—");

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Projende "me" endpoint'i hangisiyse biri mutlaka tutacaktır.
      const endpoints = [
        "/api/Auth/me",
      ];

      let data: any = null;
      let lastErr: any = null;

      for (const url of endpoints) {
        try {
          const res = await api.get(url);
          data = res.data;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!data) {
        throw lastErr || new Error("Profil alınamadı.");
      }

      // Backend alan adları farklı olabileceği için normalize ediyoruz:
      const dto: ProfileDto = {
        id: data.id ?? data.userId ?? undefined,
        name: data.name ?? data.firstName ?? null,
        surname: data.surname ?? data.lastName ?? null,
        email: data.email ?? data.userEmail ?? null,
        phone: data.phone ?? data.telephone ?? null,
        organization: data.organization ?? data.institution ?? data.company ?? null,
        workAddress: data.workAddress ?? data.workPlaceAddress ?? data.address ?? null,
        projectName: data.projectName ?? data.project?.name ?? data.project ?? null,
        role: data.role ?? null,
        createdAt: data.createdAt ?? data.registeredAt ?? data.created ?? null,
      };

      setProfile(dto);
    } catch (e: any) {
      // En azından AuthContext'ten gelen veriyi gösterelim
      setProfile(fallbackFromAuth);
      setSnack({
        open: true,
        msg: e?.response?.data?.message || "Profil bilgileri yüklenemedi (fallback gösteriliyor).",
        severity: "warning",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createdAtText = useMemo(() => {
    const raw = profile?.createdAt ?? fallbackFromAuth?.createdAt ?? null;
    if (!raw) return "—";
    const d = dayjs(raw);
    return d.isValid() ? d.format("DD.MM.YYYY") : "—";
  }, [profile, fallbackFromAuth]);

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <PersonIcon />
            <Typography variant="h6" fontWeight={800}>
              Profil
            </Typography>
          </Stack>

          <Button startIcon={<RefreshIcon />} onClick={loadProfile} disabled={loading}>
            Yenile
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {loading && !profile ? (
          <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={26} />
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* ÜST KART */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ md: "center" }}
              >
                <Stack spacing={0.5}>
                  <Typography fontWeight={900} sx={{ fontSize: 18 }}>
                    {fullName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {email}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={role === "admin" ? "Admin User" : role}
                    color={role === "admin" ? "primary" : "default"}
                    variant={role === "admin" ? "filled" : "outlined"}
                  />
                </Stack>
              </Stack>
            </Paper>

            {/* ALANLAR */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <TextField
                  label="Ad Soyad"
                  value={fullName}
                  InputProps={ro}
                  fullWidth
                />
                <TextField
                  label="E-Posta"
                  value={safe(profile?.email ?? fallbackFromAuth?.email)}
                  InputProps={ro}
                  fullWidth
                />
                <TextField
                  label="Telefon"
                  value={safe(profile?.phone ?? fallbackFromAuth?.phone)}
                  InputProps={ro}
                  fullWidth
                />
                <TextField
                  label="Kurum"
                  value={safe(profile?.organization ?? fallbackFromAuth?.organization)}
                  InputProps={ro}
                  fullWidth
                />
                <TextField
                  label="İş Yeri Adres"
                  value={safe(profile?.workAddress ?? fallbackFromAuth?.workAddress)}
                  InputProps={ro}
                  fullWidth
                />
                <TextField
                  label="Proje"
                  value={safe(profile?.projectName ?? fallbackFromAuth?.projectName)}
                  InputProps={ro}
                  fullWidth
                />
                <TextField
                  label="Kayıt Tarihi"
                  value={createdAtText}
                  InputProps={ro}
                  fullWidth
                />
                <TextField
                  label="Rol"
                  value={safe(profile?.role ?? fallbackFromAuth?.role)}
                  InputProps={ro}
                  fullWidth
                />
              </Box>
            </Paper>
          </Stack>
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
