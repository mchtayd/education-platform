// src/pages/users/UserTrainings.tsx
import {
  Box,
  Stack,
  TextField,
  InputAdornment,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Rating,
  Snackbar,
  Alert,
} from "@mui/material";
import { Search, OpenInNew } from "@mui/icons-material";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../lib/api";

type Row = {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string;
  contentType: "PDF" | "Video" | "PPT" | "PowerPoint";
  date: string;
  fileUrl: string;
  thumbUrl: string | null;
  progress: number;
  watched: boolean;
  lastViewedAt?: string | null;
  rating?: number | null;
  comment?: string | null;
};

const previewByType = (t?: string) => {
  const x = (t ?? "").trim().toLowerCase();
  if (x === "pdf") return "/previews/pdf.svg";
  if (x === "video") return "/previews/video.svg";
  if (x === "ppt" || x === "pptx" || x.includes("power")) return "/previews/ppt.svg";
  return "/previews/pdf.svg";
};

// ✅ Dosya URL'sini doğru üret: baseURL (/api) yerine origin kullan
const toPublicFileUrl = (p: string) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;

  // p: "/uploads/..." veya "/api/uploads/..." olabilir
  const base = api.defaults.baseURL || window.location.origin;

  try {
    const u = new URL(base);
    const path = p.startsWith("/") ? p : `/${p}`;
    return `${u.origin}${path}`;
  } catch {
    const path = p.startsWith("/") ? p : `/${p}`;
    return `${window.location.origin}${path}`;
  }
};

const getErrorMessage = (e: any) => {
  const d = e?.response?.data;
  if (!d) return "İşlem başarısız.";
  if (typeof d === "string") return d;
  if (typeof d === "object") return d?.message || JSON.stringify(d);
  return String(d);
};

