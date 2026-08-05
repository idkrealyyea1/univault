#!/usr/bin/env bash
# =====================================================================
# UniVault — local dev/test runner
#
# 1. Starts (or reuses) the local Supabase stack via Docker
# 2. Writes backend/.env and frontend/js/config.js with local values
# 3. Starts the backend API on :3000
# 4. Serves the frontend on :8080  ->  open http://localhost:8080
#
# Prereqs: Docker running, supabase CLI on PATH (or ~/.local/bin/supabase),
#          node + npm installed.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

SUPABASE_BIN="${SUPABASE_BIN:-$(command -v supabase || echo "$HOME/.local/bin/supabase")}"
FRONT_PORT="${FRONT_PORT:-8080}"
API_PORT="${API_PORT:-3000}"

# ---------------------------------------------------------------
# 1. Local Supabase
# ---------------------------------------------------------------
echo "▶ Starting local Supabase (first run pulls Docker images, be patient)..."
"$SUPABASE_BIN" start > /dev/null

echo "▶ Reading local Supabase credentials..."
ENV_OUT="$("$SUPABASE_BIN" status -o env)"
SUPA_URL="$(echo "$ENV_OUT" | grep -E '^SUPABASE_URL=' | cut -d= -f2-)"
ANON_KEY="$(echo "$ENV_OUT" | grep -E '^ANON_KEY=' | cut -d= -f2-)"
SERVICE_KEY="$(echo "$ENV_OUT" | grep -E '^SERVICE_ROLE_KEY=' | cut -d= -f2-)"

if [ -z "$SUPA_URL" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "✗ Could not read credentials from 'supabase status'. Is the stack running?" >&2
  exit 1
fi
echo "   ✓ Local API at $SUPA_URL"

# ---------------------------------------------------------------
# 2. Secrets: keep existing values if already set, else generate.
#    (.env is parsed with grep, NOT source'd — bcrypt hashes contain $)
# ---------------------------------------------------------------
getenv() { grep -E "^$1=" "$BACKEND/.env" 2>/dev/null | tail -1 | cut -d= -f2-; }

JWT_SECRET="${JWT_SECRET:-$(getenv JWT_SECRET)}"
ADMIN_PASSWORD_HASH="${ADMIN_PASSWORD_HASH:-$(getenv ADMIN_PASSWORD_HASH)}"
VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-$(getenv VAPID_PUBLIC_KEY)}"
VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY:-$(getenv VAPID_PRIVATE_KEY)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(getenv ADMIN_PASSWORD)}"

if [ -z "$JWT_SECRET" ]; then JWT_SECRET="$(openssl rand -hex 24)"; fi
if [ -z "$ADMIN_PASSWORD" ]; then ADMIN_PASSWORD="admin12345"; fi
if [ -z "$ADMIN_PASSWORD_HASH" ]; then
  echo "▶ Generating bcrypt hash for admin password '$ADMIN_PASSWORD' (change it in backend/.env)"
  ADMIN_PASSWORD_HASH="$(ADMIN_PASSWORD="$ADMIN_PASSWORD" node -e "console.log(require('$BACKEND/node_modules/bcryptjs').hashSync(process.env.ADMIN_PASSWORD, 10))")"
fi
if [ -z "$VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
  echo "▶ Generating VAPID keys..."
  VAPID_JSON="$(node "$BACKEND/node_modules/web-push/src/cli.js" generate-vapid-keys --json 2>/dev/null)"
  VAPID_PUBLIC_KEY="$(echo "$VAPID_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).publicKey))")"
  VAPID_PRIVATE_KEY="$(echo "$VAPID_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).privateKey))")"
fi

# ---------------------------------------------------------------
# 3. Write backend/.env
# ---------------------------------------------------------------
cat > "$BACKEND/.env" <<EOF
SUPABASE_URL=$SUPA_URL
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
ADMIN_PASSWORD_HASH=$ADMIN_PASSWORD_HASH
ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_SECRET=$JWT_SECRET
ALLOWED_ORIGIN=http://localhost:$FRONT_PORT
VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:dev@univault.local
EOF

# ---------------------------------------------------------------
# 4. Write frontend/js/config.js
# ---------------------------------------------------------------
cat > "$FRONTEND/js/config.js" <<EOF
// Local dev config — written by scripts/dev.sh. Do not edit by hand.
// Re-run scripts/dev.sh to regenerate.

const UNIVAULT_CONFIG = {
  SUPABASE_URL: '$SUPA_URL',
  SUPABASE_ANON_KEY: '$ANON_KEY',
  API_URL: 'http://localhost:$API_PORT',
  VAPID_PUBLIC_KEY: '$VAPID_PUBLIC_KEY'
};
EOF

echo "   ✓ backend/.env written"
echo "   ✓ frontend/js/config.js written"
echo "   ℹ  admin password: $ADMIN_PASSWORD"

# ---------------------------------------------------------------
# 5. Start backend (only if not already running on API_PORT)
# ---------------------------------------------------------------
if curl -s -o /dev/null --max-time 1 "http://localhost:$API_PORT/api/auth/admin-login" -X POST 2>/dev/null; then
  echo "   ℹ  backend already running on :$API_PORT"
else
  echo "▶ Starting backend on :$API_PORT ..."
  (cd "$BACKEND" && PORT="$API_PORT" node server.js >> "$ROOT/.dev-backend.log" 2>&1 & echo $! > "$ROOT/.dev-backend.pid")
  sleep 2
  curl -s -o /dev/null --max-time 3 "http://localhost:$API_PORT/api/auth/admin-login" -X POST && \
    echo "   ✓ backend up (pid $(cat "$ROOT/.dev-backend.pid"))" || echo "   ⚠ backend may not be up yet — see .dev-backend.log"
fi

# ---------------------------------------------------------------
# 6. Serve frontend
# ---------------------------------------------------------------
echo "▶ Serving frontend on http://localhost:$FRONT_PORT ..."
echo "   Admin panel:   http://localhost:$FRONT_PORT/admin/index.html"
echo "   Stop both with: kill \$(cat .dev-backend.pid)   (frontend: Ctrl+C)"
echo "   (press Ctrl+C to stop the frontend server)"

cd "$FRONTEND"
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$FRONT_PORT"
else
  npx --yes serve -l "$FRONT_PORT" .
fi
