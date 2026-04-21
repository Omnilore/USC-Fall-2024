/**
 * Single source of truth for which Supabase project the app talks to.
 * Browser client and API routes that verify JWTs must use the same URL/keys.
 */
export const DEFAULT_SUPABASE_URL = "https://jfzwagzjwjnbdhvxupxt.supabase.co";

export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaGxuY2VjZGNrZnh4ZGNkenZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY0NDg0MDIsImV4cCI6MjA0MjAyNDQwMn0.T2xvdaxJjyrtOX9_d2i3TqT4NnIMAvPWekwcyfQo7gI";

export function getSupabaseProjectUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return v || DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return v || DEFAULT_SUPABASE_ANON_KEY;
}
