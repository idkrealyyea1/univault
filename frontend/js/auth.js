// =====================================================================
// Studora — Auth helpers (student sessions + admin token)
// =====================================================================

const ADMIN_TOKEN_KEY = 'univault_admin_token';

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
      location.href = './login.html?next=' + encodeURIComponent(target);
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
  location.href = './';
}

// ---- Backend helper (uses the current Supabase session token) ----

const FETCH_TIMEOUT_MS = 25000;

async function fetchWithRetry(url, options) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt === 0) {
        // A cold-starting backend (Render free tier) can take ~30s+ to wake.
        // Give it one more chance before surfacing the error.
        await new Promise(function (r) { setTimeout(r, 2000); });
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function apiFetch(path, options = {}) {
  const token = await getSessionToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetchWithRetry(API_URL + path, { ...options, headers, cache: 'no-store' });
  let body = null;
  try { body = await res.json(); } catch (e) { /* non-JSON */ }
  if (!res.ok) {
    const message = (body && body.error) || 'Something went wrong';
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
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
    location.href = './index.html';
    return null;
  }
  return token;
}

async function adminLogin(password) {
  const res = await fetch(API_URL + '/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Wrong password');
  localStorage.setItem(ADMIN_TOKEN_KEY, body.token);
  return body.token;
}

function logoutAdmin() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  location.href = './index.html';
}

async function adminFetch(path, options = {}) {
  const token = getAdminToken();
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetchWithRetry(API_URL + path, { ...options, headers, cache: 'no-store' });
  let body = null;
  try { body = await res.json(); } catch (e) { /* non-JSON */ }
  if (res.status === 401) {
    logoutAdmin();
    throw new Error('Session expired — please log in again');
  }
  if (!res.ok) {
    const message = (body && body.error) || 'Something went wrong';
    throw new Error(message);
  }
  return body;
}
