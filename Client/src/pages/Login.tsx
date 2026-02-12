import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Alert,
  Link,
} from "@mui/material";
import { Visibility, VisibilityOff, Login as LoginIcon } from "@mui/icons-material";
import { Link as RouterLink, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const schema = z.object({
  email: z.string().min(1, "E-posta zorunlu").email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "En az 6 karakter"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = Boolean((location.state as any)?.registered);

  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (isAuthenticated && user) {
  if (user.mustChangePassword) {
    return <Navigate to="/force-password" replace />;
  }

  const role = String(user.role ?? "").toLowerCase();
  const to = (role === "admin" || role === "trainer" || role === "educator") ? "/admin" : "/app";
  return <Navigate to={to} replace />;
}


  const onSubmit = async (values: FormValues) => {
    setError(null);
    setLoading(true);
    try {
      const me = await signIn(values.email, values.password);
      if (me.mustChangePassword) {
        navigate("/force-password", { replace: true });
        return;
      }
      const role = String(me.role ?? "").toLowerCase();
      navigate((role === "admin" || role === "trainer" || role === "educator") ? "/admin" : "/app", { replace: true });
      
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Giriş başarısız. Bilgilerinizi kontrol edin.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCapsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState && e.getModifierState("CapsLock"));
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
        background:
          "radial-gradient(1200px 600px at -20% -20%, rgba(14,165,233,0.06), transparent)",
      }}
    >
      <Paper elevation={8} sx={{ p: 4, width: "100%", maxWidth: 420, borderRadius: 4 }}>
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={700}>
              Eğitim Platformu
            </Typography>
            <Typography color="text.secondary">Hesabınıza giriş yapın</Typography>
          </Stack>

          {justRegistered && (
            <Alert severity="success">
              Admin onayından sonra giriş yapabilirsiniz.
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Stack
            component="form"
            spacing={2}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            autoComplete="off"
          >
            <TextField
              label="E-posta"
              type="email"
              autoComplete="email"
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register("email")}
            />

            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
            />
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              tabIndex={-1}
              aria-hidden="true"
              style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
            />

            <TextField
              label="Şifre"
              type={showPassword ? "text" : "password"}
              autoComplete="off"
              inputProps={{
                autoComplete: "new-password",
                "data-lpignore": "true",
                "data-1p-ignore": "true",
                "data-bwignore": "true",
                "aria-autocomplete": "none",
                spellCheck: false,
                autoCorrect: "off",
                autoCapitalize: "off",
              } as any}
              onFocus={(e) => {
                e.currentTarget.setAttribute("name", "auth-password-" + Date.now());
                e.currentTarget.setAttribute("autocomplete", "new-password");
              }}
              onKeyDown={handleCapsCheck}
              onKeyUp={handleCapsCheck}
              error={!!errors.password}
              helperText={errors.password?.message || (capsOn ? "Caps Lock açık" : undefined)}
              {...register("password")}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="şifreyi göster/gizle"
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Link component={RouterLink} to="/forgot-password" underline="hover" color="primary">
                Şifremi unuttum
              </Link>
            </Stack>

            <Button
              type="submit"
              variant="contained"
              startIcon={<LoginIcon />}
              disabled={loading}
              sx={{ py: 1.2 }}
            >
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Hesabın yok mu?{" "}
              <Link component={RouterLink} to="/register" underline="hover">
                Hesap Oluştur
              </Link>
            </Typography>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Güvenlik için güçlü bir şifre kullanın.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
