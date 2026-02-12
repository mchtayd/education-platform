// src/pages/users/UserExamTake.tsx
import {
  Box,
  Paper,
  Stack,
  Typography,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Chip,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../lib/api";
import { fullApiUrl } from "../../lib/fullUrl";

type Choice = { id: number; text?: string | null; imageUrl?: string | null };
type Question = { id: number; order: number; text: string; choices: Choice[] };

type AttemptData = {
  attemptId: number;
  examId: number;
  title: string;
  durationMinutes: number;
  startedAt: string;
  endsAt: string;
  serverNow: string;

  submittedAt?: string | null;
  score?: number | null;
  isPassed?: boolean | null;
  autoSubmitted?: boolean;
  message?: string | null;

  questions: Question[];
  answers: Array<{ questionId: number; choiceId: number | null }>;
};

export default function UserExamTake() {
  const { attemptId } = useParams();
  const nav = useNavigate();

  const [data, setData] = useState<AttemptData | null>(null);
  const [idx, setIdx] = useState(0);

  const [remainingSec, setRemainingSec] = useState<number>(0);
  const serverOffsetMsRef = useRef<number>(0);

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    type: "success" | "error" | "info" | "warning";
  }>({ open: false, msg: "", type: "info" });

  const [answerMap, setAnswerMap] = useState<Record<number, number | null>>({}); // questionId -> choiceId

  const load = async () => {
    const { data } = await api.get<AttemptData>(`/api/MyExams/attempt/${attemptId}`);
    setData(data);

    const m: Record<number, number | null> = {};
    (data.answers || []).forEach((a) => {
      m[a.questionId] = a.choiceId;
    });
    setAnswerMap(m);

    // timer: server clock offset
    const serverNow = new Date(data.serverNow).getTime();
    serverOffsetMsRef.current = serverNow - Date.now();

    const endsAt = new Date(data.endsAt).getTime();
    const nowServer = Date.now() + serverOffsetMsRef.current;
    setRemainingSec(Math.max(0, Math.floor((endsAt - nowServer) / 1000)));

    // auto submit mesajı geldiyse
    if (data.autoSubmitted && data.message) {
      setSnack({ open: true, msg: data.message, type: "warning" });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // countdown
  useEffect(() => {
    if (!data) return;
    if (data.submittedAt) return;

    const t = setInterval(() => {
      setRemainingSec((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [data?.attemptId, data?.submittedAt]);

  // süre 0 olunca otomatik submit
  useEffect(() => {
    if (!data) return;
    if (data.submittedAt) return;
    if (remainingSec !== 0) return;

    (async () => {
      try {
        const { data: res } = await api.post(`/api/MyExams/attempt/${data.attemptId}/submit`);
        setSnack({
          open: true,
          msg: res.message || "Sınav süresi tamamlandı. Cevaplarınız kaydedildi.",
          type: "warning",
        });
        await load();
      } catch {
        await load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, data?.attemptId]);

  const questions = data?.questions ?? [];
  const current = questions[idx];

  const answeredCount = useMemo(() => {
    const ids = questions.map((q) => q.id);
    return ids.filter((id) => answerMap[id] != null).length;
  }, [questions, answerMap]);

  const selectChoice = async (questionId: number, choiceId: number) => {
    // optimistic
    setAnswerMap((prev) => ({ ...prev, [questionId]: choiceId }));

    try {
      await api.post(`/api/MyExams/attempt/${data!.attemptId}/answer`, { questionId, choiceId });
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.response?.data?.message || "Cevap kaydedilemedi.",
        type: "error",
      });
      await load();
    }
  };

  const submit = async () => {
    try {
      const { data: res } = await api.post(`/api/MyExams/attempt/${data!.attemptId}/submit`);
      if (res?.message) setSnack({ open: true, msg: res.message, type: "info" });
      await load();
      setConfirmEnd(false);
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || "Bitirilemedi.", type: "error" });
    }
  };

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!data) return null;

  // Bitmişse sonuç ekranı
  if (data.submittedAt) {
    return (
      <Box sx={{ p: 2 }}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6" fontWeight={800}>
              {data.title}
            </Typography>
            <Typography>Bitti: {dayjs(data.submittedAt).format("DD.MM.YYYY HH:mm")}</Typography>
            <Typography variant="h5">
              Puan: <b>{data.score?.toFixed(1) ?? "-"}</b>{" "}
              {data.isPassed ? (
                <Chip color="success" label="Başarılı" />
              ) : (
                <Chip color="error" label="Başarısız" />
              )}
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <Button variant="contained" onClick={() => nav(`/app/exams/${data.examId}`)}>
                Detaya Dön
              </Button>
              <Button onClick={() => nav("/app/exams")}>Sınav Listesi</Button>
            </Stack>
          </Stack>
        </Paper>

        <Snackbar
          open={snack.open}
          autoHideDuration={3500}
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

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={1}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
            spacing={1}
          >
            <Typography variant="h6" fontWeight={800}>
              {data.title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={`Süre: ${fmtTime(remainingSec)}`} color={remainingSec <= 30 ? "warning" : "default"} />
              <Chip label={`Cevaplanan: ${answeredCount}/${questions.length}`} />
            </Stack>
          </Stack>

          <Divider sx={{ my: 1 }} />

          {/* Soru numaraları - geri dönme */}
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {questions.map((q, i) => {
              const answered = answerMap[q.id] != null;
              const active = i === idx;
              return (
                <Button
                  key={q.id}
                  size="small"
                  variant={active ? "contained" : "outlined"}
                  color={answered ? "success" : "inherit"}
                  onClick={() => setIdx(i)}
                  sx={{ minWidth: 44 }}
                >
                  {i + 1}
                </Button>
              );
            })}
          </Stack>

          <Divider sx={{ my: 1 }} />

          {/* Aktif soru */}
          {current && (
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>
                {idx + 1}. {current.text}
              </Typography>

              <RadioGroup
                value={answerMap[current.id] ?? ""}
                onChange={(_, v) => selectChoice(current.id, Number(v))}
              >
                {current.choices.map((c, i) => {
                  const img = c.imageUrl ? fullApiUrl(c.imageUrl) : "";
                  return (
                    <FormControlLabel
                      key={c.id}
                      value={c.id}
                      control={<Radio />}
                      label={
                        <Stack spacing={0.75}>
                          <Typography>
                            {["A", "B", "C", "D"][i]} - {c.text || "(metin yok)"}
                          </Typography>

                          {/* ✅ Görsel varsa küçük önizleme + aç butonu */}
                          {c.imageUrl && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box
                                component="img"
                                src={img}
                                alt="şık görseli"
                                sx={{
                                  width: 140,
                                  height: 90,
                                  objectFit: "contain",
                                  borderRadius: 1,
                                  border: 1,
                                  borderColor: "divider",
                                  bgcolor: "background.paper",
                                }}
                                onError={() => {
                                  setSnack({
                                    open: true,
                                    msg: "Görsel yüklenemedi. Dosya yolu/servis kontrol edin.",
                                    type: "warning",
                                  });
                                }}
                              />
                              <Button
                                size="small"
                                component="a"
                                href={img}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Görseli Aç
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                      }
                    />
                  );
                })}
              </RadioGroup>
            </Stack>
          )}

          <Divider sx={{ my: 1 }} />

          {/* Alt butonlar */}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
            <Stack direction="row" spacing={1}>
              <Button disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
                Önceki Soru
              </Button>

              {idx < questions.length - 1 ? (
                <Button variant="contained" onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}>
                  Sonraki Soru
                </Button>
              ) : (
                <Button color="error" variant="contained" onClick={() => setConfirmEnd(true)}>
                  Sınavı Bitir
                </Button>
              )}
            </Stack>

            <Button onClick={() => nav(`/app/exams/${data.examId}`)}>Detaya Dön</Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Bitir onayı */}
      <Dialog open={confirmEnd} onClose={() => setConfirmEnd(false)}>
        <DialogTitle>Sınavı Bitir</DialogTitle>
        <DialogContent>Sınavı bitirmek istediğinize emin misiniz?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEnd(false)}>Vazgeç</Button>
          <Button color="error" variant="contained" onClick={submit}>
            Bitir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
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
