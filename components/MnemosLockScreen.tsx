"use client";
import { FormEvent, useState } from "react";
import { BrainCircuit, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import type { MnemosAuth } from "@/components/AuthUnlock";

export function MnemosLockScreen({ auth }: { auth: MnemosAuth }) {
  const [password, setPassword] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await auth.login(password);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_35%,rgba(125,211,252,0.12),transparent_34%),#020407] text-text-1 overflow-hidden relative">
      <div className="absolute inset-0 mnemos-grid opacity-70" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
      <div className="absolute inset-0 pointer-events-none scanline" />

      <section className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-[460px] hud-panel p-6">
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md border border-cyan-300/40 bg-cyan-300/10 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-cyan-200" />
              </div>
              <div>
                <div className="font-mono text-[11px] tracking-[0.35em] text-cyan-200">MNEMOS</div>
                <div className="text-xs text-text-3 mt-1">second-brain command surface</div>
              </div>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <div className="h-section mb-2">Access Key</div>
              <div className="flex items-center gap-3 bg-black/35 border border-cyan-300/20 rounded-md px-3 h-12">
                <LockKeyhole className="w-4 h-4 text-cyan-200" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoFocus
                  placeholder="Mnemos password"
                  className="flex-1 bg-transparent outline-none text-sm placeholder-text-4"
                />
              </div>
            </label>

            <button
              disabled={auth.checking || !password}
              className="w-full h-11 bg-cyan-200 text-black rounded-md text-sm font-semibold tracking-wide disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {auth.checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
              Unlock Mnemos
            </button>
          </form>

          {auth.error && <div className="mt-4 text-sm text-red-300">{auth.error}</div>}

          <div className="mt-7 grid grid-cols-3 gap-2 text-center">
            <Metric label="Storage" value="Supabase" />
            <Metric label="Recall" value="Hybrid" />
            <Metric label="Capture" value="OpenAI" />
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] rounded-md px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-text-4">{label}</div>
      <div className="font-mono text-[11px] text-cyan-100 mt-1">{value}</div>
    </div>
  );
}
