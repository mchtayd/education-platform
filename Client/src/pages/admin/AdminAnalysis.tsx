// src/pages/admin/AdminAnalysis.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Stack,
  TextField,
  InputAdornment,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Typography,
  LinearProgress,
  Chip,
  Rating,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Search, Refresh } from "@mui/icons-material";
import dayjs from "dayjs";
import api from "../../lib/api";
import * as signalR from "@microsoft/signalr";

/* ---------------- Types ---------------- */
type LookupProject = { id: number; name: string };
type LookupTraining = { id: number; title: string };

type AssignmentRow = {
  userId: number;
  fullName: string;
  email: string;
  projectId?: number | null;
  projectName?: string | null;

  trainingId: number;
  trainingTitle: string;
  categoryName: string;
  contentType: "PDF" | "Video" | "PowerPoint" | "PPT";
  trainingDate: string;

  assignedAt: string;
  progress: number;
  lastViewedAt?: string | null;
  updatedAt?: string | null;
};

type FeedbackSummary = {
  totalRows: number;
  commentCount: number;
  ratingCount: number;
  avgRating?: number | null;
  stars: Record<number, number>;
};

type FeedbackRow = {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  projectName?: string | null;

  trainingId: number;
  trainingTitle: string;
  categoryName: string;
  contentType: "PDF" | "Video" | "PowerPoint" | "PPT";

  progress: number;
  lastViewedAt?: string | null;
  rating?: number | null;
  comment?: string | null;
  updatedAt: string;
};

type ExamOption = {
  id: number;
  title: string;
  durationMinutes: number;
  questionCount: number;
  attemptCount: number;
};

type ExamQuestionStat = {
  questionId: number;
  order: number;
  text: string;
  totalAnswers: number;
  wrongCount: number;
  correctCount: number;
  wrongRate: number; // 0..100
};

type ExamStatsResponse = {
  examId: number;
  title: string;
  attemptCount: number;
  items: ExamQuestionStat[];
};

/* -------------- Helpers -------------- */
const clampPct = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

function ProgressCell({ value }: { value: number }) {
  const v = clampPct(value);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 240 }}>
      <Box sx={{ flex: 1 }}>
        <LinearProgress variant="determinate" value={v} />
      </Box>
      <Typography variant="body2" sx={{ width: 44, textAlign: "right" }}>
        {Math.round(v)}%
      </Typography>
    </Stack>
  );
}

function WrongRateBar({ value }: { value: number }) {
  const v = clampPct(value);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 320 }}>
      <Box sx={{ flex: 1 }}>
        <LinearProgress variant="determinate" value={v} />
      </Box>
      <Typography variant="body2" sx={{ width: 56, textAlign: "right" }}>
        {v.toFixed(1)}%
      </Typography>
    </Stack>
  );
}

