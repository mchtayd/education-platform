import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Stack,
  Typography,
  Button,
  Alert,
  Snackbar,
  Divider,
  TextField,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { CloudUpload, Delete, SmartToy, Search, RestartAlt } from "@mui/icons-material";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type AiProvider = "ollama" | "gemini";

type DocItem = {
  id: number;
  fileName: string;
  sizeBytes?: number;
  uploadedAt?: string;
};

type AskResponse = {
  provider?: string;
  answer: string;
  sources?: Array<{
    docId: number;
    fileName: string;
    page?: number;
    chunkIndex?: number;
    score?: number;
    snippet?: string;
    text?: string;
  }>;
};

export default function AdminAiContent() {
  const ENDPOINTS = useMemo(
    () => ({
      list: "/AiDocs",
      upload: "/AiDocs/upload",
      reindex: (id: number) => `/AiDocs/${id}/reindex`,
      remove: (id: number) => `/AiDocs/${id}`,
      ask: "/AiQuery/ask",
    }),
    []
  );

  const { user } = useAuth();
  const role = String(user?.role ?? "").toLowerCase();

  // ✅ Yetki matrisi
  const canQuery = ["admin", "trainer", "educator", "user"].includes(role);
  const canManageDocs = ["admin", "trainer", "educator"].includes(role); // upload/sil/reindex + havuz sekmesi

  const [tab, setTab] = useState<"pool" | "ask">(canManageDocs ? "pool" : "ask");
  const [provider, setProvider] = useState<AiProvider>("gemini");

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState<number>(5);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<AskResponse["sources"]>([]);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity?: "success" | "error" | "warning" | "info";
  }>({ open: false, msg: "", severity: "info" });

  const normalizeDoc = (x: any): DocItem => ({
    id: x?.id ?? x?.Id,
    fileName: x?.fileName ?? x?.FileName,
    sizeBytes: x?.sizeBytes ?? x?.SizeBytes,
    uploadedAt: x?.uploadedAt ?? x?.UploadedAt,
  });

  const loadDocs = async () => {
    setLoadingDocs(true);
    try {
      const { data } = await api.get<any[]>(ENDPOINTS.list);
      setDocs((data ?? []).map(normalizeDoc));
    } catch (err: any) {
      setSnack({
        open: true,
        msg: err?.response?.data?.message ?? "Dokümanlar yüklenemedi.",
        severity: "error",
      });
    } finally {
      setLoadingDocs(false);
    }
  };

  // ✅ Sadece doküman yönetme yetkisi olanlar docs listesine gider
  useEffect(() => {
    if (canManageDocs) {
      loadDocs();
    } else {
      setDocs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageDocs]);

  // ✅ Yetkisiz role pool sekmesinde kalmasın
  useEffect(() => {
    if (!canManageDocs && tab === "pool") {
      setTab("ask");
    }
  }, [canManageDocs, tab]);

  const uploadOne = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);

    await api.post(`${ENDPOINTS.upload}?provider=${provider}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!canManageDocs) {
      setSnack({ open: true, msg: "Doküman yükleme yetkiniz yok.", severity: "warning" });
      return;
    }

    if (!files || files.length === 0) return;

    const picked = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (picked.length === 0) {
      setSnack({ open: true, msg: "Lütfen sadece PDF yükleyin.", severity: "warning" });
      return;
    }

    const tooBig = picked.find((f) => f.size > 50 * 1024 * 1024);
    if (tooBig) {
      setSnack({
        open: true,
        msg: `Dosya çok büyük: ${tooBig.name} (max 50MB)`,
        severity: "warning",
      });
      return;
    }

    setUploading(true);
    try {
      for (const f of picked) {
        await uploadOne(f);
      }
      setSnack({
        open: true,
        msg: `Doküman(lar) yüklendi ve ${provider.toUpperCase()} ile indexlendi.`,
        severity: "success",
      });
      await loadDocs();
    } catch (err: any) {
      setSnack({
        open: true,
        msg: err?.response?.data?.message ?? "Yükleme başarısız.",
        severity: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async (d: DocItem) => {
    if (!canManageDocs) {
      setSnack({ open: true, msg: "Doküman silme yetkiniz yok.", severity: "warning" });
      return;
    }

    if (!confirm(`${d.fileName} silinsin mi?`)) return;

    try {
      await api.delete(ENDPOINTS.remove(d.id));
      setSnack({ open: true, msg: "Doküman silindi.", severity: "success" });
      await loadDocs();
    } catch (err: any) {
      setSnack({
        open: true,
        msg: err?.response?.data?.message ?? "Silme başarısız.",
        severity: "error",
      });
    }
  };

  const reindexDoc = async (d: DocItem) => {
    if (!canManageDocs) {
      setSnack({ open: true, msg: "Reindex yetkiniz yok.", severity: "warning" });
      return;
    }

    try {
      await api.post(`${ENDPOINTS.reindex(d.id)}?provider=${provider}`);
      setSnack({
        open: true,
        msg: `Reindex tamam (${provider.toUpperCase()}).`,
        severity: "success",
      });
    } catch (err: any) {
      setSnack({
        open: true,
        msg: err?.response?.data?.message ?? "Reindex başarısız.",
        severity: "error",
      });
    }
  };

  const ask = async () => {
    if (!canQuery) {
      setSnack({ open: true, msg: "Sorgulama yetkiniz yok.", severity: "warning" });
      return;
    }

    const q = question.trim();
    if (!q) return;

    setAsking(true);
    setAnswer(null);
    setSources([]);

    try {
      const body = {
        question: q,
        topK: topK > 0 ? topK : 8,
        provider,
      };

      const { data } = await api.post<AskResponse>(ENDPOINTS.ask, body);
      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch (err: any) {
  setSnack({
    open: true,
    msg:
      err?.response?.data?.message ??
      (typeof err?.response?.data === "string" ? err.response.data : null) ??
      err?.message ??
      "Sorgu sırasında hata oluştu.",
    severity: "error",
  });
} finally {
      setAsking(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1 }}>
          <SmartToy />
          <Typography variant="h6" fontWeight={700}>
            AI İçerik Sorgulama
          </Typography>
        </Stack>

        {/* ✅ Provider switch */}
        <Stack direction="row" justifyContent="center" sx={{ mb: 2 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={provider}
            onChange={(_, v) => v && setProvider(v)}
          >
            <ToggleButton value="ollama">Ollama</ToggleButton>
            <ToggleButton value="gemini">Gemini</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          {canManageDocs && <Tab value="pool" label="Doküman Havuzu" />}
          <Tab value="ask" label="Sorgulama" />
        </Tabs>

        <Divider sx={{ mb: 2 }} />

        {/* ✅ User query-only bilgi */}
        {!canManageDocs && canQuery && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Bu alanda sadece <b>sorgulama</b> yapabilirsiniz. Doküman yükleme / silme / yeniden indexleme
            yetkiniz yok.
          </Alert>
        )}

        {/* ✅ Pool sadece yetkililere */}
        {tab === "pool" && canManageDocs && (
          <Stack spacing={2}>
            <Alert severity="info">
              Buraya yüklediğin PDF’ler havuza eklenir ve seçili sağlayıcıya göre indexlenir.
            </Alert>

            <Alert severity="warning">
              Sağlayıcıyı (Ollama ↔ Gemini) değiştirirsen, doğru sonuç için dokümanları <b>yeniden indexle</b>.
            </Alert>

            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  component="label"
                  variant="contained"
                  startIcon={uploading ? <CircularProgress size={18} /> : <CloudUpload />}
                  disabled={uploading}
                >
                  {uploading ? "Yükleniyor…" : `PDF Yükle (${provider.toUpperCase()})`}
                  <input
                    hidden
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    onChange={(e) => onPickFiles(e.target.files)}
                  />
                </Button>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                  <Button variant="text" onClick={loadDocs} disabled={loadingDocs}>
                    Yenile
                  </Button>
                  <Chip label={`${docs.length} doküman`} />
                  <Chip size="small" color="primary" label={`Aktif: ${provider}`} />
                </Stack>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 1 }}>
              {loadingDocs ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2 }}>
                  <CircularProgress size={18} />
                  <Typography>Yükleniyor…</Typography>
                </Stack>
              ) : docs.length === 0 ? (
                <Typography sx={{ p: 2 }} color="text.secondary">
                  Henüz doküman yok.
                </Typography>
              ) : (
                <List dense>
                  {docs.map((d) => (
                    <ListItem
                      key={d.id}
                      secondaryAction={
                        <Stack direction="row" spacing={1}>
                          <IconButton edge="end" onClick={() => reindexDoc(d)} title={`Reindex (${provider})`}>
                            <RestartAlt />
                          </IconButton>
                          <IconButton edge="end" color="error" onClick={() => removeDoc(d)} title="Sil">
                            <Delete />
                          </IconButton>
                        </Stack>
                      }
                    >
                      <ListItemText
                        primary={d.fileName}
                        secondary={[
                          d.uploadedAt ? `Yüklenme: ${d.uploadedAt}` : null,
                          d.sizeBytes ? `Boyut: ${(d.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : null,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Stack>
        )}

        {tab === "ask" && (
          <Stack spacing={2}>
            <Alert severity="warning">
              Cevaplar yalnızca yüklenen PDF’lerden üretilir. Dokümanlarda bilgi yoksa sistem “Bulunamadı” der.
              <br />
              <b>TopK</b>: Sorudan sonra en benzer kaç metin parçasının (chunk) modele verileceğini belirler.
              (Genelde 4–8 iyi başlangıçtır.)
            </Alert>

            <Alert severity="info">
              Şu an seçili sağlayıcı: <b>{provider.toUpperCase()}</b>. Eğer farklı sağlayıcıyla indexlediysen önce
              reindex yap.
            </Alert>

            <TextField
              label="Sorunuz"
              placeholder="Örn: Termal kamera nedir?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              multiline
              minRows={3}
            />

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <TextField
                label="TopK"
                type="number"
                size="small"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                sx={{ width: 120 }}
                inputProps={{ min: 1, max: 20 }}
              />

              <Button
                variant="contained"
                startIcon={asking ? <CircularProgress size={18} /> : <Search />}
                onClick={ask}
                disabled={asking || !canQuery || (canManageDocs && docs.length === 0)}
              >
                {asking ? "Sorgulanıyor…" : "Sorgula"}
              </Button>

              {canManageDocs && docs.length === 0 && <Chip color="warning" label="Önce doküman yükleyin" />}
            </Stack>

            {answer && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  Cevap
                </Typography>
                <Typography sx={{ whiteSpace: "pre-wrap" }}>{answer}</Typography>

                {sources && sources.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Kaynaklar
                    </Typography>
                    <Stack spacing={1}>
                      {sources.map((s, idx) => (
                        <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip size="small" label={s.fileName} />
                            {typeof s.page === "number" && <Chip size="small" label={`Sayfa: ${s.page}`} />}
                            {typeof s.chunkIndex === "number" && (
                              <Chip size="small" label={`Parça: ${s.chunkIndex}`} />
                            )}
                            {typeof s.score === "number" && (
                              <Chip size="small" label={`Skor: ${s.score.toFixed(3)}`} />
                            )}
                          </Stack>

                          {(s.text || s.snippet) && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1, whiteSpace: "pre-wrap" }}
                            >
                              {s.text ?? s.snippet}
                            </Typography>
                          )}
                        </Paper>
                      ))}
                    </Stack>
                  </>
                )}
              </Paper>
            )}
          </Stack>
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity || "info"}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}