import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
// import { useAuth } from '../context/AuthContext';

type Props = {
  /** Görsel/lojik farklılık istersek kullanırız (şimdilik sadece tip güvenliği için) */
  variant?: 'admin' | 'user';
  /** Sağ taraftaki başlık (varsayılan: Eğitim Platformu) */
  leftTitle?: string;
};

export default function Navbar({ variant = 'user', leftTitle = 'Eğitim Platformu' }: Props) {
//   const { logout, user } = useAuth();
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     // logout();
//     // navigate('/login', { replace: true });
//   };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        {/* Sol: Başlık */}
        <Typography variant="h6" component="div">
          {leftTitle}
        </Typography>
        {/* Ortayı doldurup başlığı sağa it */}
        <Box sx={{ flexGrow: 1 }} />
        {/* Sağ: Çıkış Yap */}
        <Button color="inherit">
          Çıkış Yap
        </Button>
      </Toolbar>
    </AppBar>
  );
}
