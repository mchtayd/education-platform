//src/pages/users/UserExams.tsx
import {
  Box,
  Paper,
  Stack,
  TextField,
  InputAdornment,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Typography,
} from "@mui/material";
import { Search, Refresh, OpenInNew } from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

type ExamRow = {
  examId: number;
  title: string;
  durationMinutes: number;
  questionCount: number;
  status: "not_started" | "in_progress" | "completed";
  attemptId?: number | null;
  score?: number | null;
  isPassed?: boolean | null;
};

// ✅ Durum: başarısız ise kırmızı + özel mesaj
const statusChip = (r: ExamRow) => {
  if (r.status === "completed") {
    if (r.isPassed === false) {
      return (
        <Chip
          size="small"
          color="error"
          label="Tüm Eğitimleri Tamamlayarak Tekrar Giriniz!"
          sx={{
            fontWeight: 800,
            height: "auto",
            "& .MuiChip-label": {
              display: "block",
              whiteSpace: "normal",
              lineHeight: 1.2,
              py: 0.5,
            },
          }}
        />
      );
    }
    return <Chip size="small" color="success" label="Tamamlandı" sx={{ fontWeight: 700 }} />;
  }

  if (r.status === "in_progress") return <Chip size="small" color="warning" label="Devam ediyor" sx={{ fontWeight: 700 }} />;
  return <Chip size="small" label="Girilmedi" sx={{ fontWeight: 700 }} />;
};

export default function UserExams() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ExamRow[]>([]);

  const load = async () => {
    const { data } = await api.get<ExamRow[]>("/MyExams/list", {
      params: { search: q || undefined },
    });
    setRows(data);
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [q]);

  const memo = useMemo(() => rows, [rows]);

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Sınav ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 360 }}
          />
          <Button startIcon={<Refresh />} onClick={load}>
            Yenile
          </Button>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sınav</TableCell>
                <TableCell>Süre</TableCell>
                <TableCell>Soru</TableCell>
                <TableCell>Durum</TableCell>
                <TableCell>Puan</TableCell>
                <TableCell align="right">İşlem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {memo.map((r) => (
                <TableRow key={r.examId} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{r.title}</Typography>
                  </TableCell>
                  <TableCell>{r.durationMinutes} dk</TableCell>
                  <TableCell>{r.questionCount}</TableCell>

                  {/* ✅ Durum kolonunda başarısızsa kırmızı uyarı */}
                  <TableCell sx={{ maxWidth: 360 }}>
                    {statusChip(r)}
                  </TableCell>

                  <TableCell>
                    {r.status === "completed"
                      ? (r.score?.toFixed(1) ?? "-") + (r.isPassed ? " (Başarılı)" : " (Başarısız)")
                      : "-"}
                  </TableCell>

                  <TableCell align="right">
                    <Button size="small" startIcon={<OpenInNew />} onClick={() => nav(`/app/exams/${r.examId}`)}>
                      Aç
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {memo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>Kayıt yok.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Box>
  );
}
