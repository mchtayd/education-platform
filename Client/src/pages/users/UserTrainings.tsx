//src/pages/users/UserTrainings.tsx
import {
  Box, Stack, TextField, InputAdornment, Button, Grid, Card, CardMedia,
  CardContent, CardActions, Typography, Chip, Rating, Snackbar, Alert
} from "@mui/material";
import { Search, OpenInNew } from "@mui/icons-material";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../lib/api";

type Row = {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string;
  contentType: "PDF" | "Video" | "PPT" | "PowerPoint";
  date: string;
  fileUrl: string;
  thumbUrl: string | null;
  progress: number;
  watched: boolean;
  lastViewedAt?: string | null;
  rating?: number | null;
  comment?: string | null;
};

const previewByType = (t?: string) => {
  const x = (t ?? "").trim().toLowerCase();

  if (x === "pdf") return "/previews/pdf.svg";
  if (x === "video") return "/previews/video.svg";
  if (x === "ppt" || x === "pptx" || x.includes("power")) return "/previews/ppt.svg";

  return "/previews/pdf.svg";
};


export default function UserTrainings() {
  const params = useParams(); // /app veya /app/c/:categoryId
  const categoryId = params.categoryId ? parseInt(params.categoryId) : undefined;

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [snack, setSnack] = useState<{open:boolean; msg:string; type:"success"|"error"|"info"|"warning"}>({open:false, msg:"", type:"success"});

  const load = async () => {
    try {
      if (!categoryId) {
        // Tüm kategoriler için kısayol: kategori listesindeki ilkini yükleyebilirsiniz.
        const { data: cats } = await api.get<{id:number}[]>("/api/My/categories");
        const cid = cats[0]?.id;
        if (!cid) { setRows([]); return; }
        const { data } = await api.get<Row[]>("/api/My/trainings", { params: { categoryId: cid, search: q || undefined }});
        setRows(data);
      } else {
        const { data } = await api.get<Row[]>("/api/My/trainings", { params: { categoryId, search: q || undefined }});
        setRows(data);
      }
    } catch (e:any) {
      setRows([]);
      setSnack({open:true, msg: e?.response?.data || "Kayıt alınamadı.", type:"error"});
    }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [categoryId, q]);

  const rowsMemo = useMemo(()=>rows, [rows]);

  const openAndMark = async (r: Row) => {
    // Dosyayı yeni sekmede aç
    const base = (api.defaults.baseURL || "").replace(/\/$/, "");
    window.open(`${base}${r.fileUrl}`, "_blank", "noopener,noreferrer");
    // İzlenmiş olarak işaretle (progress=100)
    try {
      await api.post(`/api/My/progress/view/${r.id}`, { progress: 100 });
      await load();
    } catch {}
  };

  const saveFeedback = async (r: Row, rating: number, comment: string) => {
    try {
      await api.post(`/api/My/progress/feedback/${r.id}`, { rating, comment });
      setSnack({open:true, msg:"Geri bildiriminiz kaydedildi.", type:"success"});
      await load();
    } catch (e:any) {
      setSnack({open:true, msg: e?.response?.data || "Kaydedilemedi.", type:"error"});
    }
  };

  return (
    <Box>
      <Stack direction={{ xs:"column", md:"row" }} spacing={1.5} alignItems="center" sx={{ mb:2 }}>
        <TextField
          size="small" placeholder="Eğitim ara"
          value={q} onChange={e=>setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search/></InputAdornment> }}
          sx={{ maxWidth: 360 }}
        />
        <Button onClick={load}>Yenile</Button>
      </Stack>

      <Grid container spacing={2}>
        {rowsMemo.map(r=>(
          <Grid size={{xs:12, sm:6, md:4, lg:3}} key={r.id} >
            <Card variant="outlined" sx={{ height:"100%", display:"flex", flexDirection:"column" }}>
              <Box sx={{ position:"relative" }}>
                <CardMedia
                component="img"
                image={previewByType(r.contentType)}
                sx={{ height: 160, objectFit: "cover" }}
                />
                <Box sx={{
                  position:"absolute", bottom:0, left:0, right:0,
                  bgcolor:"rgba(0,0,0,.55)", color:"#fff", px:1, py:.5
                }}>
                  <Typography variant="subtitle1" fontWeight={700} title={r.title} noWrap>
                    {r.title}
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow:1 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={dayjs(r.date).format("DD.MM.YYYY")} />
                    <Chip size="small" label={r.contentType} />
                    {r.watched
                      ? <Chip size="small" color="success" label="İzlendi" />
                      : <Chip size="small" color="warning" label="İzlenmedi" />}
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    Son İzleme: {r.lastViewedAt ? dayjs(r.lastViewedAt).format("DD.MM.YYYY HH:mm") : "-"}
                  </Typography>

                  {/* Puan & Yorum */}
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">Puanım:</Typography>
                      <Rating
                        value={r.rating || 0}
                        onChange={(_,val)=>{ if (val) saveFeedback(r, val, r.comment || ""); }}
                      />
                    </Stack>
                    <TextField
                      size="small"
                      placeholder="Yorum yazın (isteğe bağlı)"
                      defaultValue={r.comment || ""}
                      onBlur={(e)=> saveFeedback(r, r.rating || 0, e.target.value)}
                      multiline maxRows={3}
                    />
                  </Stack>
                </Stack>
              </CardContent>

              <CardActions sx={{ justifyContent:"space-between" }}>
                <Button size="small" startIcon={<OpenInNew/>} onClick={()=>openAndMark(r)}>
                  İçeriği Aç
                </Button>
                <Typography variant="body2" color="text.secondary">{Math.round(r.progress)}%</Typography>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {rowsMemo.length===0 && (
          <Grid size={{xs:12}} ><Typography>Kayıt yok.</Typography></Grid>
        )}
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={()=>setSnack(s=>({...s,open:false}))}
        anchorOrigin={{ vertical:"top", horizontal:"center" }}>
        <Alert severity={snack.type} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
