// src/pages/admin/AdminExam.tsx
import {
  Box, Paper, Tabs, Tab, Stack, TextField, Button, IconButton, InputAdornment,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Select, MenuItem,
  FormControl, InputLabel, Typography, ToggleButtonGroup, ToggleButton,
  Divider
} from "@mui/material";
import { Add, Delete, Image, Refresh, Search, Visibility, Edit } from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import api from "../../lib/api";
import { Autocomplete } from "@mui/material";
import { fullApiUrl } from "../../lib/fullUrl";
import { useAuth } from "../../context/AuthContext";


type Project = { id: number; name: string };
type UserItem = { id: number; fullName: string; email: string };
type ExamLite = { id: number; title: string; durationMinutes: number; projectName?: string | null; questionCount: number };

type Choice = { text?: string; imageUrl?: string | null; isCorrect: boolean };
type Question = { text: string; choices: Choice[] };
type ExamDetail = {
  id: number; title: string; durationMinutes: number; projectId?: number | null;
  questions: Array<{ id: number; text: string; choices: Array<{ id: number; text?: string; imageUrl?: string | null; isCorrect: boolean }> }>
};

type AssignmentRow = { id: number; createdAt: string; examId: number; examTitle: string; kind: "user" | "project"; targetName: string };

type AttemptReview = {
  attemptId: number;
  examTitle: string;
  user: string;
  startedAt: string;
  submittedAt: string;
  score?: number | null;
  isPassed?: boolean | null;
  questions: Array<{
    questionId: number;
    order: number;
    text: string;
    selectedChoiceId?: number | null;
    isCorrect: boolean;
    choices: Array<{ id: number; text?: string | null; imageUrl?: string | null; isCorrect: boolean }>;
  }>;
};

