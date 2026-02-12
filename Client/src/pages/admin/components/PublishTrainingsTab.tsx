// src/pages/admin/components/PublishTrainingsTab.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Stack,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tooltip,
} from "@mui/material";
import { Autocomplete } from "@mui/material";
import { Person, Groups, Search, Check, Delete as DeleteIcon } from "@mui/icons-material";
import api from "../../../lib/api";
import dayjs from "dayjs";

type Training = { id: number; title: string; projectId?: number | null };

type UserItem = {
  id: number;
  fullName: string;
  email: string;
  projectId?: number | null;
  projectName?: string | null;
  role?: string;
  isActive?: boolean;
};

type Project = { id: number; name: string };

type AssignmentRow = {
  id: number;
  createdAt: string;
  trainingId: number;
  trainingTitle: string;
  kind: "user" | "project";
  targetId: number;
  targetName: string;

  // ✅ NEW
  unpublishAt?: string | null;
};

type PublishTrainingsTabProps = {
  /** Admin kullanıcılar listeden gizlensin mi? (default: true) */
  excludeAdmins?: boolean;
};

export default function PublishTrainingsTab({ excludeAdmins = true }: PublishTrainingsTabProps) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [mode, setMode] = useState<"user" | "project">("user");
  const [selectedTrainings, setSelectedTrainings] = useState<Training[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // ✅ NEW: Yayında kalma (yayından kalkış) tarihi (YYYY-MM-DD veya "")
  const [unpublishDate, setUnpublishDate] = useState<string>("");

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    type: "success" | "error" | "info" | "warning";
  }>({ open: false, msg: "", type: "success" });

  const isAdminUser = (u: UserItem) => {
    const role = (u.role || "").toLowerCase();
    if (role === "admin") return true;

    // fallback (backend role vermiyorsa)
    const email = (u.email || "").toLowerCase();
    const name = (u.fullName || "").toLowerCase();
    if (email === "admin@edu.local") return true;
    if (name.startsWith("admin ")) return true;

    return false;
  };

  const loadData = async () => {
    const { data } = await api.get("/Trainings/assign-data");

    setTrainings(data.trainings);
    setProjects(data.projects);

    const rawUsers: UserItem[] = data.users ?? [];
    let list = rawUsers;

    // ✅ pasifleri gösterme (backend isActive veriyorsa)
    list = list.filter((u) => (typeof u.isActive === "boolean" ? u.isActive : true));

    // ✅ adminleri gizle
    if (excludeAdmins) {
      list = list.filter((u) => !isAdminUser(u));
    }

    setUsers(list);
  };

  const loadAssignments = async () => {
    const { data } = await api.get("/Trainings/assignments", {
      params: { search: search || undefined },
    });
    setAssignments(data ?? []);
  };

  useEffect(() => {
    loadData();
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Proje seçildiğinde o projeye bağlı eğitimleri otomatik seç
  useEffect(() => {
    if (mode === "project" && selectedProject) {
      const pick = trainings.filter((t) => (t.projectId ?? 0) === selectedProject.id);
      setSelectedTrainings(pick);
    }
  }, [mode, selectedProject, trainings]);

  // Kullanıcı(lar) seçilince kullanıcıların projelerine göre eğitimleri otomatik doldur
  useEffect(() => {
    if (mode !== "user") return;

    if (selectedUsers.length === 0) {
      setSelectedTrainings([]);
      return;
    }

    const projectIds = new Set(
      selectedUsers.map((u) => u.projectId).filter((x): x is number => typeof x === "number")
    );

    if (projectIds.size === 0) {
      setSelectedTrainings([]);
      return;
    }

    const pick = trainings.filter((t) => t.projectId != null && projectIds.has(t.projectId));
    setSelectedTrainings(pick);
  }, [mode, selectedUsers, trainings]);

  const publishDisabled =
    selectedTrainings.length === 0 ||
    (mode === "user" ? selectedUsers.length === 0 : !selectedProject);

  const publish = async () => {
    try {
      const trainingIds = Array.from(new Set(selectedTrainings.map((t) => t.id)));

      // ✅ unpublishDate -> ISO (UTC midnight) veya null
      const unpublishDateIso =
        unpublishDate && unpublishDate.trim()
          ? new Date(`${unpublishDate}T00:00:00Z`).toISOString()
          : null;

      if (mode === "user") {
        const safeUsers = excludeAdmins ? selectedUsers.filter((u) => !isAdminUser(u)) : selectedUsers;
        const userIds = Array.from(new Set(safeUsers.map((u) => u.id)));

        if (userIds.length === 0) {
          setSnack({
            open: true,
            msg: "Admin kullanıcıya atama yapılamaz. Lütfen kullanıcı seçiniz.",
            type: "warning",
          });
          return;
        }

        await api.post("/Trainings/assign-to-users", {
          trainingIds,
          userIds,
          unpublishDate: unpublishDateIso, // ✅ NEW
        });
      } else {
        await api.post("/Trainings/assign-to-project", {
          trainingIds,
          projectId: selectedProject!.id,
          unpublishDate: unpublishDateIso, // ✅ NEW
        });
      }

      setSnack({ open: true, msg: "Atama tamamlandı.", type: "success" });
      setSelectedTrainings([]);
      setSelectedUsers([]);
      setSelectedProject(null);
      setUnpublishDate("");
      await loadAssignments();
    } catch (e: any) {
      console.error(e?.response?.data || e);
      setSnack({
        open: true,
        msg: e?.response?.data?.message || "Atama yapılamadı.",
        type: "error",
      });
    }
  };

  const removeAssignment = async (row: AssignmentRow) => {
    if (!confirm("Bu atama geri alınsın mı?")) return;
    await api.delete(`/Trainings/assignments/${row.id}`);
    await loadAssignments();
  };

  const userOptions = useMemo(() => users, [users]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Eğitim Yayınla / Atama Yap
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <Autocomplete
            multiple
            options={trainings}
            value={selectedTrainings}
            onChange={(_, v) => setSelectedTrainings(v)}
            getOptionLabel={(o) => o.title}
            renderInput={(params) => <TextField {...params} label="Eğitim(ler)" placeholder="Seçiniz" />}
            sx={{ minWidth: 320, flex: 1 }}
          />

          <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)}>
            <ToggleButton value="user">
              <Person sx={{ mr: 0.5 }} />
              Kullanıcıya
            </ToggleButton>
            <ToggleButton value="project">
              <Groups sx={{ mr: 0.5 }} />
              Projeye
            </ToggleButton>
          </ToggleButtonGroup>

          {mode === "user" ? (
            <Autocomplete
              multiple
              options={userOptions}
              value={selectedUsers}
              onChange={(_, v) => setSelectedUsers(v)}
              getOptionLabel={(o) => `${o.fullName} (${o.email})`}
              getOptionDisabled={(o) => (excludeAdmins ? isAdminUser(o) : false)}
              renderInput={(params) => <TextField {...params} label="Kullanıcı(lar)" placeholder="Seçiniz" />}
              sx={{ minWidth: 360, flex: 1 }}
            />
          ) : (
            <Autocomplete
              options={projects}
              value={selectedProject}
              onChange={(_, v) => setSelectedProject(v)}
              getOptionLabel={(o) => o.name}
              renderInput={(params) => <TextField {...params} label="Proje" placeholder="Seçiniz" />}
              sx={{ minWidth: 280, flex: 1 }}
            />
          )}

          {/* ✅ NEW */}
          <TextField
            label="Yayında Kalma Tarihi"
            type="date"
            value={unpublishDate}
            onChange={(e) => setUnpublishDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 220 }}
            helperText="Boş bırakılırsa yayında kalır."
          />

          <Button variant="contained" startIcon={<Check />} disabled={publishDisabled} onClick={publish}>
            Yayınla
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Atamalarda ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 360 }}
          />
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              {[
                <TableCell key="h1">Tarih</TableCell>,
                <TableCell key="h2">Eğitim</TableCell>,
                <TableCell key="h3">Tür</TableCell>,
                <TableCell key="h4">Hedef</TableCell>,
                <TableCell key="h5">Yayından Kalkış</TableCell>,
                <TableCell key="h6" align="center">
                  İşlem
                </TableCell>,
              ]}
            </TableRow>
          </TableHead>

          <TableBody>
            {assignments.length === 0 ? (
              <TableRow>
                {[
                  <TableCell key="e1" colSpan={6}>
                    Kayıt yok.
                  </TableCell>,
                ]}
              </TableRow>
            ) : (
              assignments.map((r) => (
                <TableRow key={r.id} hover>
                  {[
                    <TableCell key="c1">{dayjs(r.createdAt).format("DD.MM.YYYY HH:mm")}</TableCell>,
                    <TableCell key="c2">{r.trainingTitle}</TableCell>,
                    <TableCell key="c3">{r.kind === "user" ? "Kullanıcı" : "Proje"}</TableCell>,
                    <TableCell key="c4">{r.targetName}</TableCell>,
                    <TableCell key="c5">
                      {r.unpublishAt ? dayjs(r.unpublishAt).format("DD.MM.YYYY") : "-"}
                    </TableCell>,
                    <TableCell key="c6" align="center">
                      <Tooltip title="Atamayı geri al">
                        <IconButton size="small" color="error" onClick={() => removeAssignment(r)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>,
                  ]}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
