//AdminSettings.tsx
import { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  Stack,
  TextField,
  Button,
  Snackbar,
  Alert,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Visibility, VisibilityOff, Lock } from "@mui/icons-material";
import api from "../../lib/api";

export default function AdminSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);

  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error" | "info" | "warning";
  }>({ open: false, msg: "", severity: "info" });

  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  const validate = () => {
    if (!currentPassword.trim()) {
      setSnack({ open: true, msg: "Mevcut şifre zorunludur.", severity: "warning" });
      return false;
    }
    if (!newPassword.trim()) {
      setSnack({ open: true, msg: "Yeni şifre zorunludur.", severity: "warning" });
      return false;
    }
    if (newPassword.length < 6) {
      setSnack({ open: true, msg: "Yeni şifre en az 6 karakter olmalıdır.", severity: "warning" });
      return false;
    }
    if (newPassword !== newPassword2) {
      setSnack({ open: true, msg: "Yeni şifreler eşleşmiyor.", severity: "warning" });
      return false;
    }
    if (newPassword === currentPassword) {
      setSnack({ open: true, msg: "Yeni şifre mevcut şifre ile aynı olamaz.", severity: "warning" });
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const { data } = await api.post("/Account/change-password", {
        currentPassword,
        newPassword,
      });

      setSnack({ open: true, msg: data?.message || "Şifre güncellendi.", severity: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.response?.data?.message || "Şifre değiştirilemedi.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={800}>
        Ayarlar
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Paper variant="outlined" sx={{ p: 2.5, maxWidth: 720 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Lock fontSize="small" />
          <Typography fontWeight={900}>Şifre Değiştir</Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Güvenliğiniz için önce mevcut şifrenizi girin, ardından yeni şifreyi belirleyin.
        </Typography>

        <Stack spacing={1.5}>
          <TextField
            label="Mevcut Şifre"
            type={showCur ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowCur((s) => !s)} edge="end" aria-label="toggle current password">
                    {showCur ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Yeni Şifre"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            helperText="En az 6 karakter."
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNew((s) => !s)} edge="end" aria-label="toggle new password">
                    {showNew ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Yeni Şifre (Tekrar)"
            type={showNew2 ? "text" : "password"}
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNew2((s) => !s)} edge="end" aria-label="toggle new password repeat">
                    {showNew2 ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={submit}
              disabled={saving}
            >
              Kaydet
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={closeSnack}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
