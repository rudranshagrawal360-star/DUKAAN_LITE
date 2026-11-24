/**
 * ============================================================================
 * DukaanLite - Customer Catalog & Cart Drawer Logic (js/customer/catalog.js)
 * ============================================================================
 * Features:
 * 1. Product catalog rendering with flat vector SVG illustrations.
 * 2. Search, category rail filtering, and sorting (Relevance, Price, Name).
 * 3. Results count summary shown strictly when filtering or searching.
 * 4. Add-to-cart in-place morph into [ - 1 + ] stepper.
 * 5. Flying arc animation from card to cart and pop animation on badge.
 * 6. Sticky phone bottom bar sliding up when cart has items.
 * 7. Parchi slip styled cart drawer with line items, dashed tear lines, total.
 * 8. Order checkout: saves order as Pending with statusHistory and opens
 *    WhatsApp, followed by a Success Sheet with a "Track order" link.
 * 9. My Orders drawer showing previous browser orders.
 * ============================================================================
 */

// In-memory cart state: maps productId -> quantity
const cart = new Map();
let allProducts = [];
let activeCategory = 'ALL';
let searchQuery = '';
let currentSort = 'relevance';

/**
 * Populates header and shop strip text from store settings.
 */
function initStoreInfo() {
  const settings = DukaanStorage.getSettings();
  if (settings) {
    const heroTitle = document.getElementById('hero-shop-title');
    const heroHours = document.getElementById('hero-shop-hours');
    const cartParchiShop = document.getElementById('cart-parchi-shop');

    if (heroTitle) heroTitle.textContent = settings.shopName || "Sharma General Store";
    if (cartParchiShop) cartParchiShop.textContent = settings.shopName || "Sharma General Store";
    if (heroHours) {
      heroHours.innerHTML = `<i class="bi bi-clock me-1"></i>${DukaanUI.escapeHtml(settings.operatingHours || "Open 8:00 AM – 9:00 PM")}`;
    }
  }

  // Greeting for returning customer if name is stored
  const activeUser = DukaanStorage.getActiveUser();
  const welcomeText = document.getElementById('customer-welcome-text');
  if (welcomeText && activeUser && activeUser.role === 'customer' && activeUser.name) {
    welcomeText.textContent = `Hi, ${activeUser.name}`;
  }
}

/**
 * Returns total count of items in the cart.
 */
function getCartTotalCount() {
  let count = 0;
  cart.forEach((qty) => { count += qty; });
  return count;
}

/**
 * Returns total monetary value of items in the cart.
 */
function getCartEstimatedTotal() {
  let total = 0;
  cart.forEach((qty, pid) => {
    const product = allProducts.find(p => p.id === pid);
    if (product) {
      total += (product.price * qty);
    }
  });
  return total;
}

/**
 * Updates cart badges in header, drawer, and mobile bottom bar.
 */
function updateCartUI() {
  const totalCount = getCartTotalCount();
  const totalAmount = getCartEstimatedTotal();

  // Header badge
  const headerBadge = document.getElementById('header-cart-count');
  if (headerBadge) {
    headerBadge.textContent = totalCount;
  }

  // Drawer badge
  const drawerBadge = document.getElementById('drawer-item-count-badge');
  if (drawerBadge) {
    drawerBadge.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
  }

  // Drawer total
  const drawerTotal = document.getElementById('cart-drawer-total');
  if (drawerTotal) {
    drawerTotal.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
  }

  // Mobile Bottom Bar
  const mobileBar = document.getElementById('mobile-cart-bar');
  const mobileItems = document.getElementById('mobile-cart-items');
  const mobileTotal = document.getElementById('mobile-cart-total');

  if (mobileBar) {
    if (totalCount > 0) {
      mobileBar.style.display = 'flex';
      if (mobileItems) mobileItems.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
      if (mobileTotal) mobileTotal.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
    } else {
      mobileBar.style.display = 'none';
    }
  }
}

