// src/pages/admin/AdminMessages.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  Stack,
  TextField,
  InputAdornment,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,

  // ✅ NEW
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Refresh, Search } from "@mui/icons-material";
import dayjs from "dayjs";
import api from "../../lib/api";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

type ThreadRow = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  subject: string;
  lastMessageAt: string;
  lastMessagePreview?: string | null;
  unreadCount: number;
  isClosed: boolean;

  projectName?: string | null;
};

type Msg = {
  id: number;
  isFromAdmin: boolean;
  senderUserId: number;
  body: string;
  createdAt: string;
};

type ThreadDetail = {
  id: number;
  subject: string;
  userId: number;
  userName: string;
  userEmail: string;
  createdAt: string;
  lastMessageAt: string;
  isClosed: boolean;
  messages: Msg[];

  projectName?: string | null;
};

type ConfirmState =
  | { open: false }
  | { open: true; mode: "single"; threadId: number }
  | { open: true; mode: "all" };

// ✅ NEW
type ProjectOpt = { id: number; name: string };

export default function AdminMessages() {
  const theme = useTheme();
  const mdDown = useMediaQuery(theme.breakpoints.down("md"));

  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [loading, setLoading] = useState(false);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);

  const [text, setText] = useState("");

  const [pane, setPane] = useState<"list" | "detail">("list");
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ✅ NEW: projects + filter
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState<number>(0);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const { data } = await api.get<ProjectOpt[]>("/Messages/projects");
      setProjects(data ?? []);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadThreads = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ThreadRow[]>("/Messages/threads", {
        params: {
          search: qDeb || undefined,
          projectId: projectId > 0 ? projectId : undefined, // ✅ NEW
        },
      });
      setThreads(data);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get<ThreadDetail>(`/Messages/threads/${id}`);
      setDetail(data);
      window.dispatchEvent(new Event("messagesChanged"));
    } finally {
      setDetailLoading(false);
    }
  };

  const send = async () => {
    if (!selectedId) return;
    const msg = text.trim();
    if (!msg) return;

    await api.post(`/Messages/threads/${selectedId}/messages`, { message: msg });
    setText("");
    await loadDetail(selectedId);
    await loadThreads();
    window.dispatchEvent(new Event("messagesChanged"));
  };

  const deleteThread = async (threadId: number) => {
    await api.delete(`/Messages/threads/${threadId}`);
    window.dispatchEvent(new Event("messagesChanged"));

    if (selectedId === threadId) {
      setSelectedId(null);
      setDetail(null);
      if (mdDown) setPane("list");
    }

    await loadThreads();
  };

  const deleteAllThreads = async () => {
    await api.delete(`/Messages/threads`);
    window.dispatchEvent(new Event("messagesChanged"));

    setSelectedId(null);
    setDetail(null);
    if (mdDown) setPane("list");
    await loadThreads();
  };

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setQDeb(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // ✅ ilk girişte projeleri çek
  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ qDeb veya projectId değişince listeyi yenile
  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDeb, projectId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [detail?.messages?.length]);

  useEffect(() => {
    if (!mdDown) setPane("list");
  }, [mdDown]);

  const threadsMemo = useMemo(() => threads, [threads]);

  const ListPanel = (
    <Paper variant="outlined" sx={{ width: { xs: "100%", md: 360 }, p: 1 }}>
      {/* ✅ Search + Project filter + Refresh */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ p: 1 }}
      >
        <TextField
          size="small"
          placeholder="Ara (kullanıcı / konu / proje)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />

        {/* ✅ NEW: Project Select */}
        <FormControl size="small" sx={{ minWidth: 180 }} disabled={projectsLoading}>
          <InputLabel id="project-filter-label">Proje</InputLabel>
          <Select
            labelId="project-filter-label"
            label="Proje"
            value={projectId}
            onChange={(e) => setProjectId(Number(e.target.value))}
          >
            <MenuItem value={0}>Tümü</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button startIcon={<Refresh />} onClick={loadThreads} sx={{ whiteSpace: "nowrap" }}>
          Yenile
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ px: 1, pb: 1 }}>
        <Button
          color="error"
          variant="outlined"
          size="small"
          startIcon={<DeleteForeverIcon />}
          onClick={() => setConfirm({ open: true, mode: "all" })}
        >
          TÜM MESAJLARI SİL
        </Button>
      </Stack>

      <Divider sx={{ mb: 1 }} />

      {loading ? (
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={22} />
        </Box>
      ) : (
        <List sx={{ p: 0, maxHeight: { xs: 420, md: 520 }, overflow: "auto" }}>
          {threadsMemo.map((t) => (
            <ListItemButton
              key={t.id}
              selected={t.id === selectedId}
              onClick={() => {
                setSelectedId(t.id);
                if (mdDown) setPane("detail");
              }}
              sx={{ alignItems: "flex-start" }}
            >
              <ListItemText
                primaryTypographyProps={{ component: "span" }}
                secondaryTypographyProps={{ component: "span" }}
                primary={
                  <Box component="span" sx={{ display: "block" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={800} sx={{ flex: 1, pr: 1 }} component="span">
                        {t.subject}
                      </Typography>

                      {t.unreadCount > 0 && <Chip size="small" color="primary" label={t.unreadCount} />}

                      <Tooltip title="Konuşmayı Sil">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirm({ open: true, mode: "single", threadId: t.id });
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                }
                secondary={
                  <Box component="span" sx={{ display: "block" }}>
                    <Stack spacing={0.25}>
                      {!!t.projectName && (
                        <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>
                          Proje: {t.projectName}
                        </Typography>
                      )}

                      <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
                        {t.userName} • {t.userEmail}
                      </Typography>

                      <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>
                        {dayjs(t.lastMessageAt).format("DD.MM.YYYY HH:mm")}
                      </Typography>

                      {t.lastMessagePreview && (
                        <Typography variant="body2" component="span" sx={{ mt: 0.5, display: "block" }} color="text.secondary">
                          {t.lastMessagePreview.length > 80
                            ? t.lastMessagePreview.slice(0, 80) + "…"
                            : t.lastMessagePreview}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                }
              />
            </ListItemButton>
          ))}

          {threadsMemo.length === 0 && (
            <Box sx={{ p: 2 }}>
              <Typography color="text.secondary">Kayıt yok.</Typography>
            </Box>
          )}
        </List>
      )}
    </Paper>
  );

  const DetailPanel = (
    <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
      {!selectedId && <Typography color="text.secondary">Soldan bir konuşma seçin.</Typography>}

      {selectedId && detailLoading && (
        <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {selectedId && detail && (
        <Stack
          spacing={1.5}
          sx={{
            height: { xs: "calc(100dvh - 280px)", md: 560 },
            minHeight: { xs: 520, md: 560 },
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography fontWeight={900}>{detail.subject}</Typography>

              {!!detail.projectName && (
                <Typography variant="body2" color="text.secondary">
                  Proje: {detail.projectName}
                </Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                {detail.userName} ({detail.userEmail})
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: "flex-start", sm: "flex-end" }}>
              <Button
                color="error"
                variant="outlined"
                size="small"
                startIcon={<DeleteForeverIcon />}
                onClick={() => setConfirm({ open: true, mode: "single", threadId: detail.id })}
              >
                TÜM MESAJLARI SİL
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              overflow: "auto",
              pr: 1,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            {detail.messages.map((m) => (
              <Box
                key={m.id}
                sx={{
                  alignSelf: m.isFromAdmin ? "flex-end" : "flex-start",
                  maxWidth: "75%",
                  bgcolor: m.isFromAdmin ? "primary.light" : "grey.100",
                  borderRadius: 2,
                  p: 1.2,
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {m.body}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(m.createdAt).format("DD.MM.YYYY HH:mm")}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
            <TextField
              fullWidth
              multiline
              minRows={2}
              placeholder="Yanıt yaz..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button variant="contained" onClick={send} disabled={!text.trim()} sx={{ whiteSpace: "nowrap" }}>
              Gönder
            </Button>
          </Stack>
        </Stack>
      )}
    </Paper>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {mdDown && pane === "detail" && (
            <IconButton onClick={() => setPane("list")} size="small">
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" fontWeight={800}>
            Mesajlar
          </Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {mdDown ? (
          <Stack spacing={2}>{pane === "list" ? ListPanel : DetailPanel}</Stack>
        ) : (
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {ListPanel}
            {DetailPanel}
          </Stack>
        )}
      </Paper>

      {/* Silme Onayı */}
      <Dialog open={confirm.open} onClose={() => setConfirm({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>Onay</DialogTitle>
        <DialogContent dividers>
          <Typography>
            {confirm.open && confirm.mode === "all"
              ? "Sistemdeki tüm mesaj konuşmalarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
              : "Bu konuşmayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false })}>Vazgeç</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!confirm.open) return;
              const c = confirm;
              setConfirm({ open: false });
              if (c.mode === "all") await deleteAllThreads();
              else await deleteThread(c.threadId);
            }}
          >
            Sil
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
