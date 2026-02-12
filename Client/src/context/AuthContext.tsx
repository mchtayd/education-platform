// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../lib/api";

type Role = "admin" | "staff" | "user" | "educator" | "trainer";

export type User = {
  id: number;
  name: string;
  surname?: string;
  email: string;
  role: Role;
  phone?: string;
  institution?: string;
  projectId?: number | null;
  mustChangePassword?: boolean;
};

type LoginResponse = {
  token: string;
  user: User;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<User>;
  signOut: () => void;

  updateUser: (patch: Partial<User> | ((prev: User) => User)) => void;
};

const TOKEN_KEY = "token";
const USER_KEY = "auth_user";

const AuthContext = createContext<AuthContextType | null>(null);

function setAuthHeader(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

function readFromStorage() {
  const lToken = localStorage.getItem(TOKEN_KEY);
  const lUser = localStorage.getItem(USER_KEY);

  if (lToken && lUser) {
    try {
      return { token: lToken, user: JSON.parse(lUser) as User, where: "local" as const };
    } catch {}
  }

  const sToken = sessionStorage.getItem(TOKEN_KEY);
  const sUser = sessionStorage.getItem(USER_KEY);

  if (sToken && sUser) {
    try {
      return { token: sToken, user: JSON.parse(sUser) as User, where: "session" as const };
    } catch {}
  }

  return { token: null as string | null, user: null as User | null, where: null as null };
}

function writeToStorage(token: string, user: User, remember?: boolean) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

// ✅ mevcut token hangi storage’taysa aynı yere user’ı güncelle
function updateStoredUser(user: User) {
  const hasLocal = !!localStorage.getItem(TOKEN_KEY);
  const hasSession = !!sessionStorage.getItem(TOKEN_KEY);

  if (hasLocal) localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (hasSession) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ user }, setAuthState] = useState<{ user: User | null }>({ user: null });

  useEffect(() => {
    const { token, user } = readFromStorage();
    if (token && user) {
      setAuthHeader(token);
      setAuthState({ user });
    } else {
      setAuthHeader(null);
      setAuthState({ user: null });
    }
  }, []);

  const signIn: AuthContextType["signIn"] = async (email, password, remember) => {
    const { data } = await api.post<LoginResponse>("/Auth/login", { email, password });
    if (!data?.token || !data?.user) throw new Error("Sunucu beklenen formatta yanıt vermedi.");

    setAuthHeader(data.token);
    writeToStorage(data.token, data.user, remember);
    setAuthState({ user: data.user });

    return data.user;
  };

  const signOut = () => {
    clearStorage();
    setAuthHeader(null);
    setAuthState({ user: null });
  };

  // ✅ yeni: client-side user güncelleme (mustChangePassword dahil)
  const updateUser: AuthContextType["updateUser"] = (patch) => {
    setAuthState((prev) => {
      if (!prev.user) return prev;

      const next =
        typeof patch === "function"
          ? patch(prev.user)
          : ({ ...prev.user, ...patch } as User);

      updateStoredUser(next);
      return { user: next };
    });
  };

  const value = useMemo<AuthContextType>(
    () => ({ user, isAuthenticated: !!user, signIn, signOut, updateUser }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
