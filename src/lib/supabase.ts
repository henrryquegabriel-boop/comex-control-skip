import { createClient } from "@supabase/supabase-js";

const env = import.meta.env ?? {};
const url = env.VITE_SUPABASE_URL?.trim();
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

export const hasSupabaseConfig = Boolean(url && anonKey && !url.includes("SEU-PROJETO"));

export const hasGoogleOAuthConfig = Boolean(
  hasSupabaseConfig && env.VITE_GOOGLE_OAUTH_ENABLED === "true",
);

export const supabase = hasSupabaseConfig
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
