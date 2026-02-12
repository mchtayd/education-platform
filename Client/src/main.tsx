// main.tsx veya index.tsx  (DÜZELTİLMİŞ)
import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

const theme = createTheme({
  palette: { mode: "light", primary: { main: "#0ea5e9" }, secondary: { main: "#8b5cf6" } },
  shape: { borderRadius: 12 }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <App />  {/* App.tsx içinde <RouterProvider router={router} /> kalacak */}
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