/**
 * Executes a smooth flying arc animation using the Web Animations API.
 */
function animateFlyToCart(sourceEl) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const cartBtn = document.getElementById('btn-open-cart-drawer');
  if (!cartBtn || !sourceEl) return;

  const startRect = sourceEl.getBoundingClientRect();
  const targetRect = cartBtn.getBoundingClientRect();

  const flyEl = document.createElement('div');
  flyEl.style.position = 'fixed';
  flyEl.style.zIndex = '1100';
  flyEl.style.width = '24px';
  flyEl.style.height = '24px';
  flyEl.style.borderRadius = '50%';
  flyEl.style.backgroundColor = 'var(--dl-primary)';
  flyEl.style.boxShadow = '0 4px 12px rgba(10, 125, 62, 0.4)';
  flyEl.style.pointerEvents = 'none';
  flyEl.style.left = `${startRect.left + startRect.width / 2 - 12}px`;
  flyEl.style.top = `${startRect.top + startRect.height / 2 - 12}px`;

  document.body.appendChild(flyEl);

  const deltaX = (targetRect.left + targetRect.width / 2) - (startRect.left + startRect.width / 2);
  const deltaY = (targetRect.top + targetRect.height / 2) - (startRect.top + startRect.height / 2);

  const anim = flyEl.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${deltaX * 0.4}px, ${deltaY * 0.2 - 50}px) scale(0.9)`, opacity: 0.95, offset: 0.45 },
    { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.3)`, opacity: 0.2 }
  ], {
    duration: 380,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
  });

  anim.onfinish = () => {
    flyEl.remove();
    // Pop the cart badge
    const badge = document.getElementById('header-cart-count');
    if (badge) {
      badge.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.4)' },
        { transform: 'scale(1)' }
      ], { duration: 250, easing: 'ease-out' });
    }
  };
}

/**
 * Filter and sort products according to activeCategory, searchQuery, and currentSort.
 */
function getFilteredAndSortedProducts() {
  let list = allProducts.slice();

  // Category filter
  if (activeCategory !== 'ALL') {
    list = list.filter(p => p.category.toLowerCase() === activeCategory.toLowerCase());
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.unit && p.unit.toLowerCase().includes(q))
    );
  }

  // Sorting
  if (currentSort === 'price-asc') {
    list.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-desc') {
    list.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'alpha-asc') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return list;
}

/**
 * Updates the filter summary label. Shown ONLY when filtering or searching.
 */
function updateResultsCountLabel(filteredCount) {
  const countLabel = document.getElementById('search-results-count');
  if (!countLabel) return;

  const isFiltering = activeCategory !== 'ALL';
  const isSearching = searchQuery.length > 0;

  if (isFiltering || isSearching) {
    countLabel.style.display = 'block';
    if (isSearching && isFiltering) {
      countLabel.textContent = `${filteredCount} item${filteredCount === 1 ? '' : 's'} matching "${searchQuery}" in ${activeCategory}`;
    } else if (isSearching) {
      countLabel.textContent = `${filteredCount} item${filteredCount === 1 ? '' : 's'} matching "${searchQuery}"`;
    } else {
      countLabel.textContent = `${filteredCount} item${filteredCount === 1 ? '' : 's'} in ${activeCategory}`;
    }
  } else {
    countLabel.style.display = 'none';
  }
}

/**
 * Generates the right-side action HTML for a product card:
 * either ADD button, Stepper [- 1 +], or Unavailable button.
 */