/* ---------------- Page ---------------- */
export default function AdminAnalysis() {
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // lookups
  const [projects, setProjects] = useState<LookupProject[]>([]);
  const [trainings, setTrainings] = useState<LookupTraining[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  const [projectId, setProjectId] = useState<number | "">("");
  const [trainingId, setTrainingId] = useState<number | "">("");

  // tab1 filters
  const [status, setStatus] = useState<"all" | "notstarted" | "inprogress" | "completed">("all");

  // tab2 filters
  const [onlyCommented, setOnlyCommented] = useState(false);
  const [onlyRated, setOnlyRated] = useState(false);

  // data
  const [loading, setLoading] = useState(false);

  const [assignmentRows, setAssignmentRows] = useState<AssignmentRow[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);

  // exams (tab3)
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | "">("");
  const [examStats, setExamStats] = useState<ExamStatsResponse | null>(null);
  const [examStatsLoading, setExamStatsLoading] = useState(false);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error" | "info" | "warning";
  }>({ open: false, msg: "", severity: "info" });

  const mounted = useRef(true);

  // ✅ SignalR event geldiğinde "en güncel" state ile reload etmek için
  const reloadRef = useRef<() => void>(() => {});

  /* ------------ Loaders ------------ */
  const loadLookups = async () => {
    const { data } = await api.get("/Analysis/lookups");
    if (!mounted.current) return;
    setProjects(data.projects ?? []);
    setTrainings(data.trainings ?? []);
  };

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AssignmentRow[]>("/Analysis/assignments", {
        params: {
          search: qDebounced || undefined,
          projectId: projectId || undefined,
          trainingId: trainingId || undefined,
          status: status || "all",
        },
      });
      if (!mounted.current) return;
      setAssignmentRows(data);
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || "Atamalar alınamadı.", severity: "error" });
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/Analysis/feedback", {
        params: {
          search: qDebounced || undefined,
          projectId: projectId || undefined,
          trainingId: trainingId || undefined,
          onlyCommented: onlyCommented || undefined,
          onlyRated: onlyRated || undefined,
        },
      });
      if (!mounted.current) return;
      setFeedbackSummary(data.summary ?? null);
      setFeedbackRows(data.rows ?? []);
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || "Yorumlar alınamadı.", severity: "error" });
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const loadExamOptions = async () => {
    try {
      const { data } = await api.get<ExamOption[]>("/Analysis/exams");
      if (!mounted.current) return;
      setExamOptions(data ?? []);
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || "Sınav listesi alınamadı.", severity: "error" });
    }
  };

  const loadExamStats = async (examId: number) => {
    setExamStatsLoading(true);
    try {
      const { data } = await api.get<ExamStatsResponse>(`/Analysis/exams/${examId}/question-stats`);
      if (!mounted.current) return;
      setExamStats(data);
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || "Sınav analizi alınamadı.", severity: "error" });
      setExamStats(null);
    } finally {
      if (mounted.current) setExamStatsLoading(false);
    }
  };

  /* ------------ Effects ------------ */
  useEffect(() => {
    mounted.current = true;
    loadLookups();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  // reload on filters/tab (tab 0-1 only)
  useEffect(() => {
    if (tab === 0) loadAssignments();
    if (tab === 1) loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, projectId, trainingId, status, onlyCommented, onlyRated]);

  // tab 2 first open -> load exams
  useEffect(() => {
    if (tab !== 2) return;
    loadExamOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // when selected exam changes (tab 2)
  useEffect(() => {
    if (tab !== 2) return;
    if (!selectedExamId) {
      setExamStats(null);
      return;
    }
    loadExamStats(Number(selectedExamId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedExamId]);

  // ✅ reloadRef her state değişiminde güncel reload fonksiyonunu tutsun
  useEffect(() => {
    reloadRef.current = () => {
      if (tab === 0) loadAssignments();
      else if (tab === 1) loadFeedback();
      else {
        loadExamOptions();
        if (selectedExamId) loadExamStats(Number(selectedExamId));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, projectId, trainingId, status, onlyCommented, onlyRated, selectedExamId]);

  // ✅ SignalR bağlantısı sadece 1 kere kurulsun (StrictMode + filter değişimi hatası çözümü)
  useEffect(() => {
    let disposed = false;

    const base = (api.defaults.baseURL || "").replace(/\/$/, "");
    const conn = new signalR.HubConnectionBuilder()
      .configureLogging(signalR.LogLevel.None)
      .withUrl(`${base}/hubs/analysis`, {
        withCredentials: false,
        // skipNegotiation: false (default)
      })
      .withAutomaticReconnect()
      .build();

    conn.on("analysisChanged", () => {
      reloadRef.current();
    });

    (async () => {
      try {
        await conn.start();
      } catch (err) {
        // Dev + StrictMode'ta ilk mount sırasında stop() ile çakışıp "negotiation" hatası basabiliyor.
        // Uygulama çalıştığı için burada sessiz geçiyoruz.
        if (!disposed) {
          console.warn("SignalR start failed:", err);
        }
      }
    })();

    return () => {
      disposed = true;
      conn.stop().catch(() => {});
    };
  }, []);

  /* ------------ Memos ------------ */
  const assignmentsMemo = useMemo(() => assignmentRows, [assignmentRows]);
  const feedbackMemo = useMemo(() => feedbackRows, [feedbackRows]);
  const examOptionsMemo = useMemo(() => examOptions, [examOptions]);

  // wrong order: en çok yanlış üstte
  const examItemsMemo = useMemo(() => {
    const items = examStats?.items ?? [];
    return [...items].sort((a, b) => (b.wrongCount - a.wrongCount) || (a.order - b.order));
  }, [examStats]);

  const selectedExam = useMemo(() => {
    const id = Number(selectedExamId);
    if (!selectedExamId) return null;
    return examOptionsMemo.find((x) => x.id === id) || null;
  }, [selectedExamId, examOptionsMemo]);

  const handleRefresh = () => {
    if (tab === 0) return loadAssignments();
    if (tab === 1) return loadFeedback();
    if (tab === 2) {
      loadExamOptions();
      if (selectedExamId) return loadExamStats(Number(selectedExamId));
      return;
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
            <Tab label="ATAMALAR / İLERLEME" />
            <Tab label="YORUMLAR / GERİ BİLDİRİM" />
            <Tab label="SINAV ANALİZLERİ" />
          </Tabs>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Filters (tab 0-1 same design). Tab 2: show exam selector instead */}
        {tab !== 2 ? (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={tab === 0 ? "Ara (kullanıcı / eğitim / kategori)" : "Ara (kullanıcı / eğitim / yorum)"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 280 }}
            />

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Proje</InputLabel>
              <Select label="Proje" value={projectId} onChange={(e) => setProjectId(e.target.value as any)}>
                <MenuItem value="">Tümü</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Eğitim</InputLabel>
              <Select label="Eğitim" value={trainingId} onChange={(e) => setTrainingId(e.target.value as any)}>
                <MenuItem value="">Tümü</MenuItem>
                {trainings.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {tab === 0 ? (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Durum</InputLabel>
                <Select label="Durum" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <MenuItem value="all">Tümü</MenuItem>
                  <MenuItem value="notstarted">Başlamadı</MenuItem>
                  <MenuItem value="inprogress">Devam Ediyor</MenuItem>
                  <MenuItem value="completed">Tamamlandı</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  clickable
                  color={onlyCommented ? "primary" : "default"}
                  label="Sadece Yorum"
                  onClick={() => {
                    setOnlyCommented((s) => !s);
                    if (!onlyCommented) setOnlyRated(false);
                  }}
                />
                <Chip
                  clickable
                  color={onlyRated ? "primary" : "default"}
                  label="Sadece Puan"
                  onClick={() => {
                    setOnlyRated((s) => !s);
                    if (!onlyRated) setOnlyCommented(false);
                  }}
                />
              </Stack>
            )}

            <Button startIcon={<Refresh />} onClick={handleRefresh}>
              Yenile
            </Button>
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 360 }}>
              <InputLabel>Sınav</InputLabel>
              <Select label="Sınav" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value as any)}>
                <MenuItem value="">Seçiniz</MenuItem>
                {examOptionsMemo.map((ex) => (
                  <MenuItem key={ex.id} value={ex.id}>
                    {ex.title} • {ex.questionCount} soru • {ex.attemptCount} deneme
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedExam && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <Chip label={`Soru: ${selectedExam.questionCount}`} />
                <Chip label={`Deneme: ${selectedExam.attemptCount}`} />
                <Chip label={`Süre: ${selectedExam.durationMinutes} dk`} />
              </Stack>
            )}

            <Button startIcon={<Refresh />} onClick={handleRefresh}>
              Yenile
            </Button>
          </Stack>
        )}

        <Divider sx={{ my: 2 }} />

        {/* CONTENT */}
        {tab === 0 && (
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Kullanıcı</TableCell>
                  <TableCell>Proje</TableCell>
                  <TableCell>Eğitim</TableCell>
                  <TableCell>Kategori</TableCell>
                  <TableCell>Tür</TableCell>
                  <TableCell>Atama</TableCell>
                  <TableCell>İlerleme</TableCell>
                  <TableCell>Son İzleme</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {assignmentsMemo.map((r) => (
                  <TableRow key={`${r.userId}-${r.trainingId}`} hover>
                    <TableCell>
                      <Stack>
                        <Typography fontWeight={600}>{r.fullName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {r.email}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{r.projectName ?? "-"}</TableCell>
                    <TableCell>{r.trainingTitle}</TableCell>
                    <TableCell>{r.categoryName}</TableCell>
                    <TableCell>{r.contentType}</TableCell>
                    <TableCell>{dayjs(r.assignedAt).format("DD.MM.YYYY HH:mm")}</TableCell>
                    <TableCell>
                      <ProgressCell value={r.progress || 0} />
                    </TableCell>
                    <TableCell>{r.lastViewedAt ? dayjs(r.lastViewedAt).format("DD.MM.YYYY HH:mm") : "-"}</TableCell>
                  </TableRow>
                ))}

                {!loading && assignmentsMemo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>Kayıt yok.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {loading && (
              <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={24} />
              </Box>
            )}
          </Paper>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            {/* Summary */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                <Chip label={`Toplam Kayıt: ${feedbackSummary?.totalRows ?? 0}`} />
                <Chip label={`Yorum: ${feedbackSummary?.commentCount ?? 0}`} />
                <Chip label={`Puan: ${feedbackSummary?.ratingCount ?? 0}`} />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Ortalama:
                  </Typography>
                  <Rating value={feedbackSummary?.avgRating ?? 0} precision={0.1} readOnly />
                  <Typography variant="body2" color="text.secondary">
                    {feedbackSummary?.avgRating ? feedbackSummary.avgRating.toFixed(2) : "-"}
                  </Typography>
                </Stack>
              </Stack>

              {/* yıldız dağılımı */}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                {[5, 4, 3, 2, 1].map((st) => (
                  <Chip key={st} label={`${st}★: ${feedbackSummary?.stars?.[st] ?? 0}`} />
                ))}
              </Stack>
            </Paper>

            {/* Rows */}
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tarih</TableCell>
                    <TableCell>Kullanıcı</TableCell>
                    <TableCell>Proje</TableCell>
                    <TableCell>Eğitim</TableCell>
                    <TableCell>Puan</TableCell>
                    <TableCell>Yorum</TableCell>
                    <TableCell>İlerleme</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feedbackMemo.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{dayjs(r.updatedAt).format("DD.MM.YYYY HH:mm")}</TableCell>
                      <TableCell>
                        <Stack>
                          <Typography fontWeight={600}>{r.fullName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {r.email}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{r.projectName ?? "-"}</TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{r.trainingTitle}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {r.categoryName} • {r.contentType}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Rating value={r.rating ?? 0} readOnly size="small" />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 520 }}>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {r.comment && r.comment.trim() !== "" ? r.comment : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <ProgressCell value={r.progress || 0} />
                      </TableCell>
                    </TableRow>
                  ))}

                  {!loading && feedbackMemo.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>Kayıt yok.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {loading && (
                <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </Paper>
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={2}>
            {!selectedExamId && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography color="text.secondary">Soru bazlı analiz görmek için yukarıdan bir sınav seçin.</Typography>
              </Paper>
            )}

            {selectedExamId && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    alignItems={{ md: "center" }}
                    justifyContent="space-between"
                  >
                    <Typography fontWeight={800}>{examStats?.title ?? "Sınav Analizi"}</Typography>
                    <Chip label={`Toplam Deneme: ${examStats?.attemptCount ?? 0}`} />
                  </Stack>

                  <Divider sx={{ my: 1 }} />

                  {examStatsLoading && (
                    <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
                      <CircularProgress size={24} />
                    </Box>
                  )}

                  {!examStatsLoading && examStats && examItemsMemo.length === 0 && (
                    <Typography color="text.secondary">Henüz analiz verisi yok (deneme bulunamadı).</Typography>
                  )}

                  {!examStatsLoading && examStats && examItemsMemo.length > 0 && (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Soru</TableCell>
                          <TableCell>Yanlış Oranı</TableCell>
                          <TableCell>Yanlış</TableCell>
                          <TableCell>Doğru</TableCell>
                          <TableCell>Toplam</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {examItemsMemo.map((it) => (
                          <TableRow key={it.questionId} hover>
                            <TableCell sx={{ maxWidth: 520 }}>
                              <Typography fontWeight={700}>{it.order}. Soru</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                                {it.text}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <WrongRateBar value={it.wrongRate} />
                            </TableCell>
                            <TableCell>
                              <Chip size="small" color="error" label={it.wrongCount} />
                            </TableCell>
                            <TableCell>
                              <Chip size="small" color="success" label={it.correctCount} />
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={it.totalAnswers} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Stack>
              </Paper>
            )}
          </Stack>
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
