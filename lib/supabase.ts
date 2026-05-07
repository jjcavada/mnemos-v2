// Browser client (anon key, RLS-protected)
"use client";
import { createBrowserClient } from "@supabase/ssr";

export const sb = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