function renderCardActionHTML(productId, isAvailable) {
  if (!isAvailable) {
    return `
      <button type="button" class="btn btn-sm btn-secondary disabled" disabled style="min-height: 36px; font-size: 0.8rem; border-radius: var(--dl-radius-btn);">
        Unavailable
      </button>
    `;
  }

  const currentQty = cart.get(productId) || 0;

  if (currentQty === 0) {
    return `
      <button type="button" class="dl-btn-add btn-add-to-cart" data-product-id="${DukaanUI.escapeHtml(productId)}" aria-label="Add to cart">
        <span>+ ADD</span>
      </button>
    `;
  }

  return `
    <div class="dl-card-stepper-compact" role="group" aria-label="Adjust quantity">
      <button type="button" class="dl-stepper-btn-compact btn-stepper-dec" data-product-id="${DukaanUI.escapeHtml(productId)}" aria-label="Decrease quantity">
        &minus;
      </button>
      <span class="dl-stepper-qty-compact dl-tabular-nums" aria-live="polite">${currentQty}</span>
      <button type="button" class="dl-stepper-btn-compact btn-stepper-inc" data-product-id="${DukaanUI.escapeHtml(productId)}" aria-label="Increase quantity">
        &plus;
      </button>
    </div>
  `;
}

/**
 * Renders the product grid cards.
 */
