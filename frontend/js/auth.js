// =====================================================================
// Studora — Auth helpers (student sessions + admin token)
// =====================================================================

const ADMIN_TOKEN_KEY = 'univault_admin_token';

// Timeouts. GETs are short (a cold-starting backend can take ~15s, so
// 25s gives it headroom). Mutations may run several sequential database
// steps plus a cold-start wake-up, so they get a much longer window.
const GET_TIMEOUT_MS = 25000;
const MUTATION_TIMEOUT_MS = 90000;
const RETRY_DELAY_MS = 2000;

function isMutationMethod(method) {
  return !['GET', 'HEAD'].includes(String(method || 'GET').toUpperCase());
}

// ---- Student auth ----

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function requireAuth(returnTo) {
  // Hide the page content immediately so unauthenticated visitors never
  // see a flash of the protected page before being redirected to login.
  document.documentElement.classList.add('auth-guard');
  try {
    const session = await getSession();
    if (!session) {
      const target = returnTo || (location.pathname + location.search);
      // Replace this history entry so the browser back button goes to the
      // real previous page instead of bouncing back into this auth loop.
      if (window.__nav) { window.__nav('./login.html?next=' + encodeURIComponent(target), { replace: true }); return null; }
      location.replace('./login.html?next=' + encodeURIComponent(target));
      return null;
    }
    return session;
  } finally {
    document.documentElement.classList.remove('auth-guard');
  }
}

function getSessionToken() {
  return supabase.auth.getSession().then(({ data }) => data.session?.access_token || null);
}

async function getProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function logoutStudent() {
  await supabase.auth.signOut();
  if (window.__nav) { window.__nav('./'); return; }
  location.href = './';
}

// ---- Backend helper (uses the current Supabase session token) ----

// Single fetch attempt with an abort timeout. On abort we throw a
// TimeoutError so callers can distinguish it from other network errors.
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      const e = new Error('Request timed out after ' + Math.round(timeoutMs / 1000) + 's');
      e.type = 'timeout';
      throw e;
    }
    const e = new Error((err && err.message) || 'Network error');
    e.type = 'network';
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Fetch with the retry policy that matches the HTTP method:
//   GET/HEAD  — idempotent, may retry once (cold-start wake-up is safe).
//   everything else — MUST NOT be retried: the server may have already
//   applied the mutation while the response was lost. Re-sending would
//   execute the action twice (duplicate services, double notifications…).
async function fetchJson(url, options) {
  const method = String(options.method || 'GET').toUpperCase();
  const mutation = isMutationMethod(method);
  const timeoutMs = mutation ? MUTATION_TIMEOUT_MS : GET_TIMEOUT_MS;
  const attempts = mutation ? 1 : 2;

  let lastErr = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt === 0 && !mutation) {
        await new Promise(function (r) { setTimeout(r, RETRY_DELAY_MS); });
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

async function apiFetch(path, options = {}) {
  const token = await getSessionToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetchJson(API_URL + path, { ...options, headers, cache: 'no-store' });
  let body = null;
  try { body = await res.json(); } catch (e) { /* non-JSON */ }
  if (!res.ok) {
    const message = (body && body.error) || 'Request failed (' + res.status + ')';
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    err.type = 'http';
    throw err;
  }
  return body;
}

// ---- Admin auth (separate JWT from the backend) ----

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function requireAdminAuth() {
  const token = getAdminToken();
  if (!token) {
    if (window.__nav) { window.__nav('./index.html', { replace: true }); return null; }
    location.replace('./index.html');
    return null;
  }
  return token;
}

async function adminLogin(password) {
  // Single attempt with a timeout: a cold-starting backend can take a
  // while, but we must not hang forever on an unreachable server.
  const res = await fetchWithTimeout(API_URL + '/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  }, MUTATION_TIMEOUT_MS);
  let body = null;
  try { body = await res.json(); } catch (e) { /* non-JSON */ }
  if (!res.ok) throw new Error((body && body.error) || 'Login failed (' + res.status + ')');
  localStorage.setItem(ADMIN_TOKEN_KEY, body.token);
  return body.token;
}

function logoutAdmin() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  if (window.__nav) { window.__nav('./index.html'); return; }
  location.href = './index.html';
}

async function adminFetch(path, options = {}) {
  const token = getAdminToken();
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetchJson(API_URL + path, { ...options, headers, cache: 'no-store' });
  let body = null;
  try { body = await res.json(); } catch (e) { /* non-JSON */ }
  if (res.status === 401) {
    logoutAdmin();
    const err = new Error('Session expired — please log in again');
    err.type = 'auth';
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const message = (body && body.error) || 'Request failed (' + res.status + ')';
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    err.type = 'http';
    throw err;
  }
  return body;
}