export default function AdminExam() {
  const [tab, setTab] = useState<0 | 1 | 2 | 3>(0);

  const { user } = useAuth();
  const role = String(user?.role ?? "").toLowerCase();
  const isEducator = role === "educator" || role === "trainer";

  // ---- Create Exam state ----
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [defaultProject, setDefaultProject] = useState<number | "">("");
  const [projects, setProjects] = useState<Project[]>([]);

  const blankChoices = (): Choice[] => ([
    { text: "", imageUrl: null, isCorrect: true },
    { text: "", imageUrl: null, isCorrect: false },
    { text: "", imageUrl: null, isCorrect: false },
    { text: "", imageUrl: null, isCorrect: false },
  ]);

  const [qText, setQText] = useState("");
  const [qChoices, setQChoices] = useState<Choice[]>(blankChoices());
  const [questions, setQuestions] = useState<Question[]>([]);

  // ---- All Exams ----
  const [exams, setExams] = useState<ExamLite[]>([]);
  const [search, setSearch] = useState("");
  const [detailDlg, setDetailDlg] = useState<{ open: boolean; data?: ExamDetail }>({ open: false });

  // ---- Publish ----
  const [assignData, setAssignData] = useState<{ exams: { id: number; title: string }[]; users: UserItem[]; projects: Project[] }>({ exams: [], users: [], projects: [] });
  const [mode, setMode] = useState<"user" | "project">("user");
  const [selExams, setSelExams] = useState<{ id: number; title: string }[]>([]);
  const [selUsers, setSelUsers] = useState<UserItem[]>([]);
  const [selProject, setSelProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  const [editingExamId, setEditingExamId] = useState<number | null>(null);

  const resetExamForm = () => {
  setEditingExamId(null);
  setTitle("");
  setDuration(30);
  setDefaultProject("");
  setQText("");
  setQChoices(blankChoices());
  setQuestions([]);
  setEditingQuestionIndex(null);
};

const resetQuestionForm = () => {
  setEditingQuestionIndex(null);
  setQText("");
  setQChoices(blankChoices());
};

const editQuestion = (idx: number) => {
  const q = questions[idx];
  if (!q) return;

  setEditingQuestionIndex(idx);
  setQText(q.text || "");

  // 4 şık garanti edecek şekilde normalize et
  const normalized = [...(q.choices || [])].map((c) => ({
    text: c.text || "",
    imageUrl: c.imageUrl || null,
    isCorrect: !!c.isCorrect,
  }));

  while (normalized.length < 4) {
    normalized.push({ text: "", imageUrl: null, isCorrect: false });
  }

  setQChoices(normalized.slice(0, 4));
  window.scrollTo({ top: 0, behavior: "smooth" });
};

  const choiceImageSrc = (url?: string | null) => {
  if (!url) return "";

  let s = String(url).trim().replace(/\\/g, "/");

  // Eğer absolute url ise direkt dön
  if (/^https?:\/\//i.test(s)) return s;

  // Eğer yanlışlıkla fiziksel path geldiyse wwwroot sonrası kısmı al
  const lower = s.toLowerCase();
  const w = lower.indexOf("/wwwroot/");
  if (w >= 0) {
    s = s.substring(w + "/wwwroot".length); // "/uploads/..."
  } else if (lower.startsWith("wwwroot/")) {
    s = s.substring("wwwroot".length); // "/uploads/..."
  }

  // Baştaki slash garanti olsun
  if (!s.startsWith("/")) s = "/" + s;

  return fullApiUrl(s);
};

const startEditExam = async (id: number) => {
  try {
    const { data } = await api.get<ExamDetail>(`/Exams/${id}`);

    setEditingExamId(data.id);
    setTitle(data.title || "");
    setDuration(data.durationMinutes || 30);
    setDefaultProject((data.projectId ?? "") as any);

    setQuestions(
      (data.questions || []).map((q) => ({
        text: q.text || "",
        choices: (q.choices || []).map((c) => ({
          text: c.text || "",
          imageUrl: c.imageUrl || null,
          isCorrect: !!c.isCorrect,
        })),
      }))
    );

    setQText("");
setQChoices(blankChoices());
setEditingQuestionIndex(null);
setTab(0);

    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("Sınav düzenleme modunda açıldı.", "info");
  } catch (e: any) {
    notify(e?.response?.data?.message || "Sınav düzenleme için açılamadı.", "error");
  }
};
  // ---- Control ----
  type AttemptRow = { id: number; examId: number; examTitle: string; user: string; startedAt: string; submittedAt: string; score?: number | null; isPassed?: boolean | null };
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptSearch, setAttemptSearch] = useState("");

  // ---- UI ----
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" | "info" | "warning" }>({ open: false, msg: "", severity: "info" });
  const notify = (msg: string, severity?: any) => setSnack({ open: true, msg, severity: severity || "success" });

  // ---- Helpers ----
  const uploadChoiceImage = async (file: File): Promise<string> => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post<{ url: string }>("/Files/choice-image", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return data.url;
  };

  const addQuestion = () => {
  if (!qText.trim()) {
    notify("Soru metni boş olamaz.", "error");
    return;
  }

  if (qChoices.length !== 4 || !qChoices.some(c => c.isCorrect)) {
    notify("4 şık ve en az bir doğru şık seçilmelidir.", "error");
    return;
  }

  const payloadQuestion: Question = {
    text: qText.trim(),
    choices: qChoices.map(c => ({
      text: c.text?.trim(),
      imageUrl: c.imageUrl || null,
      isCorrect: !!c.isCorrect
    }))
  };

  if (editingQuestionIndex !== null) {
    setQuestions(prev =>
      prev.map((q, i) => (i === editingQuestionIndex ? payloadQuestion : q))
    );
    notify("Soru güncellendi.", "success");
  } else {
    setQuestions(prev => [...prev, payloadQuestion]);
    notify("Soru eklendi.", "success");
  }

  resetQuestionForm();
};

  const removeQuestion = (idx: number) => {
  setQuestions(prev => prev.filter((_, i) => i !== idx));

  // Eğer düzenlenen soru silindiyse formu temizle
  if (editingQuestionIndex === idx) {
    resetQuestionForm();
    return;
  }

  // Düzenlenen soru, silinenin sonrasındaysa index bir azalır
  if (editingQuestionIndex !== null && idx < editingQuestionIndex) {
    setEditingQuestionIndex(editingQuestionIndex - 1);
  }
};

  // ---- Review Dialog ----
  const [reviewDlg, setReviewDlg] = useState<{ open: boolean; loading: boolean; data?: AttemptReview }>({ open: false, loading: false });

  // ✅ Yeni: mesaj state
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);

  const openReview = async (attemptId: number) => {
    setReviewDlg({ open: true, loading: true });
    setMsgText(""); // ✅ dialog açılınca temizle
    try {
      const { data } = await api.get<AttemptReview>(`/Exams/attempts/${attemptId}/review`);
      setReviewDlg({ open: true, loading: false, data });
    } catch (e: any) {
      notify(e?.response?.data || "İnceleme açılamadı.", "error");
      setReviewDlg({ open: false, loading: false });
    }
  };

  // ✅ Yeni: attempt'e mesaj gönder
  const sendAttemptMessage = async () => {
    const attemptId = reviewDlg.data?.attemptId;
    if (!attemptId) return;

    const text = msgText.trim();
    if (!text) { notify("Mesaj boş olamaz.", "warning"); return; }

    setMsgSending(true);
    try {
      await api.post(`/Exams/attempts/${attemptId}/message`, { message: text });
      setMsgText("");
      notify("Mesaj kullanıcıya gönderildi.", "success");
      // istersen: window.dispatchEvent(new Event("messagesChanged"));
    } catch (e: any) {
      notify(e?.response?.data?.message || "Mesaj gönderilemedi.", "error");
    } finally {
      setMsgSending(false);
    }
  };

  const deleteExam = async (exam: ExamLite) => {
  if (!confirm(`"${exam.title}" sınavı silinsin mi?\nBu sınava ait sorular/şıkklar ve ilgili kayıtlar da silinir.`))
    return;

  try {
    await api.delete(`/Exams/${exam.id}`);
    notify("Sınav silindi.", "success");

    // Detay açıksa kapat
    if (detailDlg.open && detailDlg.data?.id === exam.id) {
      setDetailDlg({ open: false });
    }

    await loadExams();
  } catch (e: any) {
    notify(e?.response?.data?.message || e?.response?.data || "Sınav silinemedi.", "error");
  }
};

  const saveExam = async () => {
  if (isEducator && !defaultProject) {
    notify("Eğitmen hesabı için proje seçimi zorunludur.", "error");
    return;
  }

  if (!title.trim()) { notify("Başlık zorunlu.", "error"); return; }
  if (questions.length === 0) { notify("En az 1 soru ekleyin.", "error"); return; }

  try {
    const payload = {
      title: title.trim(),
      projectId: defaultProject || null,
      durationMinutes: duration,
      questions
    };

    if (editingExamId) {
      await api.put(`/Exams/${editingExamId}`, payload);
      notify("Sınav güncellendi.", "success");
    } else {
      await api.post("/Exams", payload);
      notify("Sınav kaydedildi.", "success");
    }

    resetExamForm();

    if (tab !== 1) setTab(1);
    await loadExams();
  } catch (e: any) {
    notify(e?.response?.data?.message || e?.response?.data || "Sınav kaydedilemedi/güncellenemedi.", "error");
  }
};

  // ---- Loads ----
  const loadProjects = async () => {
    const { data } = await api.get<Project[]>("/Users/projects");
    setProjects(data);
  };

  const loadExams = async () => {
    const { data } = await api.get<ExamLite[]>("/Exams", { params: { search: search || undefined } });
    setExams(data);
  };

  const openDetail = async (id: number) => {
    const { data } = await api.get<ExamDetail>(`/Exams/${id}`);
    setDetailDlg({ open: true, data });
  };

  const loadAssignData = async () => {
    const { data } = await api.get("/Exams/assign-data");
    setAssignData(data);
  };

  const loadAssignments = async () => {
    const { data } = await api.get<AssignmentRow[]>("/Exams/assignments", { params: { search: assignSearch || undefined } });
    setAssignments(data);
  };

  const publish = async () => {
    try {
      if (selExams.length === 0) return;
      if (mode === "user") {
        await api.post("/Exams/assign-to-users", {
          examIds: selExams.map(x => x.id),
          userIds: selUsers.map(x => x.id)
        });
      } else {
        if (!selProject) return;
        await api.post("/Exams/assign-to-project", {
          examIds: selExams.map(x => x.id),
          projectId: selProject.id
        });
      }
      notify("Yayınlama tamam.");
      setSelExams([]); setSelUsers([]); setSelProject(null);
      await loadAssignments();
    } catch (e: any) {
      notify(e?.response?.data || "Yayınlama başarısız.", "error");
    }
  };

  const unpublish = async (row: AssignmentRow) => {
    if (!confirm("Bu yayın kaldırılacak. Emin misiniz?")) return;
    await api.delete(`/Exams/assignments/${row.id}`);
    await loadAssignments();
  };

  const loadAttempts = async () => {
    const { data } = await api.get<AttemptRow[]>("/Exams/attempts", { params: { search: attemptSearch || undefined } });
    setAttempts(data);
  };

  // ---- Effects ----
  useEffect(() => { loadProjects(); loadExams(); }, []);
  useEffect(() => { if (tab === 1) loadExams(); }, [search, tab]);
  useEffect(() => { if (tab === 2) { loadAssignData(); loadAssignments(); } }, [assignSearch, tab]);
  useEffect(() => { if (tab === 3) loadAttempts(); }, [attemptSearch, tab]);
  useEffect(() => {
  if (!isEducator) return;
  if (defaultProject !== "") return;
  if (projects.length === 0) return;
  setDefaultProject(projects[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEducator, projects]);


  // ---- UI ----
  const examsMemo = useMemo(() => exams, [exams]);
  const assignmentsMemo = useMemo(() => assignments, [assignments]);
  const attemptsMemo = useMemo(() => attempts, [attempts]);

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
            <Tab label="Sınav Oluştur" />
            <Tab label="Tüm Sınavlar" />
            <Tab label="Sınav Yayınla" />
            <Tab label="Sınav Kontrol" />
          </Tabs>
        </Box>

        {tab === 0 && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            {editingExamId && (
  <Alert severity="info" sx={{ mb: 1 }}>
    Düzenleme modu: <b>#{editingExamId}</b> — değişiklikleri kaydedince mevcut sınav güncellenir.
    <Button size="small" sx={{ ml: 1 }} onClick={resetExamForm}>
      Düzenlemeyi İptal Et
    </Button>
  </Alert>
)}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              
              <TextField label="Sınav Başlığı" fullWidth value={title} onChange={e => setTitle(e.target.value)} />
              <TextField label="Süre (dk)" type="number" sx={{ width: 140 }} value={duration} onChange={e => setDuration(parseInt(e.target.value || "0") || 0)} />
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel>Proje (opsiyonel)</InputLabel>
                <Select label="Proje (opsiyonel)" value={defaultProject} onChange={e => setDefaultProject(e.target.value as any)}>
                  <MenuItem value="">Seçilmedi</MenuItem>
                  {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            {/* Soru ekleme */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Soru</Typography>
              {editingQuestionIndex !== null && (
  <Alert severity="info" sx={{ mb: 2 }}>
    Soru düzenleme modu: <b>{editingQuestionIndex + 1}. soru</b>
    <Button size="small" sx={{ ml: 1 }} onClick={resetQuestionForm}>
      İptal
    </Button>
  </Alert>
)}
              <TextField multiline minRows={2} fullWidth placeholder="Soru metni" value={qText} onChange={e => setQText(e.target.value)} sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                {qChoices.map((c, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <Button
                      variant={c.isCorrect ? "contained" : "outlined"}
                      size="small"
                      onClick={() => setQChoices(qChoices.map((x, i) => ({ ...x, isCorrect: i === idx })))}
                    >
                      {c.isCorrect ? "Doğru" : "Seç"}
                    </Button>

                    <TextField
                      placeholder={`Şık ${idx + 1} metni`}
                      value={c.text || ""}
                      onChange={e => setQChoices(qChoices.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))}
                      sx={{ flex: 1 }}
                    />

                    <IconButton component="label">
                      <Image />
                      <input hidden type="file" accept="image/*" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const url = await uploadChoiceImage(f);
                        setQChoices(qChoices.map((x, i) => i === idx ? { ...x, imageUrl: url } : x));
                      }} />
                    </IconButton>

                    {c.imageUrl && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
                        <Box
                          component="img"
                          src={choiceImageSrc(c.imageUrl)}
                          alt="şık görseli"
                          sx={{
                            width: 44,
                            height: 44,
                            objectFit: "cover",
                            borderRadius: 1,
                            border: 1,
                            borderColor: "divider",
                          }}
                        />
                        <Button
                          size="small"
                          component="a"
                          href={choiceImageSrc(c.imageUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Görseli aç
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                ))}
              </Stack>

              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
  {editingQuestionIndex !== null && (
    <Button color="inherit" onClick={resetQuestionForm}>
      İptal
    </Button>
  )}

  <Button
    startIcon={editingQuestionIndex !== null ? <Edit /> : <Add />}
    onClick={addQuestion}
  >
    {editingQuestionIndex !== null ? "Soruyu Güncelle" : "Soruyu Ekle"}
  </Button>
</Stack>
              </Stack>
            </Paper>

            {/* Eklenen sorular */}
            <Paper variant="outlined" sx={{ p: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Soru</TableCell>
                    <TableCell>Doğru Şık</TableCell>
                    <TableCell align="right">İşlem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {questions.map((q, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{q.text}</TableCell>
                      <TableCell>{["A", "B", "C", "D"][q.choices.findIndex(c => c.isCorrect)]}</TableCell>
                      <TableCell align="right">
                        <TableCell align="right">
  <Tooltip title="Soruyu Düzenle">
    <IconButton color="primary" onClick={() => editQuestion(i)}>
      <Edit />
    </IconButton>
  </Tooltip>

  <Tooltip title="Soruyu Sil">
    <IconButton color="error" onClick={() => removeQuestion(i)}>
      <Delete />
    </IconButton>
  </Tooltip>
</TableCell>
                      </TableCell>
                    </TableRow>
                  ))}
                  {questions.length === 0 && <TableRow><TableCell colSpan={4}>Henüz soru eklenmedi.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>

            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={saveExam}>
  {editingExamId ? "Sınavı Güncelle" : "Sınavı Kaydet"}
</Button>
            </Stack>
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField size="small" placeholder="Ara" value={search} onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
              <Button startIcon={<Refresh />} onClick={loadExams}>Yenile</Button>
            </Stack>

            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Başlık</TableCell>
                    <TableCell>Süre</TableCell>
                    <TableCell>Proje</TableCell>
                    <TableCell>Soru</TableCell>
                    <TableCell align="right">Detay</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {examsMemo.map(e => (
                    <TableRow key={e.id} hover>
                      <TableCell>{e.title}</TableCell>
                      <TableCell>{e.durationMinutes} dk</TableCell>
                      <TableCell>{e.projectName || "-"}</TableCell>
                      <TableCell><Chip size="small" label={e.questionCount} /></TableCell>
                      <TableCell align="right">
  <Tooltip title="Soruları Gör">
    <IconButton onClick={() => openDetail(e.id)}>
      <Visibility />
    </IconButton>
  </Tooltip>

  <Tooltip title="Sınavı Düzenle">
    <IconButton color="primary" onClick={() => startEditExam(e.id)}>
      <Edit />
    </IconButton>
  </Tooltip>

  <Tooltip title="Sınavı Sil">
    <IconButton color="error" onClick={() => deleteExam(e)}>
      <Delete />
    </IconButton>
  </Tooltip>
</TableCell>

                    </TableRow>
                  ))}
                  {examsMemo.length === 0 && <TableRow><TableCell colSpan={5}>Kayıt yok.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
              <Autocomplete multiple options={assignData.exams} value={selExams}
                onChange={(_, v) => setSelExams(v)} getOptionLabel={(o) => o.title}
                renderInput={(p) => <TextField {...p} label="Sınav(lar)" />} sx={{ minWidth: 300, flex: 1 }} />

              <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)}>
                <ToggleButton value="user">Kullanıcıya</ToggleButton>
                <ToggleButton value="project">Projeye</ToggleButton>
              </ToggleButtonGroup>

              {mode === "user" ? (
                <Autocomplete multiple options={assignData.users} value={selUsers}
                  onChange={(_, v) => setSelUsers(v)} getOptionLabel={(o) => `${o.fullName} (${o.email})`}
                  renderInput={(p) => <TextField {...p} label="Kullanıcı(lar)" />} sx={{ minWidth: 360, flex: 1 }} />
              ) : (
                <Autocomplete options={assignData.projects} value={selProject}
                  onChange={(_, v) => setSelProject(v)} getOptionLabel={(o) => o.name}
                  renderInput={(p) => <TextField {...p} label="Proje" />} sx={{ minWidth: 260, flex: 1 }} />
              )}

              <Button variant="contained" disabled={selExams.length === 0 || (mode === "user" ? selUsers.length === 0 : !selProject)} onClick={publish}>Yayınla</Button>
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField size="small" placeholder="Atamalarda ara" value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
              <Button startIcon={<Refresh />} onClick={loadAssignments}>Yenile</Button>
            </Stack>

            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tarih</TableCell>
                    <TableCell>Sınav</TableCell>
                    <TableCell>Tür</TableCell>
                    <TableCell>Hedef</TableCell>
                    <TableCell align="center">İşlem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignmentsMemo.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell>{dayjs(r.createdAt).format("DD.MM.YYYY HH:mm")}</TableCell>
                      <TableCell>{r.examTitle}</TableCell>
                      <TableCell>{r.kind === "user" ? "Kullanıcı" : "Proje"}</TableCell>
                      <TableCell>{r.targetName}</TableCell>
                      <TableCell align="center">
                        <Button color="error" size="small" onClick={() => unpublish(r)}>Yayından Kaldır</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assignmentsMemo.length === 0 && <TableRow><TableCell colSpan={5}>Kayıt yok.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}

        {tab === 3 && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField size="small" placeholder="Sınav / kullanıcı ara" value={attemptSearch} onChange={e => setAttemptSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
              <Button startIcon={<Refresh />} onClick={loadAttempts}>Yenile</Button>
            </Stack>

            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sınav</TableCell>
                    <TableCell>Kullanıcı</TableCell>
                    <TableCell>Başladı</TableCell>
                    <TableCell>Bitti</TableCell>
                    <TableCell>Puan</TableCell>
                    <TableCell>Durum</TableCell>
                    <TableCell align="right">İncele</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attemptsMemo.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{a.examTitle}</TableCell>
                      <TableCell>{a.user}</TableCell>
                      <TableCell>{dayjs(a.startedAt).format("DD.MM.YYYY HH:mm")}</TableCell>
                      <TableCell>{dayjs(a.submittedAt).format("DD.MM.YYYY HH:mm")}</TableCell>
                      <TableCell>{a.score?.toFixed(1) ?? "-"}</TableCell>
                      <TableCell>
                        {a.isPassed == null ? "-" : a.isPassed
                          ? <Chip color="success" size="small" label="Başarılı" />
                          : <Chip color="error" size="small" label="Başarısız" />
                        }
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => openReview(a.id)}>Sınavı İncele</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {attemptsMemo.length === 0 && <TableRow><TableCell colSpan={7}>Kayıt yok.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>
          </Stack>
        )}
      </Paper>

      {/* Detay dialogu */}
      <Dialog open={detailDlg.open} onClose={() => setDetailDlg({ open: false })} maxWidth="md" fullWidth>
        <DialogTitle>{detailDlg.data?.title}</DialogTitle>
        <DialogContent dividers>
          {detailDlg.data?.questions.map((q, idx) => (
            <Paper key={q.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
              <Typography fontWeight={700}>{idx + 1}. {q.text}</Typography>
              <Stack sx={{ mt: 1 }} spacing={0.5}>
                {q.choices.map((c, i) => (
                  <Stack key={c.id} direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={["A", "B", "C", "D"][i]} />
                    <Typography>{c.text || "(metin yok)"}</Typography>

                    {c.imageUrl && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          component="img"
                          src={choiceImageSrc(c.imageUrl)}
                          alt="şık görseli"
                          sx={{ width: 80, height: 52, objectFit: "contain", border: 1, borderColor: "divider", borderRadius: 1 }}
                        />
                        <Button
                          size="small"
                          component="a"
                          href={choiceImageSrc(c.imageUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Görsel
                        </Button>
                      </Stack>
                    )}

                    {c.isCorrect && <Chip size="small" color="success" label="Doğru" sx={{ ml: 1 }} />}
                  </Stack>
                ))}
              </Stack>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDlg({ open: false })}>Kapat</Button>
        </DialogActions>
      </Dialog>

      {/* ✅ Review dialog (Mesaj gönderme eklendi) */}
      <Dialog open={reviewDlg.open} onClose={() => setReviewDlg({ open: false, loading: false })} maxWidth="md" fullWidth>
        <DialogTitle>Sınav İnceleme</DialogTitle>
        <DialogContent dividers>
          {reviewDlg.loading && <Typography>Yükleniyor...</Typography>}

          {!reviewDlg.loading && reviewDlg.data && (
            <Stack spacing={1.5}>
              <Typography fontWeight={800}>{reviewDlg.data.examTitle}</Typography>
              <Typography color="text.secondary">{reviewDlg.data.user}</Typography>
              <Typography>
                Puan: <b>{reviewDlg.data.score?.toFixed(1) ?? "-"}</b>{" "}
                {reviewDlg.data.isPassed ? "(Başarılı)" : "(Başarısız)"}
              </Typography>

              {/* ✅ Kullanıcıya mesaj */}
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography fontWeight={800} sx={{ mb: 1 }}>
                  Kullanıcıya Mesaj Gönder
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  placeholder="Sınav hakkında kullanıcıya mesaj yazın..."
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                />

                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button
                    variant="contained"
                    disabled={msgSending || !msgText.trim()}
                    onClick={sendAttemptMessage}
                  >
                    {msgSending ? "Gönderiliyor..." : "Gönder"}
                  </Button>
                </Stack>
              </Paper>

              <Divider />

              {reviewDlg.data.questions.map((q) => (
                <Paper key={q.questionId} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={800}>{q.order}. {q.text}</Typography>
                    {q.isCorrect
                      ? <Chip size="small" color="success" label="Doğru" />
                      : <Chip size="small" color="error" label="Yanlış" />
                    }
                  </Stack>

                  <Stack sx={{ mt: 1 }} spacing={0.75}>
                    {q.choices.map((c, i) => {
                      const picked = q.selectedChoiceId === c.id;
                      return (
                        <Stack key={c.id} direction="row" spacing={1} alignItems="center">
                          <Chip size="small" label={["A", "B", "C", "D"][i]} />
                          <Typography sx={{ fontWeight: picked ? 800 : 400 }}>
                            {c.text || "(metin yok)"}
                          </Typography>

                          {c.isCorrect && <Chip size="small" color="success" label="Doğru" />}
                          {picked && <Chip size="small" color={c.isCorrect ? "success" : "error"} label="Seçtiği" />}

                          {c.imageUrl && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                component="img"
                                src={choiceImageSrc(c.imageUrl)}
                                alt="şık görseli"
                                sx={{ width: 80, height: 52, objectFit: "contain", border: 1, borderColor: "divider", borderRadius: 1 }}
                              />
                              <Button
                                size="small"
                                component="a"
                                href={choiceImageSrc(c.imageUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Görsel
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                      );
                    })}

                    {!q.selectedChoiceId && (
                      <Typography variant="body2" color="text.secondary">Kullanıcı cevaplamamış.</Typography>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setReviewDlg({ open: false, loading: false })}>Kapat</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
