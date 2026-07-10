// ── Supabase project credentials ─────────────────────────────────────────
// Fill these in with values from your Supabase project:
// Project Settings → API → Project URL / anon public key
// These two values are safe to expose publicly (that's how Supabase's
// anon key is designed to work — access is controlled by Row Level
// Security policies, not by keeping this key secret).
const SUPABASE_URL = "https://fokseejnvpoelyahkfjj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZva3NlZWpudnBvZWx5YWhrZmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1OTE3MjcsImV4cCI6MjA5OTE2NzcyN30.Dx2xU9Zz0wIwHePAFxOsUrZpu0vG6OVk8IJB36kEt4s";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
