// src/pages/Dashboard.tsx
import { Box, Typography, Button, Stack, Paper } from "@mui/material";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2} maxWidth={720}>
        <Typography variant="h4">Merhaba{user?.name ? `, ${user.name}` : ""}! 👋</Typography>
        <Typography color="text.secondary">
          Giriş başarılı. Burası korumalı bir sayfa örneği.
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1">Oturum</Typography>
          <Typography variant="body2" color="text.secondary">E-posta: {user?.email ?? "-"}</Typography>
        </Paper>
        <Button variant="outlined" color="inherit" onClick={signOut}>Çıkış Yap</Button>
      </Stack>
    </Box>
  );
}
