// js/supabase.js
// Supabase client — replace these two values with your own from:
// https://app.supabase.com → your project → Settings → API

const SUPABASE_URL = 'https://frfpvzhvxvmpvfvrcsfn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZnB2emh2eHZtcHZmdnJjc2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzgyMTksImV4cCI6MjA5NTg1NDIxOX0.bOEpcLepCcKP8yY1Q6nyB1dgV8p5Lje7fuPUyvmZZGQ';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helper: get current session user ──
async function getSessionUser() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return profile || null;
}

// ── Helper: redirect if not logged in ──
async function requireAuth(allowedRoles = []) {
  const user = await getSessionUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = 'dashboard.html';
    return null;
  }
  return user;
}
