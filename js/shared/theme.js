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
    // Update all theme toggle buttons
    document.querySelectorAll('.dl-theme-toggle').forEach(btn => {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      const icon = btn.querySelector('.dl-theme-icon');
      if (icon) {
        icon.innerHTML = theme === 'dark'
          ? '<i class="bi bi-sun" aria-hidden="true"></i>'
          : '<i class="bi bi-moon-stars" aria-hidden="true"></i>';
      }
      const text = btn.querySelector('.dl-theme-toggle-text');
      if (text) {
        text.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
      }
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
