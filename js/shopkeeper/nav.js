/**
 * DukaanLite — Shopkeeper Shared Nav & Badges (js/shopkeeper/nav.js)
 * -----------------------------------------------------------------
 * Handles sidebar pending badges, theme toggles, and live sync across all shopkeeper pages.
 */

(function () {
  'use strict';

  function updateNavPendingBadges() {
    if (typeof DukaanStorage === 'undefined') return;
    const orders = DukaanStorage.getOrders();
    const pendingCount = orders.filter(o => o.status === 'Pending').length;

    const sidebarBadge = document.getElementById('sidebar-pending-badge');
    const mobileBadge = document.getElementById('mobile-pending-badge');

    if (sidebarBadge) {
      sidebarBadge.textContent = pendingCount;
      sidebarBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
    if (mobileBadge) {
      mobileBadge.textContent = pendingCount;
      mobileBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
  }

  function pulseNavBadges() {
    const sidebarBadge = document.getElementById('sidebar-pending-badge');
    const mobileBadge = document.getElementById('mobile-pending-badge');
    if (sidebarBadge) {
      sidebarBadge.classList.remove('dl-badge-pulse');
      void sidebarBadge.offsetWidth;
      sidebarBadge.classList.add('dl-badge-pulse');
    }
    if (mobileBadge) {
      mobileBadge.classList.remove('dl-badge-pulse');
      void mobileBadge.offsetWidth;
      mobileBadge.classList.add('dl-badge-pulse');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (window.DukaanTheme) DukaanTheme.init();
    updateNavPendingBadges();

    // Listen to live events for new orders
    if (window.DukaanLive) {
      window.DukaanLive.subscribe((event, data) => {
        if (event === 'ORDER_CREATED' || event === 'ORDER_UPDATED') {
          updateNavPendingBadges();
          if (event === 'ORDER_CREATED') {
            pulseNavBadges();
            if (window.DukaanUI) {
              DukaanUI.showToast(`New order #${data.id} from ${data.customerName || 'Customer'}!`, 'success');
            }
          }
        }
      });
    }
  });

  window.DukaanShopNav = {
    updateBadges: updateNavPendingBadges,
    pulseBadges: pulseNavBadges
  };
})();
