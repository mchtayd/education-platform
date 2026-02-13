// src/pages/admin/AdminTrainings.tsx
import {
  Typography, Box, Tabs, Tab, Paper, Grid, TextField,
  FormControl, InputLabel, Select, MenuItem, IconButton, Button, Snackbar, Alert,
  Stack, Chip, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import PublishTrainingsTab from "./components/PublishTrainingsTab";
import ProjectManageDialog from "./components/ProjectManageDialog";
import CategoryManageDialog, { type Category } from "./components/CategoryManageDialog";

type Project = { id: number; name: string };
type ContentType = "PDF" | "Video" | "PowerPoint";

type Training = {
  id: number;
  categoryId: number;
  categoryName: string;
  title: string;
  contentType: ContentType;
  date: string;
  fileUrl: string;
  publisherEmail: string;
  projectId?: number | null;
  projectName?: string | null;
};

export default function AdminTrainings() {
  const { user } = useAuth();
  const role = String(user?.role ?? "").toLowerCase();
  const isEducator = role === "educator" || role === "trainer";

  const [tab, setTab] = useState(0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [categoryId, setCategoryId] = useState<number | "">("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("PDF");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [q, setQ] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterType, setFilterType] = useState<"" | ContentType>("");
  const [filterProject, setFilterProject] = useState<number | "">("");

  const [projDialog, setProjDialog] = useState(false);
  const [catDialog, setCatDialog] = useState(false);

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>({
    open: false, msg: "", severity: "success"
  });
  const notify = (msg: string, severity: "success" | "error" = "success") =>
    setSnack({ open: true, msg, severity });

  const accept = (() => {
    if (contentType === "PDF") return "application/pdf";
    if (contentType === "Video") return "video/*";
    return [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ].join(",");
  })();

  const allowedProjectSet = useMemo(() => new Set(projects.map(p => p.id)), [projects]);

  const loadCategories = async () => {
    const { data } = await api.get<Category[]>("/TrainingCategories");
    setCategories(data);
  };

  const loadProjects = async () => {
    // ✅ backend artık educator ise sadece kendi projelerini döndürüyor
    const { data } = await api.get<Project[]>("/Users/projects");
    setProjects(data);
  };

  const loadTrainings = async () => {
    const params: any = {};
    if (q) params.search = q;
    if (filterCategory) params.categoryId = filterCategory;
    if (filterType) params.type = filterType;
    if (filterProject) params.projectId = filterProject;

    const { data } = await api.get<Training[]>("/Trainings", { params });
    setTrainings(data);
  };

  const fullFileUrl = (p: string) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;

  const base = api.defaults.baseURL || window.location.origin;

  try {
    const u = new URL(base);
    return `${u.origin}${p.startsWith("/") ? p : `/${p}`}`;
  } catch {
    return `${window.location.origin}${p.startsWith("/") ? p : `/${p}`}`;
  }
};

  useEffect(() => { loadCategories(); loadProjects(); }, []);
  useEffect(() => { loadTrainings(); }, [q, filterCategory, filterType, filterProject]);

  const resetForm = () => {
    setEditingId(null);
    setCategoryId("");
    setProjectId("");
    setTitle("");
    setContentType("PDF");
    setDate(new Date().toISOString().slice(0, 10));
    setFile(null);
  };

  const onSave = async () => {
    // educator ise proje zorunlu
    if (isEducator && projectId === "") {
      notify("Eğitmen hesabı için proje seçimi zorunludur.", "error");
      return;
    }

    if (!categoryId || !title || !date || (!editingId && !file)) {
      notify("Lütfen zorunlu alanları doldurun.", "error");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("categoryId", String(categoryId));
      fd.append("title", title);
      fd.append("contentType", contentType);
      fd.append("date", date);
      if (file) fd.append("file", file);
      if (user?.email) fd.append("publisherEmail", user.email);
      if (projectId !== "") fd.append("projectId", String(projectId));

      if (editingId) {
        await api.put(`/Trainings/${editingId}`, fd);
        // await api.put(`/api/Trainings/${editingId}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        notify("Eğitim güncellendi.");
      } else {
        await api.post("/Trainings", fd);
        // await api.post("/api/Trainings", fd, { headers: { "Content-Type": "multipart/form-data" } });
        notify("Eğitim kaydedildi.");
      }

      resetForm();
      await loadTrainings();
      setTab(1);
    } catch (e: any) {
      notify(e?.response?.data?.message ?? "İşlem başarısız.", "error");
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Eğitimi silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/Trainings/${id}`);
      notify("Eğitim silindi.");
      await loadTrainings();
    } catch (e: any) {
      notify(e?.response?.data?.message ?? "Silme başarısız.", "error");
    }
  };

  const startEdit = (t: Training) => {
    setEditingId(t.id);
    setCategoryId(t.categoryId);
    setProjectId(t.projectId ?? "");
    setTitle(t.title);
    setContentType(t.contentType);
    setDate(t.date);
    setFile(null);
    setTab(0);
  };

  // ✅ educator için tablo filtreleme (sadece kendi projeleri)
  const filtered = useMemo(() => {
    if (!isEducator) return trainings;
    return trainings.filter(t => (t.projectId ?? 0) > 0 && allowedProjectSet.has(t.projectId!));
  }, [trainings, isEducator, allowedProjectSet]);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
          <Tab label="İçerik Yükle" />
          <Tab label="Tüm Eğitimler" />
          <Tab label="Eğitim Yayınla" />
        </Tabs>
      </Box>

      <Box sx={{ maxWidth: 1400, mx: "auto", p: 2 }}>
        {tab === 0 && (
          <Paper sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} alignItems="flex-end">
                  <FormControl fullWidth>
                    <InputLabel id="cat-lbl">Eğitim Kategorisi</InputLabel>
                    <Select
                      labelId="cat-lbl"
                      label="Eğitim Kategorisi"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value as number)}
                    >
                      {categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Tooltip title={isEducator ? "Eğitmen rolünde pasif" : "Kategori ekle / sil"}>
                    <span>
                      <IconButton disabled={isEducator} onClick={() => !isEducator && setCatDialog(true)}>
                        <AddCircleOutlineIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} alignItems="flex-end">
                  <FormControl fullWidth>
                    <InputLabel id="proj-lbl">Proje {isEducator ? "(zorunlu)" : "(opsiyonel)"}</InputLabel>
                    <Select
                      labelId="proj-lbl"
                      label={`Proje ${isEducator ? "(zorunlu)" : "(opsiyonel)"}`}
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value as number | "")}
                    >
                      {!isEducator && <MenuItem value="">(Seçilmedi)</MenuItem>}
                      {projects.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Tooltip title={isEducator ? "Eğitmen rolünde pasif" : "Proje ekle / sil"}>
                    <span>
                      <IconButton disabled={isEducator} onClick={() => !isEducator && setProjDialog(true)}>
                        <AddCircleOutlineIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Eğitim Başlığı" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="type-lbl">Dosya Türü</InputLabel>
                  <Select
                    labelId="type-lbl"
                    label="Dosya Türü"
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as ContentType)}
                  >
                    <MenuItem value="PDF">PDF</MenuItem>
                    <MenuItem value="Video">Video</MenuItem>
                    <MenuItem value="PowerPoint">PowerPoint</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Tarih"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Button component="label" variant="outlined" fullWidth>
                  {file ? file.name : "Dosya Yükle"}
                  <input hidden type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Button>

                <Typography variant="caption" color="text.secondary">
                  İzin verilen tür:{" "}
                  {contentType === "PDF" ? "PDF" : contentType === "Video" ? "Video" : "PowerPoint (PPT/PPTX)"}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  {editingId && <Chip label={`Düzenleme modunda (#${editingId})`} />}
                  <Button onClick={resetForm}>Temizle</Button>
                  <Button variant="contained" startIcon={<SaveIcon />} onClick={onSave}>Kaydet</Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        )}

        {tab === 1 && (
          <Paper sx={{ p: 2 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2} alignItems="center">
              <TextField
                fullWidth
                placeholder="Ara (başlık)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> as any }}
              />

              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel id="fcat">Kategori</InputLabel>
                <Select labelId="fcat" label="Kategori" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as any)}>
                  <MenuItem value="">Tümü</MenuItem>
                  {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel id="ftype">Tür</InputLabel>
                <Select labelId="ftype" label="Tür" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                  <MenuItem value="">Tümü</MenuItem>
                  <MenuItem value="PDF">PDF</MenuItem>
                  <MenuItem value="Video">Video</MenuItem>
                  <MenuItem value="PowerPoint">PowerPoint</MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel id="fproj">Proje</InputLabel>
                <Select labelId="fproj" label="Proje" value={filterProject} onChange={(e) => setFilterProject(e.target.value as any)}>
                  <MenuItem value="">Tümü</MenuItem>
                  {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Kategori</TableCell>
                    <TableCell>Başlık</TableCell>
                    <TableCell>Tür</TableCell>
                    <TableCell>Tarih</TableCell>
                    <TableCell>İçerik</TableCell>
                    <TableCell>Yayınlayan</TableCell>
                    <TableCell>Proje</TableCell>
                    <TableCell align="right">İşlem</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id} hover>
                      <TableCell>{t.categoryName}</TableCell>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{t.contentType}</TableCell>
                      <TableCell>{t.date}</TableCell>
                      <TableCell>
                        <Tooltip title="Görüntüle">
                          <IconButton component="a" href={fullFileUrl(t.fileUrl)} target="_blank" rel="noopener noreferrer" size="small">
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{t.publisherEmail}</TableCell>
                      <TableCell>{t.projectName ?? "—"}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Güncelle"><IconButton onClick={() => startEdit(t)}><EditIcon /></IconButton></Tooltip>
                        <Tooltip title="Sil"><IconButton color="error" onClick={() => onDelete(t.id)}><DeleteOutlineIcon /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8}>Kayıt yok.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tab === 2 && <PublishTrainingsTab excludeAdmins />}
      </Box>

      <CategoryManageDialog
        open={catDialog && !isEducator}
        onClose={() => setCatDialog(false)}
        onChanged={(list) => setCategories(list)}
      />

      <ProjectManageDialog
        open={projDialog && !isEducator}
        onClose={() => setProjDialog(false)}
        onChanged={(list) => setProjects(list)}
      />

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
