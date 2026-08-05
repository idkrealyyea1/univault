// =====================================================================
// UniVault — frontend config (single place to edit)
// For PRODUCTION, set the real values here.
// scripts/dev.sh overwrites this file with local values for local testing.
// =====================================================================

const UNIVAULT_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'xxxx',
  API_URL: 'https://univault-api.onrender.com',
  VAPID_PUBLIC_KEY: 'xxxxx' // same value as the Render env var; safe to expose
};
