/**
 * DukaanLite — Shopkeeper Order Management (js/shopkeeper/orders.js)
 * -----------------------------------------------------------------
 * Handles Kanban board view, list view, parchi order cards,
 * FLIP transitions, Right-Side Drawer, live updates, and status advancement.
 */

(function () {
  'use strict';

  // State
  let orders = [];
  let searchQuery = '';
  let dateFilter = 'all'; // 'today' | '7days' | 'all'
  let showCancelled = false;
  let currentView = 'board'; // 'board' | 'list'
  let activeMobileStatus = 'Pending';
  let selectedOrderId = null;
  let orderToCancelId = null;

  const STATUS_ORDER = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed'];

  const STATUS_CONFIG = {
    'Pending': {
      label: 'Pending',
      icon: 'bi-clock',
      badgeClass: 'status-pending',
      nextAction: 'Accept order',
      nextIcon: 'bi-check2',
      nextStatus: 'Confirmed'
    },
    'Confirmed': {
      label: 'Confirmed',
      icon: 'bi-check-circle',
      badgeClass: 'status-confirmed',
      nextAction: 'Start preparing',
      nextIcon: 'bi-box-seam',
      nextStatus: 'Preparing'
    },
    'Preparing': {
      label: 'Preparing',
      icon: 'bi-fire',
      badgeClass: 'status-preparing',
      nextAction: 'Mark ready',
      nextIcon: 'bi-bell',
      nextStatus: 'Ready'
    },
    'Ready': {
      label: 'Ready',
      icon: 'bi-bell',
      badgeClass: 'status-ready',
      nextAction: 'Complete',
      nextIcon: 'bi-check2-circle',
      nextStatus: 'Completed'
    },
    'Completed': {
      label: 'Completed',
      icon: 'bi-check2-all',
      badgeClass: 'status-completed',
      nextAction: null,
      nextIcon: null,
      nextStatus: null
    },
    'Cancelled': {
      label: 'Cancelled',
      icon: 'bi-x-circle',
      badgeClass: 'status-cancelled',
      nextAction: null,
      nextIcon: null,
      nextStatus: null
    }
  };

  /* --------------------------------------------------------------------------
     Initialization
     -------------------------------------------------------------------------- */
  function init() {
    if (window.DukaanTheme) DukaanTheme.init();
    orders = DukaanStorage.getOrders();

    setupEventListeners();
    setupLiveListener();
    renderAll();

    // Auto-refresh relative times & overdue timers every 30s
    setInterval(() => {
      refreshRelativeTimes();
    }, 30000);
  }

  /* --------------------------------------------------------------------------
     Live Cross-Tab Synchronization
     -------------------------------------------------------------------------- */
  function setupLiveListener() {
    if (window.DukaanLive) {
      window.DukaanLive.subscribe((event, data) => {
        if (event === 'ORDER_CREATED') {
          orders = DukaanStorage.getOrders();
          renderAll();
          if (window.DukaanUI) {
            DukaanUI.showToast(`New order #${data.id} from ${data.customerName || 'Customer'}!`, 'success');
          }
          pulsePendingBadge();
          // Animate the new card
          requestAnimationFrame(() => {
            const cardEl = document.querySelector(`[data-card-id="${data.id}"]`);
            if (cardEl) {
              cardEl.classList.add('dl-order-entering');
            }
          });
        } else if (event === 'ORDER_UPDATED') {
          orders = DukaanStorage.getOrders();
          renderAll();
          if (selectedOrderId && selectedOrderId === data.orderId) {
            const updated = orders.find(o => o.id === data.orderId);
            if (updated) renderDrawer(updated);
          }
        }
      });
    }
  }

  function pulsePendingBadge() {
    const badge = document.getElementById('sidebar-pending-badge');
    const mobBadge = document.getElementById('mobile-pending-badge');
    if (badge) {
      badge.classList.remove('dl-badge-pulse');
      void badge.offsetWidth;
      badge.classList.add('dl-badge-pulse');
    }
    if (mobBadge) {
      mobBadge.classList.remove('dl-badge-pulse');
      void mobBadge.offsetWidth;
      mobBadge.classList.add('dl-badge-pulse');
    }
  }

  /* --------------------------------------------------------------------------
     Event Listeners
     -------------------------------------------------------------------------- */
  function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('orders-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        renderViews();
      });
    }

    // Date filter
    const dateSelect = document.getElementById('orders-date-filter');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        dateFilter = e.target.value;
        renderAll();
      });
    }

    // Toggle cancelled
    const toggleCancelledBtn = document.getElementById('toggle-cancelled-btn');
    if (toggleCancelledBtn) {
      toggleCancelledBtn.addEventListener('click', () => {
        showCancelled = !showCancelled;
        toggleCancelledBtn.classList.toggle('active', showCancelled);
        toggleCancelledBtn.innerHTML = showCancelled
          ? `<i class="bi bi-eye-slash"></i> Hide cancelled`
          : `<i class="bi bi-eye"></i> Cancelled (${getCancelledCount()})`;
        
        const boardGrid = document.getElementById('orders-board-grid');
        if (boardGrid) {
          boardGrid.classList.toggle('show-cancelled', showCancelled);
        }
        renderViews();
      });
    }

    // View switcher: Board | List
    const btnBoard = document.getElementById('view-board-btn');
    const btnList = document.getElementById('view-list-btn');
    const boardView = document.getElementById('orders-board-view');
    const listView = document.getElementById('orders-list-view');

    if (btnBoard && btnList) {
      btnBoard.addEventListener('click', () => {
        currentView = 'board';
        btnBoard.classList.add('active');
        btnList.classList.remove('active');
        boardView.classList.remove('hidden');
        listView.classList.remove('active');
      });

      btnList.addEventListener('click', () => {
        currentView = 'list';
        btnList.classList.add('active');
        btnBoard.classList.remove('active');
        boardView.classList.add('hidden');
        listView.classList.add('active');
      });
    }

    // Drawer close buttons
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawerOverlay = document.getElementById('dl-drawer-overlay');
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    // Cancel modal buttons
    const cancelModalOverlay = document.getElementById('dl-cancel-overlay');
    const cancelDismissBtn = document.getElementById('cancel-modal-dismiss');
    const cancelConfirmBtn = document.getElementById('cancel-modal-confirm');

    if (cancelModalOverlay) {
      cancelModalOverlay.addEventListener('click', (e) => {
        if (e.target === cancelModalOverlay) closeCancelModal();
      });
    }
    if (cancelDismissBtn) cancelDismissBtn.addEventListener('click', closeCancelModal);
    if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', handleConfirmCancel);

    // Keyboard escape to close modals/drawers
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
        closeCancelModal();
        closeAllDropdowns();
      }
    });

    // Close any card dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dl-card-menu-wrap')) {
        closeAllDropdowns();
      }
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.dl-card-dropdown.active').forEach(d => d.classList.remove('active'));
  }

  /* --------------------------------------------------------------------------
     Filtering & Calculations
     -------------------------------------------------------------------------- */
  function getFilteredOrders() {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return orders.filter(order => {
      // Date filter
      if (dateFilter === 'today') {
        const orderTime = new Date(order.createdAt).getTime();
        if (orderTime < startOfToday.getTime()) return false;
      } else if (dateFilter === '7days') {
        const orderTime = new Date(order.createdAt).getTime();
        if (orderTime < now - 7 * 86400000) return false;
      }

      // Search filter
      if (searchQuery) {
        const matchId = (order.id || '').toLowerCase().includes(searchQuery);
        const matchName = (order.customerName || '').toLowerCase().includes(searchQuery);
        const matchPhone = (order.customerPhone || '').toLowerCase().includes(searchQuery);
        const matchItem = (order.items || []).some(item => 
          (item.name || '').toLowerCase().includes(searchQuery)
        );
        if (!matchId && !matchName && !matchPhone && !matchItem) return false;
      }

      return true;
    });
  }

  function getCancelledCount() {
    return orders.filter(o => o.status === 'Cancelled').length;
  }

  /* --------------------------------------------------------------------------
     Stats Strip & Badge Updates
     -------------------------------------------------------------------------- */
  function updateStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter(o => new Date(o.createdAt).getTime() >= startOfToday.getTime());
    const pendingOrders = orders.filter(o => o.status === 'Pending');
    const validTodayOrders = todayOrders.filter(o => o.status !== 'Cancelled');
    const revenueToday = validTodayOrders.reduce((sum, o) => sum + Number(o.estimatedTotal || 0), 0);
    const avgOrderValue = validTodayOrders.length > 0 
      ? Math.round(revenueToday / validTodayOrders.length) 
      : 0;

    // Stat elements
    const statTodayCount = document.getElementById('stat-today-orders');
    const statPendingCount = document.getElementById('stat-pending-orders');
    const statRevenueToday = document.getElementById('stat-revenue-today');
    const statAov = document.getElementById('stat-aov');

    if (statTodayCount) statTodayCount.textContent = todayOrders.length;
    if (statPendingCount) statPendingCount.textContent = pendingOrders.length;
    if (statRevenueToday) statRevenueToday.textContent = `₹${revenueToday.toLocaleString('en-IN')}`;
    if (statAov) statAov.textContent = `₹${avgOrderValue.toLocaleString('en-IN')}`;

    // Sidebar & mobile pending count badge
    const sidebarBadge = document.getElementById('sidebar-pending-badge');
    const mobileBadge = document.getElementById('mobile-pending-badge');
    const pendingCount = pendingOrders.length;

    if (sidebarBadge) {
      sidebarBadge.textContent = pendingCount;
      sidebarBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
    if (mobileBadge) {
      mobileBadge.textContent = pendingCount;
      mobileBadge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }

    // Toggle cancelled button label
    const toggleCancelledBtn = document.getElementById('toggle-cancelled-btn');
    if (toggleCancelledBtn && !showCancelled) {
      toggleCancelledBtn.innerHTML = `<i class="bi bi-eye"></i> Cancelled (${getCancelledCount()})`;
    }
  }

  /* --------------------------------------------------------------------------
     Relative Time & Overdue Check
     -------------------------------------------------------------------------- */
  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
  }

  function isPendingOverdue(order) {
    if (order.status !== 'Pending') return false;
    const diffMs = Date.now() - new Date(order.createdAt).getTime();
    return diffMs > 10 * 60 * 1000; // > 10 minutes
  }

  function refreshRelativeTimes() {
    document.querySelectorAll('[data-created-time]').forEach(el => {
      const iso = el.getAttribute('data-created-time');
      el.textContent = formatRelativeTime(iso);
    });

    // Check overdue on pending cards
    document.querySelectorAll('.dl-parchi-card[data-status="Pending"]').forEach(cardEl => {
      const iso = cardEl.getAttribute('data-created');
      const diffMs = Date.now() - new Date(iso).getTime();
      const isOverdue = diffMs > 10 * 60 * 1000;
      cardEl.classList.toggle('dl-pending-overdue', isOverdue);
      
      const badgeWrap = cardEl.querySelector('.dl-card-overdue-holder');
      if (badgeWrap) {
        badgeWrap.innerHTML = isOverdue 
          ? `<span class="dl-overdue-chip"><i class="bi bi-clock-history"></i> >10m</span>` 
          : '';
      }
    });
  }

  /* --------------------------------------------------------------------------
     Render All (Stats + Views)
     -------------------------------------------------------------------------- */
  function renderAll() {
    updateStats();
    renderViews();
  }

  function renderViews() {
    const filtered = getFilteredOrders();
    renderBoardView(filtered);
    renderListView(filtered);
    renderMobileStatusTabs(filtered);
  }

  /* --------------------------------------------------------------------------
     Mobile Status Tabs
     -------------------------------------------------------------------------- */
  function renderMobileStatusTabs(filtered) {
    const container = document.getElementById('dl-mobile-status-tabs');
    if (!container) return;

    const statuses = [...STATUS_ORDER];
    if (showCancelled) statuses.push('Cancelled');

    container.innerHTML = statuses.map(status => {
      const count = filtered.filter(o => o.status === status).length;
      const isActive = status === activeMobileStatus;
      return `
        <button type="button" class="dl-mobile-status-tab ${isActive ? 'active' : ''}" data-status="${status}">
          <span>${status}</span>
          <span class="badge-count">${count}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.dl-mobile-status-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        activeMobileStatus = e.currentTarget.getAttribute('data-status');
        renderMobileStatusTabs(filtered);
        updateMobileColumnVisibility();
      });
    });

    updateMobileColumnVisibility();
  }

  function updateMobileColumnVisibility() {
    document.querySelectorAll('.dl-board-col').forEach(col => {
      const colStatus = col.getAttribute('data-status');
      if (colStatus === activeMobileStatus) {
        col.classList.add('mobile-visible');
      } else {
        col.classList.remove('mobile-visible');
      }
    });
  }

  /* --------------------------------------------------------------------------
     Kanban Board View
     -------------------------------------------------------------------------- */
  function renderBoardView(filtered) {
    const columnsToRender = [...STATUS_ORDER];
    if (showCancelled) columnsToRender.push('Cancelled');

    // Update column counts and card lists
    const allStatuses = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

    allStatuses.forEach(status => {
      const colEl = document.querySelector(`.dl-board-col[data-status="${status}"]`);
      if (!colEl) return;

      if (status === 'Cancelled') {
        colEl.style.display = showCancelled ? 'flex' : 'none';
      }

      const columnOrders = filtered.filter(o => o.status === status);
      const countEl = colEl.querySelector('.dl-board-col-count');
      if (countEl) countEl.textContent = columnOrders.length;

      const cardsContainer = colEl.querySelector('.dl-board-col-cards');
      if (!cardsContainer) return;

      if (columnOrders.length === 0) {
        cardsContainer.innerHTML = `
          <div class="dl-board-empty">
            No ${status.toLowerCase()} orders
          </div>
        `;
      } else {
        cardsContainer.innerHTML = columnOrders.map(order => buildParchiCardHtml(order)).join('');
      }
    });

    attachCardEvents();
  }

  /* --------------------------------------------------------------------------
     Build Parchi Slip Order Card HTML
     -------------------------------------------------------------------------- */
  function buildParchiCardHtml(order) {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Pending'];
    const overdue = isPendingOverdue(order);
    const relTime = formatRelativeTime(order.createdAt);
    
    // Items up to 3 lines
    const items = order.items || [];
    const itemLines = items.slice(0, 3).map(i => `
      <div class="dl-card-item-line">
        <strong>${i.quantity} ×</strong> ${DukaanUI.escapeHtml(i.name)}
      </div>
    `).join('');

    const moreCount = items.length > 3 ? items.length - 3 : 0;
    const moreHtml = moreCount > 0 
      ? `<div class="dl-card-more-items">+${moreCount} more item${moreCount > 1 ? 's' : ''}</div>` 
      : '';

    // Action button
    let actionBtnHtml = '';
    if (cfg.nextStatus) {
      actionBtnHtml = `
        <button type="button" class="dl-card-btn-primary btn-advance-order" data-id="${order.id}" data-next="${cfg.nextStatus}" onclick="event.stopPropagation()">
          <i class="bi ${cfg.nextIcon}"></i> ${cfg.nextAction}
        </button>
      `;
    } else if (order.status === 'Completed') {
      actionBtnHtml = `
        <span class="dl-card-done-label">
          <i class="bi bi-check2-all"></i> Completed
        </span>
      `;
    } else if (order.status === 'Cancelled') {
      actionBtnHtml = `
        <span class="dl-card-cancelled-label">
          <i class="bi bi-x-circle"></i> Cancelled
        </span>
      `;
    }

    // Cancel menu item (eligible only if Pending, Confirmed, or Preparing)
    const canCancel = ['Pending', 'Confirmed', 'Preparing'].includes(order.status);
    const cancelMenuHtml = canCancel ? `
      <button type="button" class="dl-card-dropdown-item text-danger btn-open-cancel" data-id="${order.id}" onclick="event.stopPropagation()">
        <i class="bi bi-x-circle"></i> Cancel order
      </button>
    ` : '';

    return `
      <div class="dl-parchi-card ${overdue ? 'dl-pending-overdue' : ''}" 
           data-card-id="${order.id}" 
           data-status="${order.status}"
           data-created="${order.createdAt}"
           tabindex="0"
           role="button"
           aria-label="View order ${order.id}">
        
        <!-- Top Row: Order ID & Time / Overdue -->
        <div class="dl-card-top-row">
          <span class="dl-card-order-id">#${DukaanUI.escapeHtml(order.id)}</span>
          <div class="d-flex align-items-center gap-1">
            <span class="dl-card-overdue-holder">
              ${overdue ? '<span class="dl-overdue-chip"><i class="bi bi-clock-history"></i> >10m</span>' : ''}
            </span>
            <span class="dl-card-time-badge" data-created-time="${order.createdAt}">
              ${relTime}
            </span>
          </div>
        </div>

        <!-- Customer Row: Name & Tap to Call -->
        <div class="dl-card-customer-row">
          <span class="dl-card-customer-name">${DukaanUI.escapeHtml(order.customerName || 'Customer')}</span>
          ${order.customerPhone ? `
            <a href="tel:${order.customerPhone}" class="dl-card-phone-link" onclick="event.stopPropagation()" title="Call customer">
              <i class="bi bi-telephone"></i> ${order.customerPhone}
            </a>
          ` : ''}
        </div>

        <!-- Parchi Tear Line -->
        <div class="dl-parchi-card-tear" aria-hidden="true"></div>

        <!-- Items Summary (up to 3 items) -->
        <div class="dl-card-items-list">
          ${itemLines}
          ${moreHtml}
        </div>

        <!-- Total Row -->
        <div class="dl-card-total-row">
          <span class="dl-card-total-label">Estimated Total</span>
          <span class="dl-card-total-amount">₹${Number(order.estimatedTotal || 0).toLocaleString('en-IN')}</span>
        </div>

        <!-- Actions Footer -->
        <div class="dl-card-actions">
          ${actionBtnHtml}
          
          <div class="dl-card-menu-wrap">
            <button type="button" class="dl-card-menu-btn" data-id="${order.id}" aria-label="More actions" onclick="event.stopPropagation()">
              <i class="bi bi-three-dots"></i>
            </button>
            <div class="dl-card-dropdown" id="dropdown-${order.id}">
              <button type="button" class="dl-card-dropdown-item btn-msg-wa" data-id="${order.id}" onclick="event.stopPropagation()">
                <i class="bi bi-whatsapp" style="color: #25D366;"></i> Message on WhatsApp
              </button>
              ${cancelMenuHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Attach Card Events (Advances, Dropdowns, WhatsApp, Click-to-Drawer)
     -------------------------------------------------------------------------- */
  function attachCardEvents() {
    // Card Click -> Open Drawer
    document.querySelectorAll('.dl-parchi-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = card.getAttribute('data-card-id');
        const order = orders.find(o => o.id === id);
        if (order) openDrawer(order);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = card.getAttribute('data-card-id');
          const order = orders.find(o => o.id === id);
          if (order) openDrawer(order);
        }
      });
    });

    // Advance order button
    document.querySelectorAll('.btn-advance-order').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const nextStatus = btn.getAttribute('data-next');
        advanceOrderStatus(id, nextStatus);
      });
    });

    // More menu dropdown toggle
    document.querySelectorAll('.dl-card-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const dropdown = document.getElementById(`dropdown-${id}`);
        if (!dropdown) return;

        const isCurrentlyOpen = dropdown.classList.contains('active');
        closeAllDropdowns();
        if (!isCurrentlyOpen) {
          dropdown.classList.add('active');
        }
      });
    });

    // WhatsApp message
    document.querySelectorAll('.btn-msg-wa').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        closeAllDropdowns();
        const order = orders.find(o => o.id === id);
        if (order) openWhatsAppMessage(order);
      });
    });

    // Cancel order from dropdown
    document.querySelectorAll('.btn-open-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        closeAllDropdowns();
        const order = orders.find(o => o.id === id);
        if (order) openCancelModal(order);
      });
    });
  }

  /* --------------------------------------------------------------------------
     FLIP Status Advancement
     -------------------------------------------------------------------------- */
  function advanceOrderStatus(orderId, nextStatus) {
    const cardEl = document.querySelector(`.dl-parchi-card[data-card-id="${orderId}"]`);
    let firstRect = null;
    if (cardEl && currentView === 'board') {
      firstRect = cardEl.getBoundingClientRect();
    }

    // Update in storage
    const success = DukaanStorage.updateOrderStatus(orderId, nextStatus);
    if (!success) return;

    orders = DukaanStorage.getOrders();
    const updatedOrder = orders.find(o => o.id === orderId);

    if (window.DukaanUI) {
      DukaanUI.showToast(`Order #${orderId} moved to ${nextStatus}`, 'success');
    }

    // Re-render
    renderAll();

    // If drawer is open with this order, update drawer too
    if (selectedOrderId === orderId && updatedOrder) {
      renderDrawer(updatedOrder);
    }

    // Execute FLIP animation if on Board view
    if (firstRect && currentView === 'board') {
      const newCardEl = document.querySelector(`.dl-parchi-card[data-card-id="${orderId}"]`);
      if (newCardEl) {
        const lastRect = newCardEl.getBoundingClientRect();
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;

        newCardEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        newCardEl.style.transition = 'none';

        requestAnimationFrame(() => {
          newCardEl.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)';
          newCardEl.style.transform = '';
        });
      }
    }
  }

  /* --------------------------------------------------------------------------
     List View (Table Layout)
     -------------------------------------------------------------------------- */
  function renderListView(filtered) {
    const tbody = document.getElementById('orders-table-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-dl-muted">
            No orders found matching criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(order => {
      const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Pending'];
      const relTime = formatRelativeTime(order.createdAt);
      
      const items = order.items || [];
      const firstItemName = items.length > 0 ? items[0].name : 'No items';
      const itemsSummary = `${items.length} item${items.length === 1 ? '' : 's'} (${firstItemName}${items.length > 1 ? ', …' : ''})`;

      const dateObj = new Date(order.createdAt);
      const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // Action button
      let actionHtml = '';
      if (cfg.nextStatus) {
        actionHtml = `
          <button type="button" class="btn btn-dl-primary btn-sm btn-advance-order" data-id="${order.id}" data-next="${cfg.nextStatus}" onclick="event.stopPropagation()">
            ${cfg.nextAction}
          </button>
        `;
      } else if (order.status === 'Completed') {
        actionHtml = `<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Done</span>`;
      } else {
        actionHtml = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">Cancelled</span>`;
      }

      return `
        <tr data-table-order-id="${order.id}">
          <td>
            <div class="dl-table-order-id">#${DukaanUI.escapeHtml(order.id)}</div>
            <div class="dl-table-order-time" data-created-time="${order.createdAt}">${relTime}</div>
          </td>
          <td>
            <div class="fw-semibold">${DukaanUI.escapeHtml(order.customerName || 'Customer')}</div>
            <div class="small text-dl-muted font-tabular">${order.customerPhone || ''}</div>
          </td>
          <td>
            <div class="small text-dl-text" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${itemsSummary}
            </div>
          </td>
          <td>
            <span class="small font-tabular">${formattedTime}</span>
          </td>
          <td>
            <span class="dl-table-total">₹${Number(order.estimatedTotal || 0).toLocaleString('en-IN')}</span>
          </td>
          <td>
            <span class="dl-status-badge ${cfg.badgeClass}">
              <i class="bi ${cfg.icon}"></i> ${order.status}
            </span>
          </td>
          <td>
            <div class="d-flex align-items-center gap-1" onclick="event.stopPropagation()">
              ${actionHtml}
              <button type="button" class="btn btn-outline-secondary btn-sm p-1 btn-table-menu" data-id="${order.id}" title="Message on WhatsApp">
                <i class="bi bi-whatsapp text-success"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Row clicks to open drawer
    tbody.querySelectorAll('tr[data-table-order-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const id = tr.getAttribute('data-table-order-id');
        const order = orders.find(o => o.id === id);
        if (order) openDrawer(order);
      });
    });

    // Row advance buttons
    tbody.querySelectorAll('.btn-advance-order').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const nextStatus = btn.getAttribute('data-next');
        advanceOrderStatus(id, nextStatus);
      });
    });

    // Row WhatsApp button
    tbody.querySelectorAll('.btn-table-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const order = orders.find(o => o.id === id);
        if (order) openWhatsAppMessage(order);
      });
    });
  }

  /* --------------------------------------------------------------------------
     WhatsApp Messaging Prefill
     -------------------------------------------------------------------------- */
  function openWhatsAppMessage(order) {
    const phone = (order.customerPhone || '').replace(/\D/g, '');
    const cleanPhone = phone.startsWith('91') ? phone : `91${phone}`;

    const statusMessages = {
      'Pending': `Namaste ${order.customerName || 'Customer'}, we received your order #${order.id} for ₹${order.estimatedTotal}. We will confirm it shortly!`,
      'Confirmed': `Namaste ${order.customerName || 'Customer'}, your order #${order.id} for ₹${order.estimatedTotal} is Confirmed at DukaanLite.`,
      'Preparing': `Namaste ${order.customerName || 'Customer'}, your order #${order.id} is now Being Prepared.`,
      'Ready': `Namaste ${order.customerName || 'Customer'}, your order #${order.id} for ₹${order.estimatedTotal} is Packed & Ready for pickup!`,
      'Completed': `Namaste ${order.customerName || 'Customer'}, your order #${order.id} is Completed. Thank you for shopping with DukaanLite!`,
      'Cancelled': `Namaste ${order.customerName || 'Customer'}, your order #${order.id} has been Cancelled. Please let us know if you need assistance.`
    };

    const text = encodeURIComponent(statusMessages[order.status] || `Namaste, regarding order #${order.id}`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  }

  /* --------------------------------------------------------------------------
     Right-Side Order Drawer
     -------------------------------------------------------------------------- */
  function openDrawer(order) {
    selectedOrderId = order.id;
    renderDrawer(order);

    const drawer = document.getElementById('dl-order-drawer');
    const overlay = document.getElementById('dl-drawer-overlay');
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
  }

  function closeDrawer() {
    selectedOrderId = null;
    const drawer = document.getElementById('dl-order-drawer');
    const overlay = document.getElementById('dl-drawer-overlay');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  function renderDrawer(order) {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Pending'];

    // Header
    const titleEl = document.getElementById('drawer-order-id');
    const badgeEl = document.getElementById('drawer-order-badge');
    if (titleEl) titleEl.textContent = `#${order.id}`;
    if (badgeEl) {
      badgeEl.className = `dl-status-badge ${cfg.badgeClass}`;
      badgeEl.innerHTML = `<i class="bi ${cfg.icon}"></i> ${order.status}`;
    }

    // Customer section
    const nameEl = document.getElementById('drawer-customer-name');
    const phoneEl = document.getElementById('drawer-customer-phone');
    const callBtn = document.getElementById('drawer-call-btn');
    const waBtn = document.getElementById('drawer-wa-btn');

    if (nameEl) nameEl.textContent = order.customerName || 'Customer';
    if (phoneEl) phoneEl.textContent = order.customerPhone || 'No phone provided';
    if (callBtn) callBtn.href = order.customerPhone ? `tel:${order.customerPhone}` : '#';
    if (waBtn) {
      waBtn.onclick = () => openWhatsAppMessage(order);
    }

    // Notes
    const notesWrap = document.getElementById('drawer-notes-wrap');
    const notesText = document.getElementById('drawer-notes-text');
    if (notesWrap && notesText) {
      if (order.notes) {
        notesWrap.style.display = 'block';
        notesText.textContent = order.notes;
      } else {
        notesWrap.style.display = 'none';
      }
    }

    // Items receipt
    const itemsTbody = document.getElementById('drawer-items-tbody');
    const totalEl = document.getElementById('drawer-total-amount');

    if (itemsTbody) {
      itemsTbody.innerHTML = (order.items || []).map(item => `
        <tr>
          <td class="item-qty">${item.quantity}×</td>
          <td class="item-name">
            <div>${DukaanUI.escapeHtml(item.name)}</div>
            ${item.unit ? `<div class="item-unit">${DukaanUI.escapeHtml(item.unit)}</div>` : ''}
          </td>
          <td class="item-total">₹${Number(item.subtotal || item.price * item.quantity).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
    }

    if (totalEl) {
      totalEl.textContent = `₹${Number(order.estimatedTotal || 0).toLocaleString('en-IN')}`;
    }

    // Status Timeline
    const timelineContainer = document.getElementById('drawer-timeline-container');
    if (timelineContainer) {
      const history = order.statusHistory || [
        { status: 'Pending', at: order.createdAt }
      ];

      timelineContainer.innerHTML = history.map(entry => {
        const dateObj = new Date(entry.at);
        const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

        return `
          <div class="dl-timeline-step completed">
            <div class="dl-timeline-step-title">${entry.status}</div>
            <div class="dl-timeline-step-time">${dateStr}, ${timeStr}</div>
          </div>
        `;
      }).join('');
    }

    // Drawer Footer Actions
    const footerContainer = document.getElementById('drawer-footer-container');
    if (footerContainer) {
      const canCancel = ['Pending', 'Confirmed', 'Preparing'].includes(order.status);
      let primaryBtnHtml = '';

      if (cfg.nextStatus) {
        primaryBtnHtml = `
          <button type="button" class="btn btn-dl-primary flex-grow-1" id="drawer-btn-advance">
            <i class="bi ${cfg.nextIcon}"></i> ${cfg.nextAction}
          </button>
        `;
      }

      let cancelBtnHtml = '';
      if (canCancel) {
        cancelBtnHtml = `
          <button type="button" class="btn btn-outline-danger" id="drawer-btn-cancel">
            Cancel
          </button>
        `;
      }

      footerContainer.innerHTML = `
        ${cancelBtnHtml}
        ${primaryBtnHtml}
      `;

      const advanceBtn = document.getElementById('drawer-btn-advance');
      if (advanceBtn) {
        advanceBtn.addEventListener('click', () => {
          advanceOrderStatus(order.id, cfg.nextStatus);
        });
      }

      const cancelBtn = document.getElementById('drawer-btn-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          openCancelModal(order);
        });
      }
    }
  }

  /* --------------------------------------------------------------------------
     Cancel Order Confirmation Modal
     -------------------------------------------------------------------------- */
  function openCancelModal(order) {
    orderToCancelId = order.id;
    const modalEl = document.getElementById('dl-cancel-overlay');
    const orderSpan = document.getElementById('cancel-modal-order-id');

    if (orderSpan) orderSpan.textContent = `#${order.id}`;
    if (modalEl) modalEl.classList.add('active');
  }

  function closeCancelModal() {
    orderToCancelId = null;
    const modalEl = document.getElementById('dl-cancel-overlay');
    if (modalEl) modalEl.classList.remove('active');
  }

  function handleConfirmCancel() {
    if (!orderToCancelId) return;
    const id = orderToCancelId;
    closeCancelModal();

    const success = DukaanStorage.updateOrderStatus(id, 'Cancelled');
    if (success) {
      orders = DukaanStorage.getOrders();
      if (window.DukaanUI) {
        DukaanUI.showToast(`Order #${id} has been cancelled`, 'info');
      }
      renderAll();
      if (selectedOrderId === id) {
        const updated = orders.find(o => o.id === id);
        if (updated) renderDrawer(updated);
      }
    }
  }

  // Export / Run
  document.addEventListener('DOMContentLoaded', init);

})();
