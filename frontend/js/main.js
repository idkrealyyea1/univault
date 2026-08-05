// =====================================================================
// UniVault — Shared UI helpers
// =====================================================================

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatPrice(price) {
  const n = Number(price);
  if (isNaN(n)) return 'Free';
  if (n === 0) return 'Free';
  return n.toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2 }) + ' ILS';
}

function toast(message, type) {
  const id = 'univault-toast';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;padding:14px 22px;border-radius:10px;font:600 14px Inter,sans-serif;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:opacity .3s;max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#3b82f6';
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 4000);
}

function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'flex';
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

function bindModalClose() {
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.style.display = 'none';
    });
    const close = m.querySelector('.modal-close');
    if (close) close.addEventListener('click', () => { m.style.display = 'none'; });
  });
}

// Scroll-reveal: add .reveal, observe with IntersectionObserver
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach((el) => io.observe(el));
}

// Header render — reused across pages
async function renderHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const session = await supabase.auth.getSession().then(({ data }) => data.session);
  const profile = session ? await getProfile() : null;
  header.innerHTML =
    '<div class="header-inner">' +
    '  <a class="brand" href="./"><span class="brand-mark">UV</span><span class="brand-name">UniVault</span></a>' +
    '  <nav class="header-nav">' +
    (session
      ? '<a href="./">Universities</a>' +
        (profile && profile.is_admin ? '<a href="./admin/dashboard.html">Admin</a>' : '') +
        '<button class="btn btn-ghost" onclick="logoutStudent()">Logout (' + escapeHTML(profile?.username || '') + ')</button>'
      : '<a href="./login.html">Log in</a><a href="./signup.html" class="btn btn-primary">Sign up</a>') +
    '  </nav>' +
    '</div>';
  if (session) {
    window.logoutStudent = logoutStudent;
  }
}

function initTheme() {
  // Theme is driven by <html class="theme-..."> set per page.
  // Public pages default to the academic theme.
}
