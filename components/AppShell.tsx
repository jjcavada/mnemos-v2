"use client";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MnemosLockScreen } from "@/components/MnemosLockScreen";
import { useMnemosAuth } from "@/components/AuthUnlock";

export function AppShell({
  children,
  initialAuthenticated = false
}: {
  children: React.ReactNode;
  initialAuthenticated?: boolean;
}) {
  const auth = useMnemosAuth(initialAuthenticated);

  if (auth.checking && !auth.authenticated) {
    return (
      <div className="min-h-screen bg-bg-0 text-text-3 flex items-center justify-center">
        <div className="font-mono text-xs tracking-[0.3em]">MNEMOS / AUTH CHECK</div>
      </div>
    );
  }

  if (!auth.authenticated) {
    return <MnemosLockScreen auth={auth} />;
  }

  return (
    <>
      <Header />
      <Sidebar />
      <main className="absolute top-[56px] left-[260px] right-0 bottom-0 overflow-hidden">
        {children}
      </main>
    </>
  );
}
