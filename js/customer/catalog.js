/**
 * ============================================================================
 * DukaanLite - Customer Catalog & Cart Drawer Logic (js/customer/catalog.js)
 * ============================================================================
 * Handles:
 * 1. Product catalog rendering, search, and category filtering.
 * 2. Cart state, dynamic stepper transformations on cards.
 * 3. Flying arc animation from product card to header cart icon.
 * 4. Slide-in Cart Drawer with live subtotals, quantity adjustments,
 *    and structured WhatsApp order formatting.
 * ============================================================================
 */

// Category fallback emojis
const CATEGORY_EMOJIS = {
  "Dairy & Breakfast": "🥛",
  "Staples & Grains": "🌾",
  "Spices & Masalas": "🌶️",
  "Snacks & Biscuits": "🍪",
  "Beverages": "☕",
  "Personal & Home Care": "🧼",
  "Fresh Fruits": "🥭",
  "Default": "🛒"
};

// In-memory cart state: maps productId -> quantity
const cart = new Map();
let allProducts = [];
let activeCategory = 'ALL';
let searchQuery = '';

/**
 * Returns category emoji for image fallbacks.
 */
function getCategoryEmoji(category) {
  return CATEGORY_EMOJIS[category] || CATEGORY_EMOJIS["Default"];
}

/**
 * Populates header and hero text from store settings.
 */
function initStoreInfo() {
  const settings = DukaanStorage.getSettings();
  if (settings) {
    const hName = document.getElementById('header-shop-name');
    const heroTitle = document.getElementById('hero-shop-title');
    const heroTagline = document.getElementById('hero-shop-tagline');
    const heroHours = document.getElementById('hero-shop-hours');

    if (hName) hName.textContent = settings.shopName || "Sharma General Store";
    if (heroTitle) heroTitle.textContent = settings.shopName || "Sharma General Store";
    if (heroTagline) heroTagline.textContent = settings.tagline || "Fresh groceries & daily essentials at fair neighborhood prices";
    if (heroHours) heroHours.textContent = settings.operatingHours || "Open 8 am to 9 pm";
  }

  // Greeting for returning demo customer
  const activeUser = DukaanStorage.getActiveUser();
  const welcomeText = document.getElementById('customer-welcome-text');
  if (welcomeText && activeUser && activeUser.role === 'customer' && activeUser.name) {
    welcomeText.textContent = `👋 Hi, ${activeUser.name}`;
  }
}

/**
 * Renders shimmer skeleton placeholder cards while loading.
 */
function renderSkeletons(container, count = 8) {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'dl-skeleton-card';
    el.innerHTML = `
      <div class="skeleton-box dl-skeleton-img"></div>
      <div class="dl-skeleton-body">
        <div class="skeleton-box" style="height: 14px; width: 45%; border-radius: 4px;"></div>
        <div class="skeleton-box" style="height: 18px; width: 80%; border-radius: 4px;"></div>
        <div class="skeleton-box" style="height: 14px; width: 40%; border-radius: 4px;"></div>
        <div class="skeleton-box" style="height: 22px; width: 35%; margin-top: auto; border-radius: 4px;"></div>
        <div class="skeleton-box" style="height: 40px; width: 100%; border-radius: 8px; margin-top: 6px;"></div>
      </div>
    `;
    container.appendChild(el);
  }
}

/**
 * Updates cart badge counts and triggers pop animation.
 */
function updateCartBadges() {
  let totalCount = 0;
  for (const qty of cart.values()) {
    totalCount += qty;
  }

  const badge = document.getElementById('header-cart-count');
  const drawerBadge = document.getElementById('drawer-item-count-badge');

  if (badge) {
    badge.textContent = totalCount;
    badge.classList.remove('pop');
    void badge.offsetWidth; // Trigger reflow
    badge.classList.add('pop');
  }

  if (drawerBadge) {
    drawerBadge.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
  }
}

/**
 * Executes a smooth flying arc animation using the Web Animations API.
 * Arc flies from the clicked card's image to the header cart button.
 */
