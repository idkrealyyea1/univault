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

// ---- Page transition: the letter S ----
(function () {
  var overlay = null;
  var shown = false;
  var busy = false;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getOverlay() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pt-overlay';
      overlay.innerHTML = '<svg class="pt-s" viewBox="0 0 100 100" aria-hidden="true">' +
        '<path pathLength="1" d="M20 30 C20 17 33 12 50 12 C67 12 80 18 80 31 C80 42 70 47 55 48 C39 49 20 53 20 68 C20 81 35 88 50 88 C65 88 80 82 80 70"/>' +
        '</svg>';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function isInternal(href) {
    if (!href || href.charAt(0) === '#') return false;
    if (href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('javascript:') === 0) return false;
    var url;
    try { url = new URL(href, location.href); } catch (e) { return false; }
    return url.origin === location.origin;
  }

  function playOut(url) {
    if (reduceMotion) { location.href = url; return; }
    if (busy) return;
    busy = true;
    var el = getOverlay();
    el.classList.remove('done');
    el.classList.add('active');
    setTimeout(function () { location.href = url; }, 700);
  }

  function playIn() {
    if (reduceMotion || shown) return;
    shown = true;
    var el = getOverlay();
    el.classList.add('active');
    setTimeout(function () { el.classList.add('done'); }, 600);
    setTimeout(function () { el.classList.remove('active', 'done'); }, 950);
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
    var href = a.getAttribute('href');
    if (!isInternal(href)) return;
    var url = new URL(href, location.href);
    if (url.pathname === location.pathname && !url.search && !url.hash) return;
    e.preventDefault();
    playOut(url.href);
  }, true);

  window.addEventListener('pageshow', function () { setTimeout(playIn, 60); });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(playIn, 60); });

  window.__nav = function (url) { playOut(url); };
})();

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
    '  <button class="hamburger" id="hamburger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
    '  <nav class="header-nav" id="header-nav">' +
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
  const burger = header.querySelector('#hamburger');
  const nav = header.querySelector('.header-nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      const open = nav.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) {
        nav.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }
  if (session) {
    window.logoutStudent = logoutStudent;
  }
}
