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

// Mark a button (or any element) busy with a spinner. Pass true to show
// the spinner, false to restore. Original label is preserved in a dataset.
function setBusy(el, busy) {
  if (!el) return;
  if (busy) {
    if (!el.dataset.origLabel) el.dataset.origLabel = el.textContent;
    el.setAttribute('data-busy', '1');
    el.disabled = true;
  } else {
    el.removeAttribute('data-busy');
    el.disabled = false;
    if (el.dataset.origLabel) {
      el.textContent = el.dataset.origLabel;
      delete el.dataset.origLabel;
    }
  }
}

// ---- Dark theme ----
const THEME_KEY = 'studora_theme';

function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
}

function setTheme(theme, persist) {
  document.documentElement.setAttribute('data-theme', theme);
  if (persist !== false) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ } }
  document.querySelectorAll('.theme-toggle').forEach(function (el) {
    el.textContent = theme === 'dark' ? '☀' : '☾';
    el.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  });
}

function initTheme() {
  const stored = getTheme();
  if (stored === 'dark' || (stored === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    setTheme('dark', false);
  } else {
    setTheme('light', false);
  }
}

window.__toggleTheme = function () {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(next, true);
};

// ---- Back to top ----
function initBackToTop() {
  let btn = document.getElementById('back-to-top');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.textContent = '↑';
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(btn);
  }
  window.addEventListener('scroll', function () {
    btn.classList.toggle('visible', (window.scrollY || document.documentElement.scrollTop) > 500);
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', function () { initTheme(); initBackToTop(); });

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
  initTheme();
  const session = await supabase.auth.getSession().then(({ data }) => data.session);
  const profile = session ? await getProfile() : null;
  const langBtn = '<button class="lang-toggle" id="lang-toggle" onclick="__toggleLang()" title="">' + t('lang.toggle') + '</button>';
  const themeBtn = '<button class="theme-toggle" id="theme-toggle" onclick="__toggleTheme()" aria-label="Toggle theme"></button>';
  header.innerHTML =
    '<div class="header-inner">' +
    '  <a class="brand" href="./"><span class="brand-mark">S</span><span class="brand-name">' + t('brand') + '</span></a>' +
    '  <nav class="header-nav">' +
    '<a href="./gallery.html">' + t('nav.gallery') + '</a>' +
    (session
      ? '<a href="./">' + t('nav.universities') + '</a>' +
        (profile && profile.is_admin ? '<a href="./admin/dashboard.html">' + t('nav.admin') + '</a>' : '') +
        '<button class="btn btn-ghost" onclick="logoutStudent()">' + t('nav.logout') + ' (' + escapeHTML(profile?.username || '') + ')</button>'
      : '<a href="./login.html">' + t('nav.login') + '</a><a href="./signup.html" class="btn btn-primary">' + t('nav.signup') + '</a>') +
    themeBtn +
    langBtn +
    '  </nav>' +
    '</div>';
  const toggle = header.querySelector('#lang-toggle');
  if (toggle) {
    toggle.textContent = t('lang.toggle');
    toggle.title = t('lang.name');
  }
  const themeToggle = header.querySelector('#theme-toggle');
  if (themeToggle) {
    themeToggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾';
  }
  if (session) {
    window.logoutStudent = logoutStudent;
  }
}