function animateFlyToCart(sourceEl) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const cartBtn = document.getElementById('btn-open-cart-drawer');
  if (!cartBtn || !sourceEl) return;

  const startRect = sourceEl.getBoundingClientRect();
  const targetRect = cartBtn.getBoundingClientRect();

  const flyEl = document.createElement('div');
  flyEl.className = 'dl-flying-crumb';
  flyEl.innerHTML = '🛒';
  flyEl.style.left = `${startRect.left + startRect.width / 2 - 22}px`;
  flyEl.style.top = `${startRect.top + startRect.height / 2 - 22}px`;
  document.body.appendChild(flyEl);

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  // Web Animations API
  const animation = flyEl.animate([
    {
      transform: 'translate(0, 0) scale(1)',
      opacity: 1
    },
    {
      transform: `translate(${(targetX - startX) * 0.5}px, ${(targetY - startY) * 0.3 - 60}px) scale(0.85)`,
      opacity: 0.9,
      offset: 0.5
    },
    {
      transform: `translate(${targetX - startX}px, ${targetY - startY}px) scale(0.25)`,
      opacity: 0.2
    }
  ], {
    duration: 550,
    easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
    fill: 'forwards'
  });

  animation.onfinish = () => {
    flyEl.remove();
    cartBtn.classList.remove('bounce');
    void cartBtn.offsetWidth;
    cartBtn.classList.add('bounce');
  };
}

/**
 * Generates card action HTML: either "+ Add to List" or "- qty +" stepper.
 */
function renderCardActionHTML(productId, isAvailable) {
  if (!isAvailable) {
    return `
      <button type="button" class="btn-dl-primary" disabled aria-disabled="true">
        Unavailable
      </button>
    `;
  }

  const qty = cart.get(productId) || 0;
  if (qty > 0) {
    return `
      <div class="dl-card-stepper" data-product-id="${productId}">
        <button type="button" class="dl-stepper-btn btn-stepper-dec" aria-label="Decrease quantity">&minus;</button>
        <span class="dl-stepper-qty" aria-live="polite">${qty}</span>
        <button type="button" class="dl-stepper-btn btn-stepper-inc" aria-label="Increase quantity">&plus;</button>
      </div>
    `;
  }

  return `
    <button type="button" class="btn-dl-primary btn-add-to-cart" data-product-id="${productId}">
      <span aria-hidden="true">+</span> Add to List
    </button>
  `;
}

/**
 * Builds HTML for an individual product card.
 */
function buildProductCardHTML(product, index) {
  const isAvailable = product.available === true;
  const emoji = getCategoryEmoji(product.category);
  const staggerDelay = Math.min(index * 30, 360);

  const stockBadge = isAvailable
    ? `<span class="dl-badge dl-badge-in-stock">✓ In Stock</span>`
    : `<span class="dl-badge dl-badge-out-stock">✕ Unavailable</span>`;

  return `
    <article class="dl-product-card animate-fade-up" style="animation-delay: ${staggerDelay}ms;" data-id="${DukaanUI.escapeHtml(product.id)}">
      <div class="dl-product-card-image-wrap">
        <span class="dl-card-category-label">${DukaanUI.escapeHtml(product.category)}</span>
        <img src="../${DukaanUI.escapeHtml(product.image)}" 
             alt="${DukaanUI.escapeHtml(product.name)}" 
             class="dl-product-img" 
             loading="lazy"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <div class="dl-product-emoji-fallback" style="display: none;" aria-hidden="true">${emoji}</div>
      </div>
      <div class="dl-product-card-body">
        <h3 class="dl-product-title" title="${DukaanUI.escapeHtml(product.name)}">
          ${DukaanUI.escapeHtml(product.name)}
        </h3>
        <div class="dl-product-unit">${DukaanUI.escapeHtml(product.unit || 'Standard Pack')}</div>

        <div class="dl-product-meta-row">
          <div class="dl-product-price-row">
            <span class="dl-product-price">₹${Number(product.price).toLocaleString('en-IN')}</span>
            ${stockBadge}
          </div>
          <div class="dl-card-actions" id="action-slot-${product.id}">
            ${renderCardActionHTML(product.id, isAvailable)}
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Renders filtered products into the main grid.
 */
function renderProductList() {
  const container = document.getElementById('catalog-grid');
  const emptyState = document.getElementById('catalog-empty-state');
  const countLabel = document.getElementById('catalog-count-label');

  if (!container) return;

  const filtered = allProducts.filter(p => {
    const matchesCat = activeCategory === 'ALL' || p.category === activeCategory;
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery) || 
      p.category.toLowerCase().includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'block';
      DukaanUI.renderEmptyState(
        emptyState,
        `No items found matching "${searchQuery || activeCategory}". Try searching for another item or clear your filters.`,
        "Clear Filters",
        () => {
          document.getElementById('catalog-search-input').value = '';
          searchQuery = '';
          setActiveCategory('ALL');
        }
      );
    }
    if (countLabel) countLabel.textContent = '0 items found';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const html = filtered.map((p, idx) => buildProductCardHTML(p, idx)).join('');
  container.innerHTML = html;

  const inStockCount = filtered.filter(p => p.available).length;
  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} products (${inStockCount} available)`;
  }

  bindCardActionEvents(container);
}

/**
 * Binds click events for "Add to List" and card steppers.
 */
