// =====================================================================
// UniVault — Supabase client
// Reads config from js/config.js (set values there — for local testing
// run scripts/dev.sh which writes local values for you).
// The anon key is public by design; RLS protects the data. The service
// role key NEVER lives in the frontend.
// =====================================================================

const SUPABASE_URL = UNIVAULT_CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = UNIVAULT_CONFIG.SUPABASE_ANON_KEY;
const API_URL = UNIVAULT_CONFIG.API_URL;

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
