import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Divider,
  Alert,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import api from "../../../lib/api";

export type Category = { id: number; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged?: (list: Category[]) => void; // parent listeyi güncellesin diye
};

export default function CategoryManageDialog({ open, onClose, onChanged }: Props) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await api.get<Category[]>("/api/TrainingCategories");
    setItems(data);
    onChanged?.(data);
  };

  useEffect(() => {
    if (open) {
      setError(null);
      setName("");
      load().catch((e: any) => setError(e?.response?.data?.message ?? "Kategoriler yüklenemedi."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const create = async () => {
    const v = name.trim();
    if (!v) return;

    setBusy(true);
    setError(null);
    try {
      await api.post("/api/TrainingCategories", { name: v });
      setName("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Kategori eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Kategoriyi silmek istiyor musunuz?")) return;

    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/TrainingCategories/${id}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Kategori silinemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Kategoriler</DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* üst satır: input + sağda EKLE */}
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            placeholder="Kategori Adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            disabled={busy}
          />
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={create}
            disabled={busy || !name.trim()}
            sx={{ minWidth: 120 }}
          >
            EKLE
          </Button>
        </Stack>

        <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
          Kayıtlı Kategoriler
        </Typography>

        <Divider sx={{ mb: 1 }} />

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kategori</TableCell>
              <TableCell align="right">İşlem</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2}>Kayıt yok.</TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => remove(c.id)}
                      disabled={busy}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>KAPAT</Button>
      </DialogActions>
    </Dialog>
  );
}
