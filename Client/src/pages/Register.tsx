import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  FormControl,
  Alert,
  Link,
  Snackbar,
  Divider,
} from "@mui/material";
import { HowToReg } from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import api from "../lib/api";

type InstitutionDto = { id: number; name: string };

// -----------------------------
// Form schema
// -----------------------------
const schema = z
  .object({
    name: z.string().min(2, "Ad en az 2 karakter olmalı"),
    surname: z.string().min(2, "Soyad en az 2 karakter olmalı"),
    email: z.string().email("Geçerli bir e-posta girin"),
    phone: z
      .string()
      .min(10, "Telefon en az 10 haneli olmalı")
      .regex(/^[0-9\s()+-]{10,}$/, "Sadece rakam ve +()- boşluk karakterleri"),
    institution: z.string().min(1, "Kurum seçiniz"),
    businessAddress: z.string().min(3, "İş yeri adresi zorunlu"),
    password: z.string().min(6, "Parola en az 6 karakter olmalı"),
    passwordConfirm: z.string().min(6, "Parola tekrarı zorunlu"),
    kvkkAccepted: z.boolean().refine((v) => v === true, {
      message: "Aydınlatma metni ve açık rıza onayı zorunludur",
    }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Parolalar eşleşmiyor",
  });

type FormValues = z.infer<typeof schema>;

// -----------------------------
// Verify code schema
// -----------------------------
const codeSchema = z.object({
  code: z
    .string()
    .min(4, "Kod en az 4 karakter olmalı")
    .max(8, "Kod en fazla 8 karakter olmalı")
    .regex(/^[0-9]+$/, "Kod sadece rakam olmalı"),
});
type CodeForm = z.infer<typeof codeSchema>;

// TR uyumlu büyük harf
const toUpperTr = (s: string) => (s ?? "").toLocaleUpperCase("tr-TR");

// KVKK metinleri
const KVKK_FULL_TEXT = `MÜŞTERİ MEMNUNİYETİ ÖLÇÜMÜ AMACIYLA KİŞİSEL VERİLERİN İŞLENMESİ AYDINLATMA METNİ

a) Veri Sorumlusu ve Temsilcisi

ŞİRKET kişisel verilerinizin güvenliği hususuna azami hassasiyet göstermektedir. ...`;

const KVKK_OKUDUM_TEXT =
  "Projeler/işler kapsamında tarafıma sunulan Ürüne/Hizmete İlişkin Müşteri Memnuniyeti Ölçümü Amacıyla Kişisel Verilerin İşlenmesi Aydınlatma Metni’ni okudum, anladım.";

const KVKK_ACIK_RIZA_TEXT =
  "ŞİRKET tarafından verilen ürüne/hizmete ilişkin memnuniyet anketi ve geri bildirimi yapılması ve bu amaçla sınırlı olarak tarafımla iletişime geçilebilmesi amacıyla aşağıda belirttiğim kimlik ve iletişim bilgilerimin işlenmesini kabul ediyorum.";

type SendRegisterCodeResponse = {
  message?: string;
  verificationId: number;
  expiresAt?: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();

  const [openKvkk, setOpenKvkk] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity?: "success" | "error" | "info";
  }>({ open: false, msg: "", severity: "success" });

  const [institutions, setInstitutions] = useState<InstitutionDto[]>([]);
  const [instLoading, setInstLoading] = useState(false);
  const [instError, setInstError] = useState<string | null>(null);

  // KVKK dialog içi zorunlu onaylar
  const [kvkkReadOk, setKvkkReadOk] = useState(false);
  const [kvkkConsentOk, setKvkkConsentOk] = useState(false);

  // Email doğrulama dialog
  const [openVerify, setOpenVerify] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // resend timer
  const [resendLeft, setResendLeft] = useState(0);

  // kayıt isteğinde kullanılacak “pending” form değerleri
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  // ✅ send-register-code dönüşündeki verificationId burada tutulacak
  const [verificationId, setVerificationId] = useState<number | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      surname: "",
      email: "",
      phone: "",
      institution: "",
      businessAddress: "",
      password: "",
      passwordConfirm: "",
      kvkkAccepted: false,
    },
  });

  const {
    control: codeControl,
    handleSubmit: handleCodeSubmit,
    reset: resetCode,
    formState: { errors: codeErrors },
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  // -----------------------------
  // KVKK dialog handlers
  // -----------------------------
  const closeKvkk = () => {
    setOpenKvkk(false);
    setKvkkReadOk(false);
    setKvkkConsentOk(false);
  };

  const approveKvkk = () => {
    if (!kvkkReadOk || !kvkkConsentOk) return;
    setValue("kvkkAccepted", true, { shouldValidate: true });
    setOpenKvkk(false);
  };

  // -----------------------------
  // resend timer
  // -----------------------------
  const startResendTimer = (sec: number) => setResendLeft(sec);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = setInterval(() => setResendLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendLeft]);

  // -----------------------------
  // API calls
  // -----------------------------
  const sendRegisterCode = async (email: string) => {
    setVerifyError(null);
    setSendingCode(true);

    try {
      const { data } = await api.post<SendRegisterCodeResponse>(
        "/api/Auth/send-register-code",
        { email }
      );

      // ✅ verificationId burada alınıp saklanıyor
      setVerificationId(data.verificationId);

      setSnack({
        open: true,
        msg: "Doğrulama kodu e-posta adresinize gönderildi.",
        severity: "info",
      });

      startResendTimer(60);
    } catch (e: any) {
      setVerifyError(
        e?.response?.data?.message ?? e?.message ?? "Doğrulama kodu gönderilemedi."
      );
      throw e;
    } finally {
      setSendingCode(false);
    }
  };

  const doRegister = async (values: FormValues) => {
    await api.post("/api/Auth/register", {
      name: toUpperTr(values.name),
      surname: toUpperTr(values.surname),
      email: (values.email ?? "").trim().toLowerCase(),
      phone: values.phone,
      institution: values.institution,
      businessAddress: toUpperTr(values.businessAddress),
      password: values.password,
      projectId: null,
      kvkkAccepted: values.kvkkAccepted,
    });
  };

  // -----------------------------
  // Main submit
  // -----------------------------
  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setVerifyError(null);

    const email = (values.email ?? "").trim().toLowerCase();

    try {
      setPendingValues(values);
      await sendRegisterCode(email);

      resetCode({ code: "" });
      setOpenVerify(true);
    } catch (e: any) {
      setServerError(e?.response?.data?.message ?? e?.message ?? "İşlem başlatılamadı.");
    }
  };

  // -----------------------------
  // Verify code submit
  // -----------------------------
  const onVerifySubmit = async (data: CodeForm) => {
    if (!pendingValues) return;
    if (!verificationId) {
      setVerifyError("Doğrulama oturumu bulunamadı. Lütfen tekrar kod isteyin.");
      return;
    }

    setVerifyError(null);
    setVerifying(true);

    const email = (pendingValues.email ?? "").trim().toLowerCase();
    const code = (data.code ?? "").trim();

    try {
      // ✅ verificationId artık gönderiliyor
      await api.post("/api/Auth/verify-register-code", {
        verificationId,
        email,
        code,
      });

      await doRegister(pendingValues);

      setSnack({
        open: true,
        msg: "Doğrulama başarılı. Hesap oluşturma talebiniz iletildi.",
        severity: "success",
      });

      // temizle
      setOpenVerify(false);
      setPendingValues(null);
      setVerificationId(null);

      reset({
        name: "",
        surname: "",
        email: "",
        phone: "",
        institution: "",
        businessAddress: "",
        password: "",
        passwordConfirm: "",
        kvkkAccepted: false,
      });

      setTimeout(() => {
        navigate("/login", { state: { registered: true }, replace: true });
      }, 1500);
    } catch (e: any) {
      setVerifyError(e?.response?.data?.message ?? e?.message ?? "Kod doğrulanamadı.");
    } finally {
      setVerifying(false);
    }
  };

  const closeVerifyDialog = () => {
    setOpenVerify(false);
    setVerifyError(null);
    setPendingValues(null);
    setVerificationId(null);
    resetCode({ code: "" });
  };

  const resendCode = async () => {
    if (!pendingValues) return;
    if (resendLeft > 0) return;

    const email = (pendingValues.email ?? "").trim().toLowerCase();
    try {
      await sendRegisterCode(email); // ✅ yeni verificationId gelirse state güncellenir
    } catch {
      // verifyError zaten setleniyor
    }
  };

  // -----------------------------
  // Load institutions
  // -----------------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      setInstLoading(true);
      setInstError(null);

      try {
        const { data } = await api.get<InstitutionDto[]>("/api/Institutions");
        if (!alive) return;

        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, "tr"));
        setInstitutions(sorted);
      } catch {
        if (!alive) return;
        setInstitutions([]);
        setInstError("Kurum listesi yüklenemedi.");
      } finally {
        if (alive) setInstLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

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
      <Paper elevation={8} sx={{ p: 4, width: "100%", maxWidth: 720, borderRadius: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h4" fontWeight={700}>
            Hesap Oluştur
          </Typography>
          <Typography color="text.secondary">Lütfen bilgilerinizi doldurun.</Typography>

          {serverError && <Alert severity="error">{serverError}</Alert>}

          <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)} autoComplete="off">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      fullWidth
                      label="Ad"
                      value={field.value}
                      onChange={(e) => field.onChange(toUpperTr(e.target.value))}
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      inputProps={{ style: { textTransform: "uppercase" } }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="surname"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      fullWidth
                      label="Soyad"
                      value={field.value}
                      onChange={(e) => field.onChange(toUpperTr(e.target.value))}
                      error={!!errors.surname}
                      helperText={errors.surname?.message}
                      inputProps={{ style: { textTransform: "uppercase" } }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      fullWidth
                      label="Kurumsal Mail"
                      type="email"
                      autoComplete="email"
                      value={field.value}
                      onChange={(e) => field.onChange((e.target.value ?? "").toLowerCase())}
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      fullWidth
                      label="Telefon"
                      inputMode="tel"
                      placeholder="5xx xxx xx xx"
                      value={field.value}
                      onChange={(e) => field.onChange(toUpperTr(e.target.value))}
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                      inputProps={{ style: { textTransform: "uppercase" } }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth error={!!errors.institution || !!instError}>
                  <InputLabel id="institution-label">Kurum</InputLabel>

                  <Controller
                    name="institution"
                    control={control}
                    render={({ field }) => (
                      <Select
                        labelId="institution-label"
                        label="Kurum"
                        fullWidth
                        {...field}
                        disabled={instLoading}
                      >
                        <MenuItem value="">
                          <em>{instLoading ? "Yükleniyor..." : "(Seçiniz)"}</em>
                        </MenuItem>

                        {institutions.map((k) => (
                          <MenuItem key={k.id} value={k.name}>
                            {k.name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />

                  {errors.institution && <FormHelperText>{errors.institution.message}</FormHelperText>}
                  {!errors.institution && instError && <FormHelperText>{instError}</FormHelperText>}
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="businessAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      fullWidth
                      label="İş Yeri Adresi"
                      value={field.value}
                      onChange={(e) => field.onChange(toUpperTr(e.target.value))}
                      error={!!errors.businessAddress}
                      helperText={errors.businessAddress?.message}
                      inputProps={{ style: { textTransform: "uppercase" } }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Parola"
                  type="password"
                  autoComplete="new-password"
                  {...register("password")}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Parola Tekrarı"
                  type="password"
                  autoComplete="new-password"
                  tabIndex={-1}
                  {...register("passwordConfirm")}
                  error={!!errors.passwordConfirm}
                  helperText={errors.passwordConfirm?.message}
                />
              </Grid>

              {/* KVKK */}
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="kvkkAccepted"
                  control={control}
                  render={({ field }) => (
                    <>
                      <FormControl error={!!errors.kvkkAccepted} component="fieldset" variant="standard" fullWidth>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={!!field.value}
                              onChange={(e) => {
                                const next = e.target.checked;
                                if (next) {
                                  setKvkkReadOk(false);
                                  setKvkkConsentOk(false);
                                  setOpenKvkk(true);
                                } else {
                                  field.onChange(false);
                                  setKvkkReadOk(false);
                                  setKvkkConsentOk(false);
                                }
                              }}
                            />
                          }
                          label="KVKK metnini okudum, onaylıyorum."
                        />
                        {errors.kvkkAccepted && <FormHelperText>{errors.kvkkAccepted.message}</FormHelperText>}
                      </FormControl>

                      <Dialog open={openKvkk} onClose={closeKvkk} maxWidth="md" fullWidth>
                        <DialogTitle>KVKK Aydınlatma Metni</DialogTitle>
                        <DialogContent dividers>
                          <Stack spacing={1.5}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              component="div"
                              sx={{ whiteSpace: "pre-line" }}
                            >
                              {KVKK_FULL_TEXT}
                            </Typography>

                            <Divider />

                            <Stack spacing={1}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={kvkkReadOk}
                                    onChange={(e) => setKvkkReadOk(e.target.checked)}
                                  />
                                }
                                label={
                                  <Typography variant="body2" component="div">
                                    {KVKK_OKUDUM_TEXT}
                                  </Typography>
                                }
                              />

                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={kvkkConsentOk}
                                    onChange={(e) => setKvkkConsentOk(e.target.checked)}
                                  />
                                }
                                label={
                                  <Typography variant="body2" component="div">
                                    {KVKK_ACIK_RIZA_TEXT}
                                  </Typography>
                                }
                              />

                              <Typography variant="caption" color="text.secondary" component="div">
                                * Devam etmek için yukarıdaki iki kutucuğun da işaretlenmesi zorunludur.
                              </Typography>
                            </Stack>
                          </Stack>
                        </DialogContent>

                        <DialogActions>
                          <Button onClick={closeKvkk}>Vazgeç</Button>
                          <Button variant="contained" onClick={approveKvkk} disabled={!kvkkReadOk || !kvkkConsentOk}>
                            Onayla
                          </Button>
                        </DialogActions>
                      </Dialog>
                    </>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<HowToReg />}
                  disabled={sendingCode || verifying}
                  sx={{ py: 1.2 }}
                  fullWidth
                >
                  {sendingCode ? "Kod gönderiliyor…" : "Kayıt Ol"}
                </Button>
              </Grid>

              <Grid size={{ xs: 12 }} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Zaten hesabın var mı?{" "}
                  <Link component={RouterLink} to="/login" underline="hover">
                    Giriş yap
                  </Link>
                </Typography>
              </Grid>
            </Grid>

            {/* EMAIL DOĞRULAMA DIALOG */}
            <Dialog open={openVerify} onClose={closeVerifyDialog} maxWidth="xs" fullWidth>
              <DialogTitle>E-posta Doğrulama</DialogTitle>
              <DialogContent dividers>
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    {pendingValues?.email
                      ? `${(pendingValues.email ?? "").trim().toLowerCase()} adresine bir doğrulama kodu gönderdik.`
                      : "E-posta adresinize bir doğrulama kodu gönderdik."}
                  </Typography>

                  {verifyError && <Alert severity="error">{verifyError}</Alert>}

                  <Controller
                    name="code"
                    control={codeControl}
                    render={({ field }) => (
                      <TextField
                        fullWidth
                        label="Doğrulama Kodu"
                        value={field.value}
                        onChange={(e) => field.onChange((e.target.value ?? "").replace(/\s+/g, ""))}
                        error={!!codeErrors.code}
                        helperText={codeErrors.code?.message ?? " "}
                        inputProps={{ inputMode: "numeric", maxLength: 8 }}
                      />
                    )}
                  />

                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      {resendLeft > 0 ? `Tekrar gönder (${resendLeft}s)` : "Kod gelmedi mi?"}
                    </Typography>

                    <Button size="small" onClick={resendCode} disabled={resendLeft > 0 || sendingCode}>
                      {sendingCode ? "Gönderiliyor…" : "Tekrar Gönder"}
                    </Button>
                  </Stack>
                </Stack>
              </DialogContent>

              <DialogActions>
                <Button onClick={closeVerifyDialog}>İptal</Button>
                <Button
                  variant="contained"
                  onClick={handleCodeSubmit(onVerifySubmit)}
                  disabled={verifying || !verificationId}
                >
                  {verifying ? "Doğrulanıyor…" : "Onayla ve Devam Et"}
                </Button>
              </DialogActions>
            </Dialog>

            <Snackbar
              open={snack.open}
              autoHideDuration={3000}
              onClose={() => setSnack((s) => ({ ...s, open: false }))}
              anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
              <Alert
                severity={snack.severity ?? "success"}
                variant="filled"
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
              >
                {snack.msg}
              </Alert>
            </Snackbar>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
