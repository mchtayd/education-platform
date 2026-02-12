// src/pages/users/UserExamDetail.tsx
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  Chip,
  Snackbar,
  Alert,
} from "@mui/material";
import { PlayArrow, Replay, OpenInNew } from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/api";

type Detail = {
  examId: number;
  title: string;
  durationMinutes: number;
  questionCount: number;
  status: "not_started" | "in_progress" | "completed";
  attemptId?: number | null;
  score?: number | null;
  isPassed?: boolean | null;
};

export default function UserExamDetail() {
  const { examId } = useParams();
  const nav = useNavigate();

  const [data, setData] = useState<Detail | null>(null);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    type: "success" | "error" | "info" | "warning";
  }>({ open: false, msg: "", type: "info" });

  const load = async () => {
    const { data } = await api.get<Detail>(`/api/MyExams/exam/${examId}`);
    setData(data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const start = async () => {
    try {
      const { data: res } = await api.post(`/api/MyExams/start/${examId}`);

      if (res?.autoSubmitted) {
        setSnack({ open: true, msg: res.message || "Süre doldu.", type: "warning" });
        await load();
        return;
      }

      nav(`/app/exams/take/${res.attemptId}`);
    } catch (e: any) {
      const d = e?.response?.data;

      const msg =
        d?.message ||
        (d?.code === "TRAININGS_NOT_COMPLETED"
          ? `Sınava girebilmek için tüm eğitimleri tamamlamalısınız. Kalan: ${d?.incompleteTrainingCount ?? "?"}`
          : "Başlatılamadı.");

      setSnack({ open: true, msg, type: "error" });
    }
  };

  const goTake = () => {
    if (data?.attemptId) nav(`/app/exams/take/${data.attemptId}`);
  };

  if (!data) return null;

  const statusLabel =
    data.status === "not_started" ? (
      <Chip label="Girilmedi" />
    ) : data.status === "in_progress" ? (
      <Chip color="warning" label="Devam ediyor" />
    ) : (
      <Chip color="success" label="Tamamlandı" />
    );

  // ✅ Fail olduysa yeniden başlayabilsin
  const canStart =
    data.status === "not_started" || (data.status === "completed" && data.isPassed === false);

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6" fontWeight={800}>
            {data.title}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            {statusLabel}
            <Chip label={`${data.durationMinutes} dk`} />
            <Chip label={`${data.questionCount} soru`} />
          </Stack>

          {data.status === "completed" && (
            <Typography>
              Puan: <b>{data.score?.toFixed(1) ?? "-"}</b>{" "}
              {data.isPassed ? "(Başarılı)" : "(Başarısız)"}
            </Typography>
          )}

          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1 }}>
            {canStart && (
              <Button variant="contained" startIcon={<PlayArrow />} onClick={start}>
                {data.status === "completed" ? "Tekrar Sınava Başla" : "Sınava Başla"}
              </Button>
            )}

            {data.status === "in_progress" && (
              <Button variant="contained" startIcon={<Replay />} onClick={goTake}>
                Devam Et
              </Button>
            )}

            <Button startIcon={<OpenInNew />} onClick={() => nav("/app/exams")}>
              Sınav Listesine Dön
            </Button>
          </Stack>
        </Stack>
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
    </Box>
  );
}