function bindCardActionEvents(container) {
  // Add to List buttons
  container.querySelectorAll('.btn-add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const prodId = e.currentTarget.getAttribute('data-product-id');
      const card = e.currentTarget.closest('.dl-product-card');
      const imgWrap = card ? card.querySelector('.dl-product-card-image-wrap') : null;

      // Animate flying arc
      if (imgWrap) animateFlyToCart(imgWrap);

      // Increase quantity
      cart.set(prodId, 1);
      updateCartBadges();
      updateCardActionSlot(prodId);
      renderCartDrawerBody();
    });
  });

  // Stepper buttons
  container.querySelectorAll('.btn-stepper-inc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const stepper = e.currentTarget.closest('.dl-card-stepper');
      const prodId = stepper.getAttribute('data-product-id');
      const cur = cart.get(prodId) || 0;
      cart.set(prodId, cur + 1);
      updateCartBadges();
      updateCardActionSlot(prodId);
      renderCartDrawerBody();
    });
  });

  container.querySelectorAll('.btn-stepper-dec').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const stepper = e.currentTarget.closest('.dl-card-stepper');
      const prodId = stepper.getAttribute('data-product-id');
      const cur = cart.get(prodId) || 0;
      if (cur <= 1) {
        cart.delete(prodId);
      } else {
        cart.set(prodId, cur - 1);
      }
      updateCartBadges();
      updateCardActionSlot(prodId);
      renderCartDrawerBody();
    });
  });
}

/**
 * Refreshes an individual product card's action slot without re-rendering the whole grid.
 */
function updateCardActionSlot(productId) {
  const slot = document.getElementById(`action-slot-${productId}`);
  if (!slot) return;

  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  slot.innerHTML = renderCardActionHTML(productId, product.available);

  // Rebind events for that specific card slot
  const newAddBtn = slot.querySelector('.btn-add-to-cart');
  if (newAddBtn) {
    newAddBtn.addEventListener('click', () => {
      const card = slot.closest('.dl-product-card');
      const imgWrap = card ? card.querySelector('.dl-product-card-image-wrap') : null;
      if (imgWrap) animateFlyToCart(imgWrap);
      cart.set(productId, 1);
      updateCartBadges();
      updateCardActionSlot(productId);
      renderCartDrawerBody();
    });
  }

  const incBtn = slot.querySelector('.btn-stepper-inc');
  if (incBtn) {
    incBtn.addEventListener('click', () => {
      const cur = cart.get(productId) || 0;
      cart.set(productId, cur + 1);
      updateCartBadges();
      updateCardActionSlot(productId);
      renderCartDrawerBody();
    });
  }

  const decBtn = slot.querySelector('.btn-stepper-dec');
  if (decBtn) {
    decBtn.addEventListener('click', () => {
      const cur = cart.get(productId) || 0;
      if (cur <= 1) {
        cart.delete(productId);
      } else {
        cart.set(productId, cur - 1);
      }
      updateCartBadges();
      updateCardActionSlot(productId);
      renderCartDrawerBody();
    });
  }
}

/**
 * Sets active category filter pill.
 */
function setActiveCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.dl-category-pill').forEach(btn => {
    if (btn.getAttribute('data-category') === cat) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderProductList();
}

/**
 * Renders the contents of the slide-in cart drawer.
 */
