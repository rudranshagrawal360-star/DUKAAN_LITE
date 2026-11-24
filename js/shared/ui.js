/**
 * ============================================================================
 * DukaanLite - Shared UI Helpers (js/shared/ui.js)
 * ============================================================================
 * Provides reusable UI helper functions for:
 * 1. Toast notifications (non-blocking user feedback)
 * 2. Empty state rendering
 * 3. Confirmation dialogs (Bootstrap Modal wrapper)
 * 4. Safe HTML string escaping to prevent XSS injection
 * ============================================================================
 */

/**
 * Escapes special HTML characters to prevent XSS injection when rendering user strings.
 * @param {string} str - Raw string
 * @returns {string} Escaped string safe for innerHTML
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Shows a non-blocking toast alert in the bottom-right corner.
 * @param {string} message - Text message to display
 * @param {('success'|'error'|'warning'|'info')} type - Alert severity type
 * @param {number} duration - Milliseconds before auto-dismissing (default: 3500ms)
 */
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const icons = {
    success: '<i class="bi bi-check-circle-fill text-success" aria-hidden="true"></i>',
    error: '<i class="bi bi-x-circle-fill text-danger" aria-hidden="true"></i>',
    warning: '<i class="bi bi-exclamation-triangle-fill text-warning" aria-hidden="true"></i>',
    info: '<i class="bi bi-info-circle-fill text-primary" aria-hidden="true"></i>'
  };

  const toast = document.createElement('div');
  toast.className = `dukaan-toast toast-${type}`;
  toast.setAttribute('role', 'status');

  toast.innerHTML = `
    <span class="dl-toast-icon">${icons[type] || icons.info}</span>
    <div style="flex: 1; font-size: 0.88rem; font-weight: 500; line-height: 1.35;">${escapeHtml(message)}</div>
    <button type="button" aria-label="Close notification" class="dl-toast-close">
      <i class="bi bi-x-lg" aria-hidden="true" style="font-size: 0.82rem;"></i>
    </button>
  `;

  function dismiss() {
    if (toast.classList.contains('dismissing')) return;
    toast.classList.add('dismissing');
    setTimeout(() => toast.remove(), 250);
  }

  // Close on button click
  toast.querySelector('.dl-toast-close').addEventListener('click', dismiss);

  container.appendChild(toast);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

/**
 * Renders a consistent empty state inside a target container element.
 * @param {HTMLElement} container - DOM element to render into
 * @param {string} message - Message explaining that no records were found
 * @param {string} [actionText] - Optional button text
 * @param {Function} [actionCallback] - Optional button click callback
 */
function renderEmptyState(container, message, actionText = null, actionCallback = null) {
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'text-center py-5 px-3';
  wrapper.style.maxWidth = '420px';
  wrapper.style.margin = '0 auto';

  wrapper.innerHTML = `
    <div class="mb-2" aria-hidden="true">
      <i class="bi bi-basket2 text-dl-muted" style="font-size: 2.25rem;"></i>
    </div>
    <h3 class="dl-heading mb-1" style="font-size: 1.15rem; color: var(--dl-ink);">No items found</h3>
    <p class="text-dl-muted small mb-3">${escapeHtml(message)}</p>
    ${actionText ? `<button type="button" class="btn-dl-secondary btn-sm empty-state-btn">${escapeHtml(actionText)}</button>` : ''}
  `;

  if (actionText && actionCallback) {
    wrapper.querySelector('.empty-state-btn').addEventListener('click', actionCallback);
  }

  container.innerHTML = '';
  container.appendChild(wrapper);
}

/**
 * Displays a Bootstrap-powered confirmation modal for destructive or critical actions.
 * @param {string} title - Dialog header title
 * @param {string} message - Detailed question or confirmation warning
 * @param {Function} onConfirm - Callback if confirmed
 * @param {string} [confirmText='Confirm'] - Confirm button label
 * @param {string} [confirmBtnClass='btn-danger'] - Bootstrap button class
 */
function showConfirmDialog(title, message, onConfirm, confirmText = 'Confirm', confirmBtnClass = 'btn-danger') {
  let modalEl = document.getElementById('dukaan-confirm-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'dukaan-confirm-modal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color);">
            <h5 class="modal-title font-heading" id="dukaan-confirm-title"></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="dukaan-confirm-body" style="font-size: 0.95rem; color: var(--text-main);"></div>
          <div class="modal-footer" style="border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-light" data-bs-dismiss="modal" style="border-radius: var(--radius-md);">Cancel</button>
            <button type="button" id="dukaan-confirm-action-btn" class="btn" style="border-radius: var(--radius-md);"></button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  // Populate dynamic text
  document.getElementById('dukaan-confirm-title').textContent = title;
  document.getElementById('dukaan-confirm-body').textContent = message;

  const actionBtn = document.getElementById('dukaan-confirm-action-btn');
  actionBtn.className = `btn ${confirmBtnClass}`;
  actionBtn.textContent = confirmText;

  const bsModal = new bootstrap.Modal(modalEl);

  // One-time listener for confirmation
  const handleConfirm = () => {
    bsModal.hide();
    actionBtn.removeEventListener('click', handleConfirm);
    if (typeof onConfirm === 'function') onConfirm();
  };

  actionBtn.addEventListener('click', handleConfirm);
  bsModal.show();
}

// Export for window or ES modules
if (typeof window !== 'undefined') {
  window.DukaanUI = {
    escapeHtml,
    showToast,
    renderEmptyState,
    showConfirmDialog
  };
}
