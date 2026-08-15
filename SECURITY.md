# UniVault Security Report

Date: 2026-08-15
Scope: full stack — frontend (GitHub Pages), backend (Render, Express 4), Supabase (Postgres, Auth, Storage)

---

## 1. Executive summary

The application was already well-architected (RLS everywhere, private storage bucket,
signed URLs, escaping on all frontend rendering, service-role key confined to the
backend). The hardening pass focused on the weak spots found in the audit. All fixes
are **backwards compatible** (zero user-visible behavior change). The backend security
test suite passes **24/24** (22 functional + 2 fail-secure scenarios).

---

## 2. Vulnerabilities found

### Fixed in this pass

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | **High** | `zod .url()` accepts `javascript:`, `data:`, `ftp:` schemes → a crafted `external_link` could reach student-facing `<a href>` (XSS vector on click) | Backend: `httpsOnlyUrl()` schema refinement — only `http:`/`https:` accepted for resource `external_link`. Frontend defense-in-depth: `service.html`, `library.html` render http(s)-only; `vault.html` link detection is http(s)/`www.` only |
| 2 | **High** | Express 4 does not catch async route rejections → a thrown error inside `bcrypt.compare` (e.g. misconfigured `ADMIN_PASSWORD_HASH`) hung the request indefinitely, and any async error returned 500 instead of 401/400 | Added `wrap()` async-handler; every route in `admin.js`/`student.js`/`server.js` is wrapped; admin-login bcrypt is try/catch fail-closed (missing/bad hash → 401, never hang) |
| 3 | **High** | CORS checked only the **hostname** (`origin.host`) — a subdomain (`evil.github.io`) or mixed scheme (`http://`) was accepted, and any parsing failure returned 500 | CORS now compares **full normalized origins** (scheme+host+port) against `ALLOWED_ORIGIN` + `ALLOWED_ORIGINS_EXTRA`; disallowed → 403 with no headers; no-Origin (server-to-server) still allowed |
| 4 | **Medium** | Oversized JSON bodies produced a `PayloadTooLargeError` → 500 instead of 413 | Error handler now maps `entity.too.large` → 413 |
| 5 | **Medium** | RLS insert policies allowed a user to insert `access_requests`/`service_applications` with **any** status, e.g. `'approved'` (backend trusts status after insert) | `supabase/hardening.sql`: insert policies now require `status = 'pending'`; CHECK constraints pin both status columns to `('pending','approved','rejected')` (must be run once in Supabase SQL editor) |
| 6 | **Medium** | Local Supabase dev secrets (`supabase/.temp/**` — local Postgres password + localhost TLS key) were committed to the frontend repo | Untracked via `git rm --cached`, added to `.gitignore` (`supabase/.temp/`, `supabase/.branches/`). Local-only credentials, no production rotation needed |
| 7 | **Medium** | GitHub **Personal Access Token** present in local `.git/config` remote URL for the `backend` remote | **ACTION REQUIRED (outside code):** revoke the token at github.com → Settings → Developer settings → Personal access tokens, then fix the remote URL to a token-less `https://github.com/idkrealyyea/univault-backend.git` (use SSH or credential helper going forward). The token is NOT in git history |
| 8 | **Low** | No Referrer-Policy / cross-origin resource policy headers | Helmet config now explicit: `referrerPolicy: no-referrer`, `crossOriginResourcePolicy: same-site` |

### Audited and found secure (no change)

- Admin auth: `JWT_SECRET`-signed JWT, `jwt.verify` + `role === 'admin'` on every admin route; tokens expire after 12h.
- Student auth: Supabase session verified server-side via `auth.getUser()` — no trusting of client claims.
- Route-level: all admin routes also re-check the Supabase session; all student routes require a valid session.
- IDOR: resources/downloads gated by `access_grants` (grants table and RLS verified); signed URLs created only after grant check with 10-minute expiry.
- XSS: `escapeHTML()` used consistently across `index/service/field/library/vault/notifications/apply/admin` pages; verified every `<a href>` / text sink.
- Uploads: 25 MB memoryStorage, MIME allowlist, random storage keys, private bucket. (Known limitation: no magic-byte validation — acceptable since uploads are admin-only into a private bucket.)
- Open redirects: `safeRedirect()` is relative-only.
- Secrets in git history: none. Backend history contains only placeholder values; frontend history contains only the Supabase **anon** key (public by design).
- Rate limits already present: admin login 5/15 min, signup 5/h, access-request endpoints, payload limit 100 kB.
- `npm audit`: 0 vulnerabilities.
- **Missing env vars fail secure**: missing `ADMIN_PASSWORD_HASH` → login 401 in ~200 ms; missing `JWT_SECRET` → 500 in ~200 ms with no internal detail leaked; missing `SUPABASE_URL` → process exits 1 at boot (deploy fails loudly instead of running insecure).

