#!/usr/bin/env bash
# =====================================================================
# UniVault — make a signed-up user an admin (local or remote)
# Usage: scripts/make-admin.sh <username>
# Reads credentials from backend/.env (written by scripts/dev.sh).
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USERNAME="${1:-}"

if [ -z "$USERNAME" ]; then
  echo "Usage: scripts/make-admin.sh <username>" >&2
  exit 1
fi

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "✗ backend/.env not found. Run scripts/dev.sh first." >&2
  exit 1
fi

SUPABASE_URL="$(grep -E '^SUPABASE_URL=' "$ROOT/backend/.env" | tail -1 | cut -d= -f2-)"
SERVICE_KEY="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$ROOT/backend/.env" | tail -1 | cut -d= -f2-)"

SUPABASE_URL="$SUPABASE_URL" SERVICE_KEY="$SERVICE_KEY" USERNAME="$USERNAME" node -e '
const { createClient } = require(process.argv[1]);
let realtime = {};
try { realtime = { transport: require(process.argv[1].replace("@supabase/supabase-js", "ws")) }; } catch (e) {}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SERVICE_KEY, { realtime });
(async () => {
  const { data, error } = await supabase.from("profiles").update({ is_admin: true }).eq("username", process.env.USERNAME).select();
  if (error) { console.error("Error:", error.message); process.exit(1); }
  if (!data || data.length === 0) { console.error("No user with username \"" + process.env.USERNAME + "\". Sign up first, then retry."); process.exit(1); }
  console.log(data[0].username + " is now an admin.");
})();
' "$ROOT/backend/node_modules/@supabase/supabase-js"