export default function UserTrainings() {
  const params = useParams(); // /app veya /app/c/:categoryId
  const categoryId = params.categoryId ? parseInt(params.categoryId, 10) : undefined;

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    type: "success" | "error" | "info" | "warning";
  }>({ open: false, msg: "", type: "success" });

  // Kullanıcının yazdığı yorumları kaybetmemek için (kontrollü alan)
  const [draftComments, setDraftComments] = useState<Record<number, string>>({});
  const [draftRatings, setDraftRatings] = useState<Record<number, number>>({});

  const seedDrafts = useCallback((data: Row[]) => {
    setDraftComments((prev) => {
      const next = { ...prev };
      for (const r of data) if (next[r.id] === undefined) next[r.id] = r.comment ?? "";
      return next;
    });
    setDraftRatings((prev) => {
      const next = { ...prev };
      for (const r of data) if (next[r.id] === undefined) next[r.id] = r.rating ?? 0;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      let cid = categoryId;

      // categoryId yoksa ilk kategori üzerinden yükle
      if (!cid) {
        const { data: cats } = await api.get<{ id: number }[]>("/My/categories");
        cid = cats[0]?.id;
        if (!cid) {
          setRows([]);
          return;
        }
      }

      const { data } = await api.get<Row[]>("/My/trainings", {
        params: { categoryId: cid, search: q || undefined },
      });

      setRows(data);
      seedDrafts(data);
    } catch (e: any) {
      setRows([]);
      setSnack({ open: true, msg: getErrorMessage(e) || "Kayıt alınamadı.", type: "error" });
    }
  }, [categoryId, q, seedDrafts]);

  useEffect(() => {
    load();
  }, [load]);

  const rowsMemo = useMemo(() => rows, [rows]);

  const openAndMark = useCallback(
    async (r: Row) => {
      // ✅ Dosyayı doğru URL ile aç
      const url = toPublicFileUrl(r.fileUrl);
      if (!url) {
        setSnack({ open: true, msg: "Dosya adresi bulunamadı.", type: "error" });
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");

      // İzlenmiş olarak işaretle (progress=100)
      try {
        await api.post(`/My/progress/view/${r.id}`, { progress: 100 });
        await load();
      } catch {
        // sessiz geç
      }
    },
    [load]
  );

  const saveFeedback = useCallback(
    async (trainingId: number) => {
      try {
        const rating = draftRatings[trainingId] ?? 0;
        const comment = draftComments[trainingId] ?? "";

        await api.post(`/My/progress/feedback/${trainingId}`, { rating, comment });
        setSnack({ open: true, msg: "Geri bildiriminiz kaydedildi.", type: "success" });
        await load();
      } catch (e: any) {
        setSnack({ open: true, msg: getErrorMessage(e) || "Kaydedilemedi.", type: "error" });
      }
    },
    [draftComments, draftRatings, load]
  );

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          placeholder="Eğitim ara"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 360 }}
        />
        <Button onClick={load}>Yenile</Button>
      </Stack>

      <Grid container spacing={2}>
        {rowsMemo.map((r) => {
          const draftRating = draftRatings[r.id] ?? (r.rating ?? 0);
          const draftComment = draftComments[r.id] ?? (r.comment ?? "");

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={r.id}>
              <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ position: "relative" }}>
                  <CardMedia
                    component="img"
                    image={r.thumbUrl ? toPublicFileUrl(r.thumbUrl) : previewByType(r.contentType)}
                    sx={{ height: 160, objectFit: "cover" }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      bgcolor: "rgba(0,0,0,.55)",
                      color: "#fff",
                      px: 1,
                      py: 0.5,
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} title={r.title} noWrap>
                      {r.title}
                    </Typography>
                  </Box>
                </Box>

                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip size="small" label={dayjs(r.date).format("DD.MM.YYYY")} />
                      <Chip size="small" label={r.contentType} />
                      {r.watched ? (
                        <Chip size="small" color="success" label="İzlendi" />
                      ) : (
                        <Chip size="small" color="warning" label="İzlenmedi" />
                      )}
                    </Stack>

                    <Typography variant="body2" color="text.secondary">
                      Son İzleme:{" "}
                      {r.lastViewedAt ? dayjs(r.lastViewedAt).format("DD.MM.YYYY HH:mm") : "-"}
                    </Typography>

                    {/* Puan & Yorum */}
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Puanım:</Typography>
                        <Rating
                          value={draftRating}
                          onChange={(_, val) => {
                            const v = val ?? 0;
                            setDraftRatings((s) => ({ ...s, [r.id]: v }));
                            // İstersen anında kaydedebilir, istersen sadece blur/btn ile kaydedebilirsin.
                            // Mevcut yapıyı bozmamak için burada kaydetmiyoruz.
                          }}
                        />
                        <Button
                          size="small"
                          onClick={() => saveFeedback(r.id)}
                          disabled={(draftRatings[r.id] ?? (r.rating ?? 0)) === (r.rating ?? 0) &&
                            (draftComments[r.id] ?? (r.comment ?? "")) === (r.comment ?? "")}
                        >
                          Kaydet
                        </Button>
                      </Stack>

                      <TextField
                        size="small"
                        placeholder="Yorum yazın (isteğe bağlı)"
                        value={draftComment}
                        onChange={(e) => setDraftComments((s) => ({ ...s, [r.id]: e.target.value }))}
                        onBlur={() => {
                          // Blur’da da kaydet (mevcut davranışa yakın)
                          saveFeedback(r.id);
                        }}
                        multiline
                        maxRows={3}
                      />
                    </Stack>
                  </Stack>
                </CardContent>

                <CardActions sx={{ justifyContent: "space-between" }}>
                  <Button size="small" startIcon={<OpenInNew />} onClick={() => openAndMark(r)}>
                    İçeriği Aç
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(r.progress)}%
                  </Typography>
                </CardActions>
              </Card>
            </Grid>
          );
        })}

        {rowsMemo.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Typography>Kayıt yok.</Typography>
          </Grid>
        )}
      </Grid>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
