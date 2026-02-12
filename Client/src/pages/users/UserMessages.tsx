// src/pages/app/UserMessages.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Divider,
  Stack,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Tooltip,
  useMediaQuery,

  // ✅ NEW
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import api from "../../lib/api";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

type ThreadRow = {
  id: number;
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

export default function UserMessages() {
  const theme = useTheme();
  const mdDown = useMediaQuery(theme.breakpoints.down("md"));

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [text, setText] = useState("");

  // yeni konuşma dialog
  const [openNew, setOpenNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [firstMsg, setFirstMsg] = useState("");

  // ✅ NEW: project select
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState<number>(0);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // mdDown'da list/detail görünümü
  const [pane, setPane] = useState<"list" | "detail">("list");

  // silme confirm
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ---------------- Data Loads ----------------

  const loadThreads = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ThreadRow[]>("/MyMessages/threads");
      setThreads(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get<ThreadDetail>(`/MyMessages/threads/${id}`);
      setDetail(data);
      window.dispatchEvent(new Event("messagesChanged"));
    } finally {
      setDetailLoading(false);
    }
  };

  // ✅ NEW: projects
  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const { data } = await api.get<ProjectOpt[]>("/MyMessages/projects");
      setProjects(data ?? []);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  // ---------------- Actions ----------------

  const closeNew = () => {
    setOpenNew(false);
    setSubject("");
    setFirstMsg("");
    setProjectId(0);
  };

  const createThread = async () => {
    const msg = firstMsg.trim();
    const subj = subject.trim();

    if (projectId <= 0) return;
    if (!subj) return;
    if (!msg) return;

    const { data } = await api.post("/MyMessages/threads", {
      projectId,
      subject: subj,
      message: msg,
    });

    closeNew();

    await loadThreads();
    setSelectedId(data.threadId);
    if (mdDown) setPane("detail");
  };

  const send = async () => {
    if (!selectedId) return;
    const msg = text.trim();
    if (!msg) return;

    await api.post(`/MyMessages/threads/${selectedId}/messages`, { message: msg });
    setText("");
    await loadDetail(selectedId);
    await loadThreads();
  };

  const deleteThread = async (threadId: number) => {
    await api.delete(`/MyMessages/threads/${threadId}`);
    window.dispatchEvent(new Event("messagesChanged"));

    if (selectedId === threadId) {
      setSelectedId(null);
      setDetail(null);
      if (mdDown) setPane("list");
    }

    await loadThreads();
  };

  const deleteAllThreads = async () => {
    await api.delete(`/MyMessages/threads`);
    window.dispatchEvent(new Event("messagesChanged"));

    setSelectedId(null);
    setDetail(null);
    if (mdDown) setPane("list");
    await loadThreads();
  };

  // ---------------- Effects ----------------

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line
  }, []);

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

  // ✅ NEW: dialog açılınca projeleri çek
  useEffect(() => {
    if (openNew) loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNew]);

  const threadsMemo = useMemo(() => threads, [threads]);

  // ---------------- UI Panels ----------------

  const ListPanel = (
    <Paper variant="outlined" sx={{ width: { xs: "100%", md: 340 }, p: 1 }}>
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
                      <Typography fontWeight={800} sx={{ flex: 1 }} component="span">
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
                          {t.projectName}
                        </Typography>
                      )}

                      <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>
                        {dayjs(t.lastMessageAt).format("DD.MM.YYYY HH:mm")}
                      </Typography>

                      {t.lastMessagePreview && (
                        <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
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
              <Typography color="text.secondary">Henüz mesaj yok. “Yeni Mesaj” ile başlayabilirsin.</Typography>
            </Box>
          )}
        </List>
      )}
    </Paper>
  );

  const DetailPanel = (
    <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
      {!selectedId && <Typography color="text.secondary">Bir konuşma seçin.</Typography>}

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
          <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography fontWeight={900}>{detail.subject}</Typography>
              {!!detail.projectName && (
                <Typography variant="body2" color="text.secondary">
                  Proje: {detail.projectName}
                </Typography>
              )}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
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
                  alignSelf: m.isFromAdmin ? "flex-start" : "flex-end",
                  maxWidth: "75%",
                  bgcolor: m.isFromAdmin ? "grey.100" : "primary.light",
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
              placeholder="Mesaj yaz..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={detail.isClosed}
            />
            <Button variant="contained" onClick={send} disabled={!text.trim() || detail.isClosed} sx={{ whiteSpace: "nowrap" }}>
              Gönder
            </Button>
          </Stack>

          {detail.isClosed && (
            <Typography variant="body2" color="text.secondary">
              Bu konuşma kapatılmış.
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );

  // ---------------- Render ----------------

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
        >
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

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button variant="contained" onClick={() => setOpenNew(true)}>
              Yeni Mesaj
            </Button>

            <Button
              color="error"
              variant="outlined"
              onClick={() => setConfirm({ open: true, mode: "all" })}
              startIcon={<DeleteForeverIcon />}
            >
              TÜM KONUŞMALARIMI SİL
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Content */}
        {mdDown ? (
          <Stack spacing={2}>{pane === "list" ? ListPanel : DetailPanel}</Stack>
        ) : (
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            {ListPanel}
            {DetailPanel}
          </Stack>
        )}
      </Paper>

      {/* Yeni Mesaj Dialog */}
      <Dialog open={openNew} onClose={closeNew} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Mesaj</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {/* ✅ NEW: Proje seçimi */}
            <FormControl fullWidth disabled={projectsLoading || projects.length === 0}>
              <InputLabel id="project-select-label">Proje</InputLabel>
              <Select
                labelId="project-select-label"
                label="Proje"
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
              >
                <MenuItem value={0} disabled>
                  {projectsLoading ? "Yükleniyor..." : "Proje seçin"}
                </MenuItem>

                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Konu"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />

            <TextField
              label="Mesaj"
              value={firstMsg}
              onChange={(e) => setFirstMsg(e.target.value)}
              multiline
              minRows={4}
            />
          </Stack>

          {/* İstersen kullanıcı görsün diye minik uyarı */}
          {projects.length === 0 && !projectsLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Proje listesi bulunamadı.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeNew}>Vazgeç</Button>
          <Button
            variant="contained"
            onClick={createThread}
            disabled={projectId <= 0 || !subject.trim() || !firstMsg.trim()}
          >
            Gönder
          </Button>
        </DialogActions>
      </Dialog>

      {/* Silme Onayı */}
      <Dialog open={confirm.open} onClose={() => setConfirm({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>Onay</DialogTitle>
        <DialogContent dividers>
          <Typography>
            {confirm.open && confirm.mode === "all"
              ? "Tüm konuşmalarınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
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
