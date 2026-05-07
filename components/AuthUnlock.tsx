"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Lock, Unlock } from "lucide-react";

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

export function AuthUnlock({ auth, lockedLabel = "Protected actions locked" }: {
  auth: MnemosAuth;
  lockedLabel?: string;
}) {
  const [password, setPassword] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await auth.login(password);
    if (ok) setPassword("");
  }

  if (auth.authenticated) {
    return (
      <section className="bg-bg-1 border border-border rounded-lg px-4 py-3 mb-3">
        <div className="flex items-center gap-3">
          <Unlock className="w-4 h-4 text-green-300" />
          <div className="flex-1 text-xs text-text-2">Protected Mnemos actions unlocked for this browser.</div>
          <button
            onClick={() => void auth.logout()}
            className="inline-flex items-center gap-2 px-2.5 py-1 bg-bg-2 border border-border rounded text-[11px] text-text-3 hover:text-text-1"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-bg-1 border border-border rounded-lg px-4 py-3 mb-3">
      <form onSubmit={submit} className="flex items-center gap-3">
        <KeyRound className="w-4 h-4 text-text-3" />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Mnemos password"
          className="flex-1 bg-transparent outline-none text-xs placeholder-text-3"
        />
        <div className="text-[11px] text-text-4">{auth.checking ? "checking" : lockedLabel}</div>
        <button
          disabled={auth.checking || !password}
          className="inline-flex items-center gap-2 px-2.5 py-1 bg-accent text-black rounded text-[11px] font-semibold disabled:opacity-50"
        >
          {auth.checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
          Unlock
        </button>
      </form>
      {auth.error && <div className="mt-2 text-red-300 text-xs">{auth.error}</div>}
    </section>
  );
}
