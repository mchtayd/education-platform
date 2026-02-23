// src/pages/admin/AdminUsers.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tooltip,
  Chip,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  Typography,
  Checkbox,
  ListItemText,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { Search, Refresh, Add, Check, Clear, Delete, Edit, AddCircle } from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../lib/api";

type Project = { id: number; name: string };
type Institution = { id: number; name: string };

type RequestRow = {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  institution?: string;
  businessAddress?: string;
  createdAt: string;
  projectId?: number | null;
  projectName?: string | null;
};

type UserRow = {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  institution?: string;
  businessAddress?: string;
  createdAt?: string;
  role: "admin" | "user" | "staff" | "trainer";
  isActive: boolean;

  projectName?: string | null;

  projects?: Array<{ id: number; name: string }>;
  projectIds?: number[];
};

export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const currentTab = params.get("tab") ?? "requests";
  const goTab = (v: string) => setParams({ tab: v });

  const APPROVE_PATH = "/Users/approve-request";

  const [loading, setLoading] = useState(false);

  // ✅ Request satırı -> seçilen proje id listesi
  const [chosenProjects, setChosenProjects] = useState<Record<number, number[]>>({});

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity?: "success" | "error" | "warning" | "info";
  }>({ open: false, msg: "", severity: "warning" });

  // requests
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [reqSearch, setReqSearch] = useState("");

  // users
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");

  // projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [projDialog, setProjDialog] = useState(false);
  const [newProject, setNewProject] = useState("");

  // institutions
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [instDialog, setInstDialog] = useState(false);
  const [newInstitution, setNewInstitution] = useState("");

  // admin-create
  const [createForm, setCreateForm] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
    institution: "",
    businessAddress: "",
    role: "user" as "admin" | "user" | "staff" | "trainer",
    password: "",
    projectIds: [] as number[],
  });

  const isAdminCreate = createForm.role === "admin";

  // edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<null | {
    id: number;
    name: string;
    surname: string;
    email: string;
    phone: string;
    institution: string;
    businessAddress: string;
    role: "admin" | "user" | "staff" | "trainer";
    projectIds: number[];
  }>(null);

  // ---------- Normalizers ----------
  const upperTR = (s: string) => (s ?? "").toLocaleUpperCase("tr-TR");
  const lowerEmail = (s: string) => (s ?? "").trim().toLowerCase();
  const fmt = (v?: string | null) => (v ? v : "");

  // // ✅ MUI multiple Select bazen string döndürebiliyor (autofill)
  // const toNumArray = (v: string | string[]) =>
  //   (typeof v === "string" ? v.split(",") : v).filter(Boolean).map((x) => Number(x));


  // ---------- Loaders ----------
  const loadProjects = async () => {
    const { data } = await api.get<Project[]>("/Users/projects");
    setProjects(data);
  };

  const loadInstitutions = async () => {
    const { data } = await api.get<Institution[]>("/Institutions");
    setInstitutions(data);
  };

  const loadRequests = async () => {
    const { data } = await api.get<RequestRow[]>("/Users/admin-requests", {
      params: { search: reqSearch || undefined },
    });
    setRequests(data);
  };

  const loadUsers = async () => {
    const { data } = await api.get<UserRow[]>("/Users/admin-list", {
      params: { search: userSearch || undefined },
    });
    setUsers(data);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProjects(), loadInstitutions(), loadRequests(), loadUsers()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentTab === "requests") loadRequests();
    if (currentTab === "users") loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  // ✅ Admin seçilirse proje seçimini sıfırla