function renderProductList() {
  const grid = document.getElementById('catalog-grid');
  const emptyState = document.getElementById('catalog-empty-state');
  if (!grid) return;

  const filtered = getFilteredAndSortedProducts();
  updateResultsCountLabel(filtered.length);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = `
        <div class="dl-parchi-card p-4 text-center my-4">
          <i class="bi bi-search text-dl-muted" style="font-size: 2rem;"></i>
          <h3 class="dl-heading mt-2 mb-1" style="font-size: 1.15rem;">No items found</h3>
          <p class="text-dl-muted small mb-3">Try searching with a different keyword or view all categories.</p>
          <button type="button" class="btn-dl-secondary btn-sm mx-auto" id="btn-clear-filters">
            Show all items
          </button>
        </div>
      `;
      const clearBtn = document.getElementById('btn-clear-filters');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          activeCategory = 'ALL';
          searchQuery = '';
          const searchInput = document.getElementById('catalog-search-input');
          if (searchInput) searchInput.value = '';
          document.querySelectorAll('.dl-category-pill').forEach(b => b.classList.toggle('active', b.getAttribute('data-category') === 'ALL'));
          renderProductList();
        });
      }
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  grid.classList.remove('dl-fade-in');
  void grid.offsetWidth;
  grid.classList.add('dl-fade-in');

  grid.innerHTML = filtered.map(product => {
    const isUnavailable = !product.available;
    const isLowStock = product.available && product.stockQuantity <= 5;
    const imgPath = product.image.startsWith('../') ? product.image : `../${product.image}`;

    // Badges: NO "In stock" badge! Only Low stock or Unavailable
    let badgeHTML = '';
    if (isUnavailable) {
      badgeHTML = `<span class="dl-badge dl-badge-out-stock" style="position: absolute; top: 0.5rem; left: 0.5rem; z-index: 2;">Unavailable</span>`;
    } else if (isLowStock) {
      badgeHTML = `<span class="dl-badge" style="position: absolute; top: 0.5rem; left: 0.5rem; z-index: 2; background-color: var(--dl-warning-bg); color: var(--dl-warning-text); border: 1px solid var(--dl-warning);">Low stock</span>`;
    }

    return `
      <article class="dl-product-card ${isUnavailable ? 'unavailable' : ''}" data-product-id="${DukaanUI.escapeHtml(product.id)}">
        <div class="dl-product-card-image-wrap">
          ${badgeHTML}
          <img src="${imgPath}" alt="${DukaanUI.escapeHtml(product.name)}" class="dl-product-svg-img" loading="lazy">
        </div>

        <div class="dl-product-card-body">
          <h3 class="dl-product-title" title="${DukaanUI.escapeHtml(product.name)}">
            ${DukaanUI.escapeHtml(product.name)}
          </h3>

          <div class="dl-product-unit text-dl-muted">
            ${DukaanUI.escapeHtml(product.unit || '')}
          </div>

          <div class="dl-product-bottom-row">
            <div class="dl-product-price-wrap">
              <span class="dl-product-price dl-tabular-nums">₹${product.price}</span>
            </div>
            <div class="dl-card-action-slot" data-slot-id="${DukaanUI.escapeHtml(product.id)}">
              ${renderCardActionHTML(product.id, product.available)}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  bindCardActionEvents(grid);
}

/**
 * Updates a single product card action slot without re-rendering the entire grid.
 */
function updateCardActionSlot(productId) {
  const slot = document.querySelector(`.dl-card-action-slot[data-slot-id="${productId}"]`);
  if (!slot) return;
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  slot.innerHTML = renderCardActionHTML(productId, product.available);
  bindCardActionEvents(slot);
}

/**
 * Attach click handlers for ADD and stepper buttons.
 */
function bindCardActionEvents(container) {
  // Add to cart buttons
  container.querySelectorAll('.btn-add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prodId = e.currentTarget.getAttribute('data-product-id');
      const card = e.currentTarget.closest('.dl-product-card');
      const imgWrap = card ? card.querySelector('.dl-product-card-image-wrap') : null;

      // Flying arc animation
      if (imgWrap) animateFlyToCart(imgWrap);

      cart.set(prodId, 1);
      updateCartUI();
      updateCardActionSlot(prodId);
      renderCartDrawerBody();
    });
  });

  // Stepper increment
  container.querySelectorAll('.btn-stepper-inc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prodId = e.currentTarget.getAttribute('data-product-id');
      const current = cart.get(prodId) || 0;
      cart.set(prodId, current + 1);
      updateCartUI();
      updateCardActionSlot(prodId);
      renderCartDrawerBody();
    });
  });

  // Stepper decrement
  container.querySelectorAll('.btn-stepper-dec').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prodId = e.currentTarget.getAttribute('data-product-id');
      const current = cart.get(prodId) || 0;
      if (current <= 1) {
        cart.delete(prodId);
      } else {
        cart.set(prodId, current - 1);
      }
      updateCartUI();
      updateCardActionSlot(prodId);
      renderCartDrawerBody();
    });
  });
}

/**
 * Renders the line items inside the parchi slip in the cart drawer.
 */
function renderCartDrawerBody() {
  const listEl = document.getElementById('cart-parchi-items-list');
  const checkoutBtn = document.getElementById('btn-checkout-whatsapp');
  if (!listEl) return;

  if (cart.size === 0) {
    listEl.innerHTML = `
      <div class="text-center py-4 text-dl-muted small">
        <i class="bi bi-cart3 d-block mb-1" style="font-size: 1.5rem;"></i>
        Your shopping list is empty.<br>Tap + ADD on items to build your list.
      </div>
    `;
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;

  let itemsHtml = '';
  cart.forEach((quantity, productId) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const subtotal = product.price * quantity;

    itemsHtml += `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-light">
        <div style="flex: 1; min-width: 0; padding-right: 0.5rem;">
          <div class="font-weight-medium" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${DukaanUI.escapeHtml(product.name)}
          </div>
          <div class="text-dl-muted small">
            ${DukaanUI.escapeHtml(product.unit || '')} &bull; ₹${product.price}
          </div>
        </div>

        <div class="d-flex align-items-center gap-2">
          <div class="dl-card-stepper-compact">
            <button type="button" class="dl-stepper-btn-compact btn-drawer-dec" data-product-id="${DukaanUI.escapeHtml(productId)}">&minus;</button>
            <span class="dl-stepper-qty-compact dl-tabular-nums">${quantity}</span>
            <button type="button" class="dl-stepper-btn-compact btn-drawer-inc" data-product-id="${DukaanUI.escapeHtml(productId)}">&plus;</button>
          </div>
          <span class="dl-tabular-nums font-weight-bold ms-2" style="min-width: 44px; text-align: right;">₹${subtotal}</span>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = itemsHtml;

  // Bind drawer stepper events
  listEl.querySelectorAll('.btn-drawer-inc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.getAttribute('data-product-id');
      const current = cart.get(pid) || 0;
      cart.set(pid, current + 1);
      updateCartUI();
      updateCardActionSlot(pid);
      renderCartDrawerBody();
    });
  });

  listEl.querySelectorAll('.btn-drawer-dec').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pid = e.currentTarget.getAttribute('data-product-id');
      const current = cart.get(pid) || 0;
      if (current <= 1) {
        cart.delete(pid);
      } else {
        cart.set(pid, current - 1);
      }
      updateCartUI();
      updateCardActionSlot(pid);
      renderCartDrawerBody();
    });
  });
}

