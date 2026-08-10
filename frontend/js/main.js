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
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
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
  if (getTheme() === 'light') {
    setTheme('light', false);
  } else {
    setTheme('dark', false);
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
      overlay.innerHTML = '<svg class="pt-logo" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">' +
        '<rect class="lg lg-1" x="4" y="4" width="56" height="56" rx="15" pathLength="1"/>' +
        '<path class="lg lg-2" d="M27 28.5 h10 a3 3 0 0 1 3 3 v1.5 a1.8 1.8 0 0 1 -1.8 1.8 h-12.4 a1.8 1.8 0 0 1 -1.8 -1.8 V31.5 a3 3 0 0 1 3 -3 z" pathLength="1"/>' +
        '<path class="lg lg-3" d="M32 15.5 L47.5 23 L32 30.5 L16.5 23 Z" pathLength="1"/>' +
        '<path class="lg lg-4" d="M16.5 23 L32 30.5 L47.5 23 L47.5 26 L32 33.5 L16.5 26 Z" pathLength="1"/>' +
        '<path class="lg lg-5" d="M32 23 C32 31 25 32 25 37.5 C25 43 31 44 31 47.5 C31 50 28.7 50.8 27.4 50" pathLength="1"/>' +
        '<circle class="lg lg-6" cx="26.9" cy="52.6" r="1.9" pathLength="1"/>' +
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

  function playOut(url, opts) {
    var replace = opts && opts.replace;
    if (reduceMotion) { if (replace) location.replace(url); else location.href = url; return; }
    if (busy) return;
    busy = true;
    var el = getOverlay();
    el.classList.remove('done');
    el.classList.add('active');
    setTimeout(function () {
      if (replace) location.replace(url);
      else location.href = url;
    }, 1050);
  }

  function playIn() {
    if (reduceMotion || shown) return;
    shown = true;
    var el = getOverlay();
    el.classList.add('active');
    setTimeout(function () { el.classList.add('done'); }, 1050);
    setTimeout(function () { el.classList.remove('active', 'done'); }, 1450);
  }

  function samePage(url) {
    var a = location.pathname.replace(/\/index\.html$/, '') || '/';
    var b = url.pathname.replace(/\/index\.html$/, '') || '/';
    return a === b;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
    var href = a.getAttribute('href');
    if (!isInternal(href)) return;
    var url = new URL(href, location.href);
    if (samePage(url)) return;
    e.preventDefault();
    playOut(url.href);
  }, true);

  window.addEventListener('pageshow', function () { busy = false; setTimeout(playIn, 60); });
  document.addEventListener('DOMContentLoaded', function () { setTimeout(playIn, 60); });

  window.__nav = function (url, opts) { playOut(url, opts); };
})();

// ---- Brand logo: emerald graduation cap with an S-curve tassel ----
function studoraLogo() {
  return '<svg class="logo-mark" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<defs>' +
    '<linearGradient id="sg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#2FD6A4"/><stop offset="1" stop-color="#0B8F67"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<rect x="4" y="4" width="56" height="56" rx="15" fill="url(#sg)"/>' +
    '<path d="M27 28.5 h10 a3 3 0 0 1 3 3 v1.5 a1.8 1.8 0 0 1 -1.8 1.8 h-12.4 a1.8 1.8 0 0 1 -1.8 -1.8 V31.5 a3 3 0 0 1 3 -3 z" fill="#06251C"/>' +
    '<path d="M32 15.5 L47.5 23 L32 30.5 L16.5 23 Z" fill="#FFFFFF"/>' +
    '<path d="M16.5 23 L32 30.5 L47.5 23 L47.5 26 L32 33.5 L16.5 26 Z" fill="#DDF7EE"/>' +
    '<path d="M32 23 C32 31 25 32 25 37.5 C25 43 31 44 31 47.5 C31 50 28.7 50.8 27.4 50" stroke="#FFD166" stroke-width="2.6" stroke-linecap="round"/>' +
    '<circle cx="26.9" cy="52.6" r="1.9" fill="#FFD166"/>' +
    '</svg>';
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-logo]').forEach(function (el) {
    el.innerHTML = studoraLogo();
  });
});

// ---- University photos: slug -> local image (fallback: initials) ----
const UNI_IMAGES = {
  'ucas': './img/universities/ucas.webp',
  'iug': './img/universities/iug.webp',
  'alaqsa': './img/universities/alaqsa.webp',
  'azhar-gaza': './img/universities/azhar-gaza.webp',
  'up': './img/universities/up.webp',
  'esraa': './img/universities/esraa.webp'
};
function uniImage(slug) { return UNI_IMAGES[slug] || null; }

function toast(message, type) {
  const id = 'univault-toast';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;z-index:99999;padding:14px 22px;border-radius:10px;font:600 14px Inter,sans-serif;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.className = type === 'error' ? 'type-error' : type === 'success' ? 'type-success' : 'type-info';
  el.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#3b82f6';
  el.textContent = message;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('show'); }, 4000);
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
    '  <a class="brand" href="./"><span class="brand-mark">' + studoraLogo() + '</span><span class="brand-name">' + t('brand') + '</span></a>' +
    '  <nav class="header-nav" id="header-nav">' +
    '    <a href="./#universities">' + t('nav.universities') + '</a>' +
    '    <a href="./#universities">' + t('nav.services') + '</a>' +
    '    <a href="./#how">' + t('nav.about') + '</a>' +
    '    <a href="./#how">' + t('nav.blog') + '</a>' +
    '    <a href="./#contact">' + t('nav.contact') + '</a>' +
    (profile && profile.is_admin ? '<a href="./admin/dashboard.html">' + t('nav.admin') + '</a>' : '') +
    (session
      ? '<button class="btn btn-ghost btn-nav" onclick="logoutStudent()">' + t('nav.logout') + ' (' + escapeHTML(profile?.username || '') + ')</button>'
      : '<a href="./login.html" class="btn btn-primary btn-nav">' + t('nav.login') + '</a>') +
    '  </nav>' +
    '  <div class="header-actions">' +
    themeBtn +
    langBtn +
    '  </div>' +
    '  <button class="hamburger" id="hamburger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
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

// ---- Cursor glow: a soft emerald light that follows the pointer ----
// Desktop (fine pointers) only; skipped for touch and reduced motion.
(function () {
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var el = document.createElement('div');
  el.id = 'cursor-glow';
  document.body.appendChild(el);
  var x = -1000, y = -1000, tx = -1000, ty = -1000, raf = null;
  document.addEventListener('pointermove', function (e) {
    tx = e.clientX;
    ty = e.clientY;
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  function frame() {
    x += (tx - x) * 0.14;
    y += (ty - y) * 0.14;
    el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    raf = null;
  }
})();
