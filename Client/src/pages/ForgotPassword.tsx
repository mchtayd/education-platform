import {
  Box, Paper, Stack, Typography, Grid, TextField, Button, Alert, Link
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { LockReset } from "@mui/icons-material";
import { useState } from "react";
import api from "../lib/api";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type Step = 1 | 2 | 3;

const step1Schema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
});

const step2Schema = z.object({
  code: z.string().min(4, "Kod gerekli"),
});

const step3Schema = z.object({
  newPassword: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  newPassword2: z.string().min(6, "Şifre tekrarı gerekli"),
}).refine((x) => x.newPassword === x.newPassword2, {
  message: "Şifreler aynı olmalı",
  path: ["newPassword2"],
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;
type Step3Values = z.infer<typeof step3Schema>;

type CheckResp = { exists: boolean; isActive?: boolean; hasPendingRequest?: boolean };
type SendCodeResp = { exists: boolean; message?: string; verificationId?: number; expiresAt?: string };
type VerifyResp = { message?: string; verificationId: number; resetToken: string };
type ResetResp = { message?: string };

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>(1);

  const [serverError, setServerError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // akış state
  const [email, setEmail] = useState<string>("");
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const f1 = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { email: "" },
  });

  const f2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { code: "" },
  });

  const f3 = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: { newPassword: "", newPassword2: "" },
  });

  const sendCode = async (values: Step1Values) => {
    setServerError(null); setOk(null); setLoading(true);
    try {
      const mail = values.email.trim();
      setEmail(mail);

      // 1) kullanıcı var mı (opsiyonel ama net hata mesajı için iyi)
      const check = await api.post<CheckResp>("/Auth/forgot-password/check", { email: mail });
      if (!check.data.exists) {
        if (check.data.hasPendingRequest) {
          setServerError("Bu e-posta ile bir hesap talebi var; hesap henüz aktif değil olabilir (admin onayı).");
        } else {
          setServerError("Bu e-posta ile kayıtlı kullanıcı bulunamadı.");
        }
        return;
      }
      if (check.data.isActive === false) {
        setServerError("Bu hesap aktif değil. Lütfen admin onayını bekleyin.");
        return;
      }

      // 2) kod gönder
      const res = await api.post<SendCodeResp>("/Auth/forgot-password/send-code", { email: mail });

      if (res.data.exists === false) {
        setServerError(res.data.message ?? "Bu e-posta ile kayıtlı kullanıcı bulunamadı.");
        return;
      }

      if (!res.data.verificationId) {
        setServerError("Sunucu verificationId dönmedi.");
        return;
      }

      setVerificationId(res.data.verificationId);
      setOk("Kod gönderildi. E-postanı kontrol et (spam/junk dahil).");
      setStep(2);
    } catch (e: any) {
      setServerError(e?.response?.data?.message ?? e?.message ?? "İşlem başarısız.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (values: Step2Values) => {
    setServerError(null); setOk(null); setLoading(true);
    try {
      if (!verificationId) {
        setServerError("verificationId bulunamadı. Baştan kod isteyin.");
        setStep(1);
        return;
      }

      const res = await api.post<VerifyResp>("/Auth/forgot-password/verify-code", {
        verificationId,
        email,
        code: values.code.trim(),
      });

      setResetToken(res.data.resetToken);
      setOk("Kod doğrulandı. Yeni şifre belirleyebilirsiniz.");
      setStep(3);
    } catch (e: any) {
      setServerError(e?.response?.data?.message ?? e?.message ?? "Kod doğrulama başarısız.");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (values: Step3Values) => {
    setServerError(null); setOk(null); setLoading(true);
    try {
      if (!verificationId || !resetToken) {
        setServerError("Reset bilgileri eksik. Baştan deneyin.");
        setStep(1);
        return;
      }

      const res = await api.post<ResetResp>("/Auth/forgot-password/reset", {
        verificationId,
        email,
        resetToken,
        newPassword: values.newPassword,
      });

      setOk(res.data.message ?? "Şifre güncellendi. Giriş yapabilirsiniz.");
      setStep(1);

      // temizlik
      setVerificationId(null);
      setResetToken(null);
      f1.reset({ email: "" });
      f2.reset({ code: "" });
      f3.reset({ newPassword: "", newPassword2: "" });
    } catch (e: any) {
      setServerError(e?.response?.data?.message ?? e?.message ?? "Şifre sıfırlama başarısız.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, md: 6 },
        py: { xs: 4, md: 0 },
        background: "radial-gradient(1200px 600px at -20% -20%, rgba(14,165,233,0.06), transparent)",
      }}
    >
      <Paper elevation={8} sx={{ p: 4, width: "100%", maxWidth: 560, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h4" fontWeight={700}>Şifremi Unuttum</Typography>
          <Typography color="text.secondary">
            {step === 1 && "E-postanı gir, sana doğrulama kodu gönderelim."}
            {step === 2 && "E-postana gelen kodu gir."}
            {step === 3 && "Yeni şifreni belirle."}
          </Typography>

          {serverError && <Alert severity="error">{serverError}</Alert>}
          {ok && <Alert severity="success">{ok}</Alert>}

          {step === 1 && (
            <Box component="form" noValidate onSubmit={f1.handleSubmit(sendCode)}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Kurumsal Mail Adresi"
                    type="email"
                    autoComplete="email"
                    {...f1.register("email")}
                    error={!!f1.formState.errors.email}
                    helperText={f1.formState.errors.email?.message}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<LockReset />}
                    disabled={loading}
                    sx={{ py: 1.2 }}
                    fullWidth
                  >
                    {loading ? "Gönderiliyor…" : "Kod Gönder"}
                  </Button>
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <Typography variant="body2" color="text.secondary">
                    Geri dönmek ister misiniz?{" "}
                    <Link component={RouterLink} to="/login" underline="hover">Giriş yap</Link>
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          {step === 2 && (
            <Box component="form" noValidate onSubmit={f2.handleSubmit(verifyCode)}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }} >
                  <TextField fullWidth label="E-posta" value={email} disabled />
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <TextField
                    fullWidth
                    label="Doğrulama Kodu"
                    placeholder="123456"
                    {...f2.register("code")}
                    error={!!f2.formState.errors.code}
                    helperText={f2.formState.errors.code?.message}
                  />
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{ py: 1.2 }}
                    fullWidth
                  >
                    {loading ? "Doğrulanıyor…" : "Kodu Doğrula"}
                  </Button>
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <Button
                    variant="text"
                    disabled={loading}
                    fullWidth
                    onClick={() => { setStep(1); setOk(null); setServerError(null); }}
                  >
                    Geri
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}

          {step === 3 && (
            <Box component="form" noValidate onSubmit={f3.handleSubmit(doReset)}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }} >
                  <TextField fullWidth label="E-posta" value={email} disabled />
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <TextField
                    fullWidth
                    label="Yeni Şifre"
                    type="password"
                    {...f3.register("newPassword")}
                    error={!!f3.formState.errors.newPassword}
                    helperText={f3.formState.errors.newPassword?.message}
                  />
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <TextField
                    fullWidth
                    label="Yeni Şifre (Tekrar)"
                    type="password"
                    {...f3.register("newPassword2")}
                    error={!!f3.formState.errors.newPassword2}
                    helperText={f3.formState.errors.newPassword2?.message}
                  />
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{ py: 1.2 }}
                    fullWidth
                  >
                    {loading ? "Kaydediliyor…" : "Şifreyi Güncelle"}
                  </Button>
                </Grid>

                <Grid size={{ xs: 12 }} >
                  <Button
                    variant="text"
                    disabled={loading}
                    fullWidth
                    onClick={() => { setStep(2); setOk(null); setServerError(null); }}
                  >
                    Geri
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