/**
 * Formats WhatsApp message and triggers the WhatsApp checkout flow.
 */
function handleWhatsAppCheckout() {
  if (cart.size === 0) {
    DukaanUI.showToast('Your shopping list is empty.', 'warning');
    return;
  }

  const settings = DukaanStorage.getSettings();
  const activeUser = DukaanStorage.getActiveUser() || { name: 'Customer', phone: '' };
  const rawStorePhone = (settings.whatsappNumber || '919800000000').replace(/\D/g, '');
  const deliveryNotes = (document.getElementById('drawer-notes-input') || {}).value || '';

  const orderItems = [];
  let totalSum = 0;

  cart.forEach((qty, pid) => {
    const p = allProducts.find(item => item.id === pid);
    if (p) {
      const lineSubtotal = p.price * qty;
      totalSum += lineSubtotal;
      orderItems.push({
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price,
        quantity: qty,
        subtotal: lineSubtotal
      });
    }
  });

  const orderId = `ORD-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();

  // Clean structured WhatsApp message
  let message = `*Order from ${settings.shopName || 'Store'}*\n`;
  message += `--------------------------\n`;
  orderItems.forEach(i => {
    message += `• ${i.quantity} x ${i.name} (${i.unit || ''}) - ₹${i.subtotal}\n`;
  });
  message += `--------------------------\n`;
  message += `*Estimated Total:* ₹${totalSum}\n`;
  message += `*Customer:* ${activeUser.name || 'Customer'}${activeUser.phone ? ` (+91 ${activeUser.phone})` : ''}\n`;
  if (deliveryNotes.trim()) {
    message += `*Note:* ${deliveryNotes.trim()}\n`;
  }
  message += `--------------------------\n`;
  message += `Order ID: #${orderId}`;

  // Save order to central storage as Pending
  const newOrder = {
    id: orderId,
    createdAt: now,
    customerName: activeUser.name || 'Customer',
    customerPhone: activeUser.phone || '',
    items: orderItems,
    estimatedTotal: totalSum,
    status: 'Pending',
    statusHistory: [
      { status: 'Pending', at: now }
    ],
    notes: deliveryNotes.trim()
  };

  DukaanStorage.addOrder(newOrder);

  // Close Cart drawer
  closeCartDrawer();

  // Open WhatsApp in new window
  const waUrl = `https://wa.me/${rawStorePhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  // Display Success Bottom Sheet
  showOrderSuccessSheet(newOrder);

  // Reset cart
  cart.clear();
  updateCartUI();
  allProducts.forEach(p => updateCardActionSlot(p.id));
  renderCartDrawerBody();
}

/**
 * Displays the Success Sheet with order summary and "Track order" link.
 */
function showOrderSuccessSheet(order) {
  const backdrop = document.getElementById('order-success-modal-backdrop');
  const sheet = document.getElementById('order-success-sheet');
  if (!sheet || !backdrop) return;

  document.getElementById('success-sheet-order-id').textContent = '#' + order.id;
  document.getElementById('success-sheet-items-count').textContent = `${(order.items || []).length} items`;
  document.getElementById('success-sheet-total').textContent = `₹${order.estimatedTotal}`;

  const trackBtn = document.getElementById('btn-success-track-order');
  if (trackBtn) {
    trackBtn.href = `track.html?id=${encodeURIComponent(order.id)}`;
  }

  backdrop.style.display = 'block';
  sheet.style.display = 'block';

  const closeBtn = document.getElementById('btn-success-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      backdrop.style.display = 'none';
      sheet.style.display = 'none';
    };
  }
}

/**
 * Opens and closes the Slide-In Cart Drawer.
 */
function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.add('open');
    backdrop.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    renderCartDrawerBody();
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('open');
    backdrop.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Initializes My Orders Drawer.
 */
function initMyOrdersDrawer() {
  const drawer = document.getElementById('my-orders-drawer');
  const backdrop = document.getElementById('my-orders-backdrop');
  const listEl = document.getElementById('my-orders-list');
  const openBtn = document.getElementById('btn-header-my-orders');
  const closeBtn = document.getElementById('btn-close-my-orders');

  function open() {
    const orders = DukaanStorage.getMyOrders();
    if (!orders.length) {
      listEl.innerHTML = `
        <div class="text-center py-4 text-dl-muted small">
          <i class="bi bi-clock-history d-block mb-1" style="font-size: 1.5rem;"></i>
          No orders placed yet in this browser.
        </div>
      `;
    } else {
      listEl.innerHTML = orders.map(o => `
        <div class="dl-parchi-card p-3 mb-2" style="font-size: 0.85rem;">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong>#${DukaanUI.escapeHtml(o.id)}</strong>
            <span class="dl-status-badge status-${o.status.toLowerCase()}">${DukaanUI.escapeHtml(o.status)}</span>
          </div>
          <div class="text-dl-muted small mb-2">
            ${new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} &bull; ${(o.items || []).length} items &bull; <strong class="dl-tabular-nums">₹${o.estimatedTotal}</strong>
          </div>
          <a href="track.html?id=${encodeURIComponent(o.id)}" class="btn-dl-secondary w-100 text-center py-1" style="font-size: 0.82rem; min-height: 32px; display: block; text-decoration: none;">
            Track this order &rarr;
          </a>
        </div>
      `).join('');
    }
    drawer.classList.add('open');
    backdrop.classList.add('active');
  }

  function close() {
    drawer.classList.remove('open');
    backdrop.classList.remove('active');
  }

  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
}

/**
 * Master initialization function called on DOMContentLoaded.
 */
function initCatalog() {
  initStoreInfo();

  // Load products from Storage Layer
  allProducts = DukaanStorage.getProducts();

  // Render products
  renderProductList();
  updateCartUI();

  // Wire search input
  const searchInput = document.getElementById('catalog-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderProductList();
    });
  }

  // Wire sort select
  const sortSelect = document.getElementById('catalog-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProductList();
    });
  }

  // Wire Category Rail pills
  document.querySelectorAll('.dl-category-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.dl-category-pill').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeCategory = e.currentTarget.getAttribute('data-category');
      renderProductList();
    });
  });

  // Wire Cart Drawer open/close
  const openCartBtn = document.getElementById('btn-open-cart-drawer');
  const closeCartBtn = document.getElementById('btn-close-cart-drawer');
  const cartBackdrop = document.getElementById('cart-drawer-backdrop');
  const mobileViewCartBtn = document.getElementById('btn-mobile-view-cart');

  if (openCartBtn) openCartBtn.addEventListener('click', openCartDrawer);
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCartDrawer);
  if (mobileViewCartBtn) mobileViewCartBtn.addEventListener('click', openCartDrawer);

  // Wire WhatsApp checkout
  const checkoutBtn = document.getElementById('btn-checkout-whatsapp');
  if (checkoutBtn) checkoutBtn.addEventListener('click', handleWhatsAppCheckout);

  // Wire My Orders drawer
  initMyOrdersDrawer();
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.DukaanTheme) DukaanTheme.init();
  initCatalog();
});
