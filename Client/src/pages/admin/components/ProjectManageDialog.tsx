//components/ProjectManageDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import api from "../../../lib/api";

type Project = { id: number; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged?: (projects: Project[]) => void;
};

export default function ProjectManageDialog({ open, onClose, onChanged }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    const { data } = await api.get<Project[]>("/api/Users/projects");
    setProjects(data);
    onChanged?.(data);
  };

  useEffect(() => {
    if (open) {
      setError(null);
      setNewName("");
      loadProjects().catch(() => setError("Projeler yüklenemedi."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addProject = async () => {
    const name = newName.trim();
    if (!name) return;

    setBusy(true);
    setError(null);
    try {
      await api.post("/api/Users/projects", { name });
      setNewName("");
      await loadProjects();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Proje eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async (id: number) => {
    if (!confirm("Projeyi silmek istiyor musunuz?")) return;

    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/Users/projects/${id}`);
      await loadProjects();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Proje silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Projeler</DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* ÜST SATIR: Proje adı + sağda EKLE butonu (görseldeki gibi) */}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              placeholder="Proje Adı"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") addProject();
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addProject}
              disabled={busy || !newName.trim()}
              sx={{ whiteSpace: "nowrap" }}
            >
              EKLE
            </Button>
          </Stack>

          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Kayıtlı Projeler
          </Typography>

          {/* TABLO: Proje | İşlem (görseldeki gibi) */}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Proje</TableCell>
                  <TableCell align="right">İşlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.name}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => deleteProject(p.id)}
                        disabled={busy}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}

                {projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2}>Kayıt yok.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>

      {/* ALT: sadece KAPAT (görseldeki gibi) */}
      <DialogActions>
        <Button onClick={onClose}>KAPAT</Button>
      </DialogActions>
    </Dialog>
  );
}