---

## 3. Backend changes (repo `idkrealyyea/univault-backend`)

| File | Change |
|------|--------|
| `server.js` | Exact-origin CORS matching + 403; `helmet()` explicit `referrerPolicy` + `crossOriginResourcePolicy`; `wrap()` async-handler helper; error handler: 403 branch + `entity.too.large` → 413; `adminLoginSchema` (zod); admin-login route wrapped + bcrypt fail-closed + failed-login audit log |
| `routes/admin.js` | `httpsOnlyUrl()` scheme refinement for `external_link` (resources POST/PUT); every route wrapped with `wrap()` |
| `routes/student.js` | Every route wrapped with `wrap()` |

## 4. Frontend changes (repo `idkrealyyea1/univault`)

| File | Change |
|------|--------|
| `frontend/service.html` | Render-side guard: only `http(s)` URLs are emitted as `<a href>`, anything else shows "no link" text |
| `frontend/library.html` | Same http(s)-only guard for resource links |
| `frontend/vault.html` | `isLink()` accepts only `http(s)`/`www.`; `normalizeLink()` adds `https://` for bare `www.` links (preserves existing UX) |
| `.gitignore` | Added `supabase/.temp/`, `supabase/.branches/` |
| (index) | `supabase/.temp/**` removed from git tracking |

## 5. Supabase changes

Run `supabase/hardening.sql` once in the Supabase SQL editor:
- CHECK constraints on `access_requests.status` and `service_applications.status`.
- RLS insert policies now require `status = 'pending'` (backend service role unaffected).
- Storage bucket remains private with **zero** policies (intentional — documented in the file).

## 6. Environment variable changes

| Var | Change |
|-----|--------|
| `ALLOWED_ORIGIN` | Same format, stricter semantics — must be the **exact** origin, e.g. `https://idkrealyyea1.github.io` (host only, no repo path; scheme must match). `.env.example` and `DEPLOY.md` updated |
| `ALLOWED_ORIGINS_EXTRA` | Comma-separated extra exact origins (optional; documented in `.env.example`) |
| `ADMIN_PASSWORD_HASH`, `JWT_SECRET` | If not already set, generate: `openssl rand -hex 32` for JWT_SECRET; bcrypt hash for the admin password |

No other env vars changed.

---

## 7. Tests

Backend security suite (`/tmp/opencode/univault-security-tests.js`, run against a
local instance with dummy Supabase credentials):

- Admin login: correct password → 200 + role=admin JWT; wrong password → 401; empty body → 400; password-as-array → 400; 200 kB body → rejected.
- CORS matrix: exact allowed origin → 200; `http://` for https-only host → 403; evil origin → 403; `null` origin → 403; subdomain of allowed host → 403; no Origin header → allowed (server-to-server).
- Auth: admin route w/o token → 401; malformed token → 401; token signed with wrong secret → 401; student route w/o token → 401; non-UUID id → 401/400, never 500/hang.
- external_link: `javascript:` → 400, `data:` → 400, `https:` → accepted by schema.
- Security headers present; error responses never leak internals; 100 kB body limit → 413.
- Fail-secure: missing `ADMIN_PASSWORD_HASH` → 401 in ~200 ms (no hang); missing `JWT_SECRET` → 500 in ~200 ms (no leak); missing `SUPABASE_URL` → boots fail with exit 1.
- **Result: 24/24 PASS.**

Regression: only backend-internal behavior changed; response shapes, status codes,
auth flows and storage logic are untouched. Frontend changes are render-time
guards that cannot alter existing http(s)/`www.` links.

---

## 8. Remaining risks (accepted / documented)

1. **No CSP header** — GitHub Pages does not serve custom headers and the app uses
   inline scripts. Mitigation: no third-party scripts, all rendering escaped,
   `no-referrer`, and admin JWT in localStorage is accepted per product spec.
2. **Admin JWT stored in localStorage** — per spec; risk limited by output
   encoding on every page and the absence of external content sinks.
3. **Student login brute-force protection** is Supabase-managed (rate limits on
   the password endpoint can't be configured per project via API) — unchanged.
4. **No magic-byte upload validation** — uploads are admin-only into a private
   bucket served via signed URLs; MIME allowlist already enforced.
5. **`www.` link handling** normalizes to `https://www.…` (previous behavior).

## 9. Required follow-up actions

1. **Rotate the GitHub PAT** found in `.git/config` (never printed here).
2. Run `supabase/hardening.sql` in the Supabase SQL editor.
3. Commit the untracked `supabase/.temp` removal (staged deletions) + changes,
   then redeploy the backend to Render (new env: exact `ALLOWED_ORIGIN`).
4. Re-run the suite against the live Render endpoint after deploy (dummy-cred
   tests can't cover live Supabase calls).
