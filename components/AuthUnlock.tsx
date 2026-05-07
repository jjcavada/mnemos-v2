"use client";
import { useCallback, useEffect, useState } from "react";

export type MnemosAuth = {
  authenticated: boolean;
  checking: boolean;
  error: string;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useMnemosAuth(): MnemosAuth {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/auth/status", { credentials: "same-origin" });
      const json = await res.json() as { authenticated?: boolean; password_configured?: boolean };
      setAuthenticated(Boolean(json.authenticated));
      if (!json.password_configured) setError("MNEMOS_APP_PASSWORD is not configured in Vercel.");
    } catch {
      setAuthenticated(false);
      setError("Could not check Mnemos login.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function login(password: string) {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password })
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setAuthenticated(false);
        setError(json.error ?? "Login failed");
        return false;
      }
      setAuthenticated(true);
      return true;
    } catch {
      setAuthenticated(false);
      setError("Login failed");
      return false;
    } finally {
      setChecking(false);
    }
  }

  async function logout() {
    setChecking(true);
    setError("");
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      setAuthenticated(false);
      setChecking(false);
    }
  }

  return { authenticated, checking, error, login, logout, refresh };
}