useEffect(() => {
  if (createForm.role === "admin" && createForm.projectIds.length > 0) {
    setCreateForm((s) => ({ ...s, projectIds: [] }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [createForm.role]);

  // ---------- Project dialog ----------
  const openProjectDialog = () => {
    setNewProject("");
    setProjDialog(true);
  };

  const projectNameById = useMemo(() => {
  return new Map<number, string>(projects.map((p) => [p.id, p.name]));
}, [projects]);

const getProjectLabel = (ids: number[]) => {
  return ids
    .map((id) => projectNameById.get(id))
    .filter((x): x is string => Boolean(x))
    .join(", ");
};

  const createProject = async () => {
    if (!newProject.trim()) return;
    try {
      await api.post("/Users/projects", { name: newProject.trim() });
      await loadProjects();
      setProjDialog(false);
      setSnack({ open: true, msg: "Proje eklendi.", severity: "success" });
    } catch (err: any) {
      setSnack({ open: true, msg: err?.response?.data?.message ?? "Proje eklenemedi.", severity: "error" });
    }
  };

  const deleteProject = async (id: number) => {
    if (!confirm("Projeyi silmek istiyor musunuz?")) return;
    try {
      await api.delete(`/Users/projects/${id}`);
      await loadProjects();
      setSnack({ open: true, msg: "Proje silindi.", severity: "success" });
    } catch (err: any) {
      setSnack({ open: true, msg: err?.response?.data?.message ?? "Proje silinemedi.", severity: "error" });
    }
  };

  // ---------- Institution dialog ----------
  const openInstitutionDialog = () => {
    setNewInstitution("");
    setInstDialog(true);
  };

  const createInstitution = async () => {
    if (!newInstitution.trim()) return;
    try {
      await api.post("/Institutions", { name: newInstitution.trim() });
      await loadInstitutions();
      setInstDialog(false);
      setSnack({ open: true, msg: "Kurum eklendi.", severity: "success" });
    } catch (err: any) {
      setSnack({ open: true, msg: err?.response?.data?.message ?? "Kurum eklenemedi.", severity: "error" });
    }
  };

  const deleteInstitution = async (id: number) => {
    if (!confirm("Kurumu silmek istiyor musunuz?")) return;
    try {
      await api.delete(`/Institutions/${id}`);
      await loadInstitutions();
      setSnack({ open: true, msg: "Kurum silindi.", severity: "success" });
    } catch (err: any) {
      setSnack({ open: true, msg: err?.response?.data?.message ?? "Kurum silinemedi.", severity: "error" });
    }
  };

  // ---------- Requests actions ----------
  const approve = async (r: RequestRow) => {
    const selected = chosenProjects[r.id] ?? (r.projectId ? [r.projectId] : []);
    if (!selected || selected.length === 0) {
      setSnack({ open: true, msg: "Onaylamak için en az 1 proje seçiniz.", severity: "warning" });
      return;
    }

    try {
      await api.post(`${APPROVE_PATH}/${r.id}`, {
        projectIds: selected,
        projectId: selected[0] ?? null, // eski uyum
      });
      setSnack({ open: true, msg: "Talep onaylandı.", severity: "success" });
      await Promise.all([loadRequests(), loadUsers()]);
    } catch (err: any) {
      setSnack({
        open: true,
        msg: err?.response?.data?.message || "Onaylama başarısız.",
        severity: "error",
      });
    }
  };

  const reject = async (r: RequestRow) => {
    if (!confirm("Talebi reddetmek istiyor musunuz?")) return;
    await api.post(`/Users/reject-request/${r.id}`);
    await loadRequests();
  };

  // ---------- Users actions ----------
  const toggleActive = async (u: UserRow) => {
    await api.patch(`/Users/${u.id}/toggle-active`);
    await loadUsers();
  };

  const deleteUser = async (u: UserRow) => {
    if (!confirm("Hesabı silmek istiyor musunuz?")) return;
    await api.delete(`/Users/${u.id}`);
    await loadUsers();
  };

  const openEdit = (u: UserRow) => {
    const [name, ...rest] = (u.fullName || "").split(" ");
    const surname = rest.join(" ");

    const ids = u.projectIds && u.projectIds.length > 0 ? u.projectIds : [];

    setEditUser({
      id: u.id,
      name: name || "",
      surname: surname || "",
      email: u.email,
      phone: u.phone || "",
      institution: u.institution || "",
      businessAddress: u.businessAddress || "",
      role: u.role,
      projectIds: ids,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editUser) return;

    const body = {
      name: upperTR(editUser.name),
      surname: upperTR(editUser.surname),
      phone: editUser.phone || "",
      institution: editUser.institution || "",
      businessAddress: upperTR(editUser.businessAddress || ""),
      role: editUser.role,
      projectIds: editUser.projectIds,
      projectId: editUser.projectIds[0] ?? null,
    };

    try {
      await api.put(`/Users/${editUser.id}`, body);
      setSnack({ open: true, msg: "Kullanıcı güncellendi.", severity: "success" });
      setEditOpen(false);
      setEditUser(null);
      await loadUsers();
    } catch (err: any) {
      setSnack({ open: true, msg: err?.response?.data?.message ?? "Güncelleme başarısız.", severity: "error" });
    }
  };

  const submitCreate = async () => {
    try {
      const body = {
        ...createForm,
        name: upperTR(createForm.name),
        surname: upperTR(createForm.surname),
        email: lowerEmail(createForm.email),
        businessAddress: upperTR(createForm.businessAddress),
        projectIds: createForm.projectIds,
        projectId: createForm.projectIds[0] ?? null,
      };

      await api.post("/Users/admin-create", body);

      setSnack({ open: true, msg: "Kullanıcı oluşturuldu. Direkt giriş yapabilir.", severity: "success" });

      setCreateForm({
        name: "",
        surname: "",
        email: "",
        phone: "",
        institution: "",
        businessAddress: "",
        role: "user",
        password: "",
        projectIds: [],
      });

      await loadUsers();
      goTab("users");
    } catch (err: any) {
      setSnack({ open: true, msg: err?.response?.data?.message ?? "Kullanıcı oluşturulamadı.", severity: "error" });
    }
  };

  const filteredRequests = useMemo(() => requests, [requests]);
  const filteredUsers = useMemo(() => users, [users]);

  const userProjectsText = (u: UserRow) => {
  // 1) backend "projects" dönerse en doğru kaynak
  if (u.projects && u.projects.length > 0) return u.projects.map(p => p.name).join(", ");

  // 2) backend sadece projectIds dönerse, projects state'inden isimlere çevir
  if (u.projectIds && u.projectIds.length > 0) {
    return u.projectIds
      .map(id => projectNameById.get(id))
      .filter(Boolean)
      .join(", ");
  }

  // 3) eski fallback
  return fmt(u.projectName);
};

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Tabs value={currentTab} onChange={(_, v) => goTab(v)} centered textColor="primary" indicatorColor="primary">
            <Tab value="requests" label="HESAP OLUŞTURMA TALEPLERİ" />
            <Tab value="users" label="TÜM KULLANICILAR" />
            <Tab value="create" label="HESAP OLUŞTUR" />
          </Tabs>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* ---------- REQUESTS TAB ---------- */}
        {currentTab === "requests" && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Talep sahibi e-posta/isim ara"
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              />
              <Button variant="text" startIcon={<Refresh />} onClick={loadRequests}>
                Yenile
              </Button>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ad Soyad</TableCell>
                  <TableCell>E-Posta</TableCell>
                  <TableCell>Telefon</TableCell>
                  <TableCell>Kurum</TableCell>
                  <TableCell>İş Yeri Adres</TableCell>
                  <TableCell>Kayıt Tarihi</TableCell>
                  <TableCell>Proje</TableCell>
                  <TableCell align="center">İşlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>Kayıt yok.</TableCell>
                  </TableRow>
                )}

                {filteredRequests.map((r) => {
                  const selectedIds = chosenProjects[r.id] ?? (r.projectId ? [r.projectId] : []);

                  return (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.fullName}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{fmt(r.phone)}</TableCell>
                      <TableCell>{fmt(r.institution)}</TableCell>
                      <TableCell>{fmt(r.businessAddress)}</TableCell>
                      <TableCell>{dayjs(r.createdAt).format("DD.MM.YYYY")}</TableCell>

                      {/* ✅ Çoklu proje seçimi (TS fix: <Select<string[]>>) */}
                      <TableCell sx={{ minWidth: 320 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FormControl size="small" sx={{ minWidth: 250 }}>
                            <InputLabel id={`proj-lbl-${r.id}`}>Proje</InputLabel>

                            {/* REQUESTS TAB - Çoklu Select TS fix */}
<Select<string[]>
  labelId={`proj-lbl-${r.id}`}
  label="Proje"
  multiple
  value={selectedIds.map(String)}
  onChange={(e) => {
    const arr = (e.target.value as string[]).map(Number);
    setChosenProjects((prev) => ({ ...prev, [r.id]: arr }));
  }}
  renderValue={(selected) => {
    const ids = (selected as string[]).map(Number);
    return ids.length ? getProjectLabel(ids) : "(Seçiniz)";
  }}
>
  {projects.map((p) => (
    <MenuItem key={p.id} value={String(p.id)}>
      <Checkbox checked={selectedIds.includes(p.id)} />
      <ListItemText primary={p.name} />
    </MenuItem>
  ))}
</Select>
                          </FormControl>

                          <Tooltip title="Proje ekle">
                            <IconButton onClick={openProjectDialog} size="small">
                              <AddCircle />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>

                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title={selectedIds.length ? "Onayla" : "Önce proje seçin"}>
                            <span>
                              <IconButton
                                color="success"
                                onClick={() => approve(r)}
                                disabled={selectedIds.length === 0}
                                size="small"
                              >
                                <Check />
                              </IconButton>
                            </span>
                          </Tooltip>

                          <Tooltip title="Reddet">
                            <IconButton color="error" onClick={() => reject(r)} size="small">
                              <Clear />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Stack>
        )}

        {/* ---------- USERS TAB ---------- */}
        {currentTab === "users" && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Kullanıcı ara"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              />
              <Button variant="text" startIcon={<Refresh />} onClick={loadUsers}>
                Yenile
              </Button>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ad Soyad</TableCell>
                  <TableCell>E-Posta</TableCell>
                  <TableCell>Telefon</TableCell>
                  <TableCell>Kurum</TableCell>
                  <TableCell>İş Yeri Adres</TableCell>
                  <TableCell>Kayıt Tarihi</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Proje</TableCell>
                  <TableCell align="center">İşlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>Kayıt yok.</TableCell>
                  </TableRow>
                )}

                {filteredUsers.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.fullName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{fmt(u.phone)}</TableCell>
                    <TableCell>{fmt(u.institution)}</TableCell>
                    <TableCell>{fmt(u.businessAddress)}</TableCell>
                    <TableCell>{u.createdAt ? dayjs(u.createdAt).format("DD.MM.YYYY") : ""}</TableCell>
                    <TableCell><Chip size="small" label={u.role} /></TableCell>
                    <TableCell>{userProjectsText(u)}</TableCell>

                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                        <Tooltip title={u.isActive ? "Pasifleştir" : "Aktifleştir"}>
                          <Switch checked={u.isActive} onChange={() => toggleActive(u)} size="small" />
                        </Tooltip>

                        <Tooltip title="Düzenle">
                          <IconButton size="small" onClick={() => openEdit(u)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Sil">
                          <IconButton size="small" color="error" onClick={() => deleteUser(u)}>
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        )}

        {/* ---------- CREATE TAB ---------- */}
        {currentTab === "create" && (
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Box sx={{ width: "100%", maxWidth: 980 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Ad"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((s) => ({ ...s, name: upperTR(e.target.value) }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Soyad"
                    value={createForm.surname}
                    onChange={(e) => setCreateForm((s) => ({ ...s, surname: upperTR(e.target.value) }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="E-posta"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((s) => ({ ...s, email: lowerEmail(e.target.value) }))}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Telefon"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl fullWidth>
                      <InputLabel id="inst-create">Kurum</InputLabel>
                      <Select
                        labelId="inst-create"
                        label="Kurum"
                        value={createForm.institution}
                        onChange={(e) => setCreateForm((s) => ({ ...s, institution: e.target.value as string }))}
                      >
                        <MenuItem value="">
                          <em>(Seçiniz)</em>
                        </MenuItem>
                        {institutions.map((k) => (
                          <MenuItem key={k.id} value={k.name}>
                            {k.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Tooltip title="Kurum ekle">
                      <IconButton onClick={openInstitutionDialog} sx={{ mt: 0.2 }}>
                        <AddCircle />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="İş Yeri Adresi"
                    value={createForm.businessAddress}
                    onChange={(e) => setCreateForm((s) => ({ ...s, businessAddress: upperTR(e.target.value) }))}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="password"
                    label="Parola"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel id="role-create">Rol</InputLabel>
                    <Select
                      labelId="role-create"
                      label="Rol"
                      value={createForm.role}
                      onChange={(e) => setCreateForm((s) => ({ ...s, role: e.target.value as any }))}
                    >
                      <MenuItem value="user">user</MenuItem>
                      <MenuItem value="staff">staff</MenuItem>
                      <MenuItem value="trainer">trainer</MenuItem>
                      <MenuItem value="admin">admin</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* ✅ Proje: çoklu (TS fix: <Select<string[]>>) */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FormControl fullWidth>
                      <InputLabel id="proj-create">Proje</InputLabel>

                      {/* CREATE TAB - Çoklu Select TS fix */}
<Select<string[]>
  labelId="proj-create"
  label="Proje"
  disabled={isAdminCreate}
  multiple
  value={createForm.projectIds.map(String)}
  onChange={(e) => {
    const arr = (e.target.value as string[]).map(Number);
    setCreateForm((s) => ({ ...s, projectIds: arr }));
  }}
  renderValue={(selected) => {
    const ids = (selected as string[]).map(Number);
    return ids.length ? getProjectLabel(ids) : "(Seçimsiz)";
  }}
>
  {projects.map((p) => (
    <MenuItem key={p.id} value={String(p.id)}>
      <Checkbox checked={createForm.projectIds.includes(p.id)} />
      <ListItemText primary={p.name} />
    </MenuItem>
  ))}
</Select>
                    </FormControl>

                    <Tooltip title="Proje ekle">
                      <IconButton onClick={openProjectDialog} sx={{ mt: 0.2 }}>
                        <AddCircle />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" justifyContent="flex-end">
                    <Button variant="contained" startIcon={<Add />} onClick={submitCreate} disabled={loading}>
                      Hesap Oluştur
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    Not: Bu ekrandan oluşturulan kullanıcılar <b>direkt aktif</b> kaydedilir ve hemen giriş yapabilir.
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Proje Ekle dialog */}
      <Dialog open={projDialog} onClose={() => setProjDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Yeni Proje</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Proje Adı"
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
          />
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1}>
            {projects.map((p) => (
              <Stack key={p.id} direction="row" alignItems="center" justifyContent="space-between">
                <Box>{p.name}</Box>
                <IconButton size="small" color="error" onClick={() => deleteProject(p.id)}>
                  <Delete />
                </IconButton>
              </Stack>
            ))}
            {projects.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Kayıtlı proje yok.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjDialog(false)}>Vazgeç</Button>
          <Button variant="contained" startIcon={<Add />} onClick={createProject}>
            Ekle
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kurum Ekle dialog */}
      <Dialog open={instDialog} onClose={() => setInstDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Yeni Kurum</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Kurum Adı"
            value={newInstitution}
            onChange={(e) => setNewInstitution(e.target.value)}
          />
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1}>
            {institutions.map((k) => (
              <Stack key={k.id} direction="row" alignItems="center" justifyContent="space-between">
                <Box>{k.name}</Box>
                <IconButton size="small" color="error" onClick={() => deleteInstitution(k.id)}>
                  <Delete />
                </IconButton>
              </Stack>
            ))}
            {institutions.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Kayıtlı kurum yok.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstDialog(false)}>Vazgeç</Button>
          <Button variant="contained" startIcon={<Add />} onClick={createInstitution}>
            Ekle
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kullanıcı Düzenle dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Kullanıcıyı Düzenle</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {editUser && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Ad"
                  value={editUser.name}
                  onChange={(e) => setEditUser((s) => (s ? { ...s, name: upperTR(e.target.value) } : s))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Soyad"
                  value={editUser.surname}
                  onChange={(e) => setEditUser((s) => (s ? { ...s, surname: upperTR(e.target.value) } : s))}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="E-posta" value={editUser.email} disabled />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Telefon"
                  value={editUser.phone}
                  onChange={(e) => setEditUser((s) => (s ? { ...s, phone: e.target.value } : s))}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl fullWidth>
                    <InputLabel id="inst-edit">Kurum</InputLabel>
                    <Select
                      labelId="inst-edit"
                      label="Kurum"
                      value={editUser.institution}
                      onChange={(e) => setEditUser((s) => (s ? { ...s, institution: e.target.value as string } : s))}
                    >
                      <MenuItem value="">
                        <em>(Seçiniz)</em>
                      </MenuItem>
                      {institutions.map((k) => (
                        <MenuItem key={k.id} value={k.name}>
                          {k.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Tooltip title="Kurum ekle">
                    <IconButton onClick={openInstitutionDialog}>
                      <AddCircle />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="İş Yeri Adresi"
                  value={editUser.businessAddress}
                  onChange={(e) =>
                    setEditUser((s) => (s ? { ...s, businessAddress: upperTR(e.target.value) } : s))
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="role-edit">Rol</InputLabel>
                  <Select
                    labelId="role-edit"
                    label="Rol"
                    value={editUser.role}
                    onChange={(e) => setEditUser((s) => (s ? { ...s, role: e.target.value as any } : s))}
                  >
                    <MenuItem value="user">user</MenuItem>
                    <MenuItem value="staff">staff</MenuItem>
                    <MenuItem value="trainer">eğitmen</MenuItem>
                    <MenuItem value="admin">admin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* ✅ Proje: çoklu (TS fix: <Select<string[]>>) */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl fullWidth>
                    <InputLabel id="proj-edit">Proje</InputLabel>

                    {/* EDIT DIALOG - Çoklu Select TS fix */}
<Select<string[]>
  labelId="proj-edit"
  label="Proje"
  multiple
  value={editUser.projectIds.map(String)}
  onChange={(e) => {
    const arr = (e.target.value as string[]).map(Number);
    setEditUser((s) => (s ? { ...s, projectIds: arr } : s));
  }}
  renderValue={(selected) => {
    const ids = (selected as string[]).map(Number);
    return ids.length ? getProjectLabel(ids) : "(Seçimsiz)";
  }}
>
  {projects.map((p) => (
    <MenuItem key={p.id} value={String(p.id)}>
      <Checkbox checked={editUser.projectIds.includes(p.id)} />
      <ListItemText primary={p.name} />
    </MenuItem>
  ))}
</Select>
                  </FormControl>

                  <Tooltip title="Proje ekle">
                    <IconButton onClick={openProjectDialog}>
                      <AddCircle />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Vazgeç</Button>
          <Button variant="contained" onClick={saveEdit}>
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
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
