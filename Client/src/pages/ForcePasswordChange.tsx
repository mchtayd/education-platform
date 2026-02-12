// pages/ForcePasswordChange.tsx (senin dosya adın neyse)
import { useState } from "react";
import {
  Box, Paper, Typography, Divider, Stack, TextField, Button,
  Snackbar, Alert, IconButton, InputAdornment
} from "@mui/material";
import { Visibility, VisibilityOff, Lock } from "@mui/icons-material";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForcePasswordChange() {
  const { user, updateUser, signOut } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);

  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" | "warning" | "info" }>(
    { open: false, msg: "", severity: "info" }
  );

  const closeSnack = () => setSnack(s => ({ ...s, open: false }));

  const validate = () => {
    if (!currentPassword.trim()) return setSnack({ open: true, msg: "Mevcut şifre zorunludur.", severity: "warning" }), false;
    if (!newPassword.trim()) return setSnack({ open: true, msg: "Yeni şifre zorunludur.", severity: "warning" }), false;
    if (newPassword.length < 6) return setSnack({ open: true, msg: "Yeni şifre en az 6 karakter olmalıdır.", severity: "warning" }), false;
    if (newPassword !== newPassword2) return setSnack({ open: true, msg: "Yeni şifreler eşleşmiyor.", severity: "warning" }), false;
    if (newPassword === currentPassword) return setSnack({ open: true, msg: "Yeni şifre mevcut şifre ile aynı olamaz.", severity: "warning" }), false;
    return true;
  };

  const submit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const { data } = await api.post("/api/Account/change-password", {
        currentPassword,
        newPassword,
      });

      // ✅ kritik: artık client tarafında zorunluluk kapansın
      updateUser({ mustChangePassword: false });

      setSnack({ open: true, msg: data?.message || "Şifre güncellendi.", severity: "success" });

      // ✅ role’e göre yönlendir
      const role = String(user?.role ?? "").toLowerCase();
      const to = (role === "admin" || role === "trainer" || role === "educator") ? "/admin" : "/app";
      navigate(to, { replace: true });
    } catch (e: any) {
      // token invalid olduysa
      if (e?.response?.status === 401) {
        signOut();
        navigate("/login", { replace: true });
        return;
      }
      setSnack({ open: true, msg: e?.response?.data?.message || "Şifre değiştirilemedi.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Paper variant="outlined" sx={{ p: 3, width: "100%", maxWidth: 520 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Lock fontSize="small" />
          <Typography fontWeight={900}>İlk Giriş: Şifre Değiştir</Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Güvenlik için ilk girişte şifrenizi değiştirmeniz zorunludur.
        </Typography>

        <Divider sx={{ mb: 2 }} />

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
                  <IconButton onClick={() => setShowCur(s => !s)} edge="end">
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
                  <IconButton onClick={() => setShowNew(s => !s)} edge="end">
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
                  <IconButton onClick={() => setShowNew2(s => !s)} edge="end">
                    {showNew2 ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={submit} disabled={saving}>
              Kaydet ve Devam Et
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={closeSnack} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={snack.severity} variant="filled" onClose={closeSnack}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
