/**
 * DukaanLite — Theme Manager (js/shared/theme.js)
 * ------------------------------------------------
 * Reads/writes `dukaanlite_theme_v1` in localStorage.
 * Must be inlined in <head> before first paint to avoid a flash.
 * This module also exports the toggle for button wiring.
 */

(function () {
  const KEY = 'dukaanlite_theme_v1';

  function getStoredTheme() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0F1A14' : '#124729');
    }
    // Swap logos if any
    document.querySelectorAll('[data-logo-light]').forEach(el => {
      el.src = theme === 'dark'
        ? el.getAttribute('data-logo-dark')
        : el.getAttribute('data-logo-light');
    });
  }

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Apply immediately (called inline in <head>)
  const stored = getStoredTheme();
  const initial = stored || (prefersDark() ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', initial);

  // Public API — wired after DOM loads
  window.DukaanTheme = {
    get: function () {
      return document.documentElement.getAttribute('data-theme') || 'light';
    },
    set: function (theme) {
      applyTheme(theme);
      try { localStorage.setItem(KEY, theme); } catch (e) {}
    },
    toggle: function () {
      const next = window.DukaanTheme.get() === 'dark' ? 'light' : 'dark';
      window.DukaanTheme.set(next);
      // Update all toggle buttons on the page
      document.querySelectorAll('.dl-theme-toggle').forEach(btn => {
        btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        const icon = btn.querySelector('.dl-theme-icon');
        if (icon) {
          icon.innerHTML = next === 'dark'
            ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
            : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        }
      });
    },
    init: function () {
      // Re-apply logos after DOM is ready (data-logo-* attributes may now exist)
      applyTheme(window.DukaanTheme.get());
      // Wire all toggle buttons
      document.querySelectorAll('.dl-theme-toggle').forEach(btn => {
        btn.addEventListener('click', () => window.DukaanTheme.toggle());
      });
      // Listen for system preference change if no explicit preference stored
      if (!getStoredTheme() && window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
          if (!localStorage.getItem(KEY)) {
            window.DukaanTheme.set(e.matches ? 'dark' : 'light');
          }
        });
      }
    }
  };
})();
