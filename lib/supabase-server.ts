// Server-only client. Uses service role for trusted operations (auto-capture, etc).
import { createClient } from "@supabase/supabase-js";

export function sbServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