function renderCartDrawerBody() {
  const body = document.getElementById('cart-drawer-body');
  const totalDisplay = document.getElementById('cart-drawer-total');
  const checkoutBtn = document.getElementById('btn-checkout-whatsapp');

  if (!body) return;

  if (cart.size === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.75rem;" aria-hidden="true">🛒</div>
        <h4 style="font-weight: 600; margin-bottom: 0.35rem; color: var(--dl-ink);">Your cart is empty</h4>
        <p class="text-dl-muted small">Add fresh groceries from the catalog to prepare your WhatsApp order.</p>
      </div>
    `;
    if (totalDisplay) totalDisplay.textContent = '₹0';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  let totalAmount = 0;
  let itemsHTML = '';

  for (const [prodId, qty] of cart.entries()) {
    const product = allProducts.find(p => p.id === prodId);
    if (!product) continue;

    const lineTotal = product.price * qty;
    totalAmount += lineTotal;
    const emoji = getCategoryEmoji(product.category);

    itemsHTML += `
      <div class="dl-cart-item" data-id="${product.id}">
        <div style="font-size: 1.75rem; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #F6F8F6; border-radius: 8px;">
          ${emoji}
        </div>
        <div class="dl-cart-item-info">
          <div class="dl-cart-item-title" title="${DukaanUI.escapeHtml(product.name)}">
            ${DukaanUI.escapeHtml(product.name)}
          </div>
          <div class="dl-cart-item-sub">
            ₹${product.price} / ${DukaanUI.escapeHtml(product.unit)} &bull; <strong>₹${lineTotal}</strong>
          </div>
        </div>
        <div class="dl-cart-item-stepper">
          <button type="button" class="dl-drawer-stepper-btn btn-drawer-dec" data-id="${product.id}" aria-label="Decrease quantity">&minus;</button>
          <span class="dl-drawer-stepper-qty">${qty}</span>
          <button type="button" class="dl-drawer-stepper-btn btn-drawer-inc" data-id="${product.id}" aria-label="Increase quantity">&plus;</button>
        </div>
      </div>
    `;
  }

  body.innerHTML = itemsHTML;
  if (totalDisplay) totalDisplay.textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
  if (checkoutBtn) checkoutBtn.disabled = false;

  // Drawer stepper listeners
  body.querySelectorAll('.btn-drawer-inc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const cur = cart.get(id) || 0;
      cart.set(id, cur + 1);
      updateCartBadges();
      updateCardActionSlot(id);
      renderCartDrawerBody();
    });
  });

  body.querySelectorAll('.btn-drawer-dec').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const cur = cart.get(id) || 0;
      if (cur <= 1) {
        cart.delete(id);
      } else {
        cart.set(id, cur - 1);
      }
      updateCartBadges();
      updateCardActionSlot(id);
      renderCartDrawerBody();
    });
  });
}

/**
 * Initializes drawer opening and closing behavior.
 */
function initCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const backdrop = document.getElementById('cart-drawer-backdrop');
  const openBtn = document.getElementById('btn-open-cart-drawer');
  const closeBtn = document.getElementById('btn-close-cart-drawer');

  function openDrawer() {
    renderCartDrawerBody();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('open');
    openBtn.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('open');
    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.focus();
  }

  if (openBtn) openBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // Close on ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });

  // WhatsApp Order Handoff
  const checkoutBtn = document.getElementById('btn-checkout-whatsapp');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (cart.size === 0) return;

      const settings = DukaanStorage.getSettings();
      const activeUser = DukaanStorage.getActiveUser() || { name: 'Customer', phone: '' };
      const notes = (document.getElementById('drawer-notes-input').value || '').trim();

      const itemsSnapshot = [];
      let grandTotal = 0;

      for (const [prodId, qty] of cart.entries()) {
        const prod = allProducts.find(p => p.id === prodId);
        if (prod) {
          const subtotal = prod.price * qty;
          grandTotal += subtotal;
          itemsSnapshot.push({
            name: prod.name,
            unit: prod.unit,
            price: prod.price,
            quantity: qty,
            subtotal: subtotal
          });
        }
      }

      // Record order snapshot in local storage so shopkeeper can view it
      const newOrder = {
        id: `ORD-${Date.now().toString().slice(-4)}`,
        customerName: activeUser.name || 'Customer',
        customerPhone: activeUser.phone || '',
        items: itemsSnapshot,
        estimatedTotal: grandTotal,
        status: 'Pending',
        notes: notes
      };
      DukaanStorage.addOrder(newOrder);

      // Build structured WhatsApp message
      let msg = `*New Order - DukaanLite*\n`;
      msg += `Store: ${settings.shopName || 'Sharma General Store'}\n`;
      msg += `Customer: ${activeUser.name || 'Customer'}\n`;
      if (activeUser.phone) msg += `Phone: +91 ${activeUser.phone}\n`;
      msg += `--------------------------\n`;
      itemsSnapshot.forEach(item => {
        msg += `• ${item.quantity}x ${item.name} (${item.unit}) - ₹${item.subtotal}\n`;
      });
      msg += `--------------------------\n`;
      msg += `*Estimated Total: ₹${grandTotal}*\n`;
      if (notes) msg += `Note: ${notes}\n`;
      msg += `\n_Generated via DukaanLite_`;

      const targetPhone = settings.whatsappNumber || '919876543210';
      const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;

      DukaanUI.showToast('Preparing WhatsApp order...', 'success');
      setTimeout(() => {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }, 350);
    });
  }
}

/**
 * Initializes catalog page events.
 */
function initCatalog() {
  const container = document.getElementById('catalog-grid');
  renderSkeletons(container, 8);

  initStoreInfo();
  initCartDrawer();

  setTimeout(() => {
    allProducts = DukaanStorage.getProducts();
    renderProductList();

    // Category pills click
    document.querySelectorAll('.dl-category-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-category');
        setActiveCategory(cat);
      });
    });

    // Real-time search
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderProductList();
      });
    }
  }, 220);
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.DukaanTheme) DukaanTheme.init();
  initCatalog();
});
