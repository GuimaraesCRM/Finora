import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api";
import { clearStoredToken, getStoredToken, setStoredToken } from "./storage";
import type { User } from "../types/api";

type SessionPayload = { token: string; user: User };

interface SessionValue {
  loading: boolean;
  token: string;
  user: User | null;
  setupRequired: boolean;
  refreshTick: number;
  signIn: (email: string, password: string) => Promise<void>;
  register: (body: { name: string; email: string; password: string; seedDemo: boolean }) => Promise<void>;
  setup: (body: { name: string; email: string; password: string; seedDemo: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  bumpRefresh: () => void;
  updateUser: (user: User) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const status = await apiRequest<{ setupRequired: boolean }>("/auth/status");
      setSetupRequired(status.setupRequired);

      const stored = await getStoredToken();
      if (stored && !status.setupRequired) {
        const me = await apiRequest<{ user: User }>("/auth/me", { token: stored });
        setToken(stored);
        setUser(me.user);
      }
    } catch {
      await clearStoredToken();
      setToken("");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function completeAuth(payload: SessionPayload) {
    setToken(payload.token);
    setUser(payload.user);
    setSetupRequired(false);
    await setStoredToken(payload.token);
  }

  async function signIn(email: string, password: string) {
    const payload = await apiRequest<SessionPayload>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await completeAuth(payload);
  }

  async function register(body: { name: string; email: string; password: string; seedDemo: boolean }) {
    const payload = await apiRequest<SessionPayload>("/auth/register", {
      method: "POST",
      body,
    });
    await completeAuth(payload);
  }

  async function setup(body: { name: string; email: string; password: string; seedDemo: boolean }) {
    const payload = await apiRequest<SessionPayload>("/auth/setup", {
      method: "POST",
      body,
    });
    await completeAuth(payload);
  }

  async function logout() {
    await clearStoredToken();
    setToken("");
    setUser(null);
    setRefreshTick(0);
  }

  async function refreshUser() {
    if (!token) return;
    const payload = await apiRequest<{ user: User }>("/auth/me", { token });
    setUser(payload.user);
  }

  function bumpRefresh() {
    setRefreshTick((value) => value + 1);
  }

  const value = useMemo<SessionValue>(() => ({
    loading,
    token,
    user,
    setupRequired,
    refreshTick,
    signIn,
    register,
    setup,
    logout,
    refreshUser,
    bumpRefresh,
    updateUser: setUser,
  }), [loading, token, user, setupRequired, refreshTick]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
