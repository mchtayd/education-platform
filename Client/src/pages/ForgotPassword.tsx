// src/pages/ForgotPassword.tsx
import { Box, Paper, Stack, Typography, Grid, TextField, Button, Alert, Link } from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink } from "react-router-dom";
import { LockReset } from "@mui/icons-material";
import { useState } from "react";
import api from "../lib/api";

const schema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter"),
  surname: z.string().min(2, "Soyad en az 2 karakter"),
  email: z.string().email("Geçerli bir kurumsal e-posta girin"),
  phone: z
      .string()
      .min(10, "Telefon en az 10 haneli olmalı")
      .regex(/^[0-9\s()+-]{10,}$/, "Sadece rakam ve +()- boşluk karakterleri")
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", surname: "", email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null); setOk(null); setLoading(true);
    try {
      // Backend uç: ihtiyacına göre değiştir (ör: /api/Auth/forgot-password)
      await api.post("/Auth/forgot-password", {
        name: values.name,
        surname: values.surname,
        email: values.email,
      });
      setOk("Talebiniz alındı. Şifre sıfırlama talimatları e-posta adresinize gönderilecek.");
    } catch (e: any) {
      setServerError(
        e?.response?.data?.message ??
        e?.message ?? "İşlem başarısız. Lütfen bilgilerinizle tekrar deneyin."
      );
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
            Hesabınızı bulmak için bilgilerinizi girin.
          </Typography>

          {serverError && <Alert severity="error">{serverError}</Alert>}
          {ok && <Alert severity="success">{ok}</Alert>}

          <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Ad"
                  {...register("name")}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Soyad"
                  {...register("surname")}
                  error={!!errors.surname}
                  helperText={errors.surname?.message}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Kurumsal Mail Adresi"
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Telefon"
                  inputMode="tel"
                  placeholder="5xx xxx xx xx"
                  {...register("phone")}
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
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
                  {loading ? "Gönderiliyor…" : "Şifreyi Sıfırla"}
                </Button>
              </Grid>
              <Grid size={{ xs: 12 }} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Geri dönmek ister misiniz?{" "}
                  <Link component={RouterLink} to="/login" underline="hover">Giriş yap</Link>
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
