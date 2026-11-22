/**
 * ============================================================================
 * DukaanLite - Customer Catalog Logic (js/customer/catalog.js)
 * ============================================================================
 * Handles rendering the customer-facing digital product catalog.
 * 
 * Responsibilities in Phase 1:
 * 1. Read store settings from storage and populate the shop header.
 * 2. Display a customer greeting if credentials were provided at login.
 * 3. Render loading skeletons while products are retrieved.
 * 4. Render product cards with names, categories, units, prices, and text-based
 *    availability badges.
 * 5. Handle fallback placeholder emojis if local product image files are missing.
 * 6. Provide robust empty and error state handling.
 * ============================================================================
 */

// Mapping of grocery categories to fallback emojis when local images are absent
const CATEGORY_EMOJI_MAP = {
  "Dairy & Breakfast": "🥛",
  "Staples & Grains": "🌾",
  "Snacks & Biscuits": "🍪",
  "Beverages": "☕",
  "Personal & Home Care": "🧼",
  "Fruits & Vegetables": "🍎",
  "Default": "🛒"
};

/**
 * Returns the best fallback emoji for a given product category.
 * @param {string} category - Category name
 * @returns {string} Emoji character
 */
function getCategoryEmoji(category) {
  return CATEGORY_EMOJI_MAP[category] || CATEGORY_EMOJI_MAP["Default"];
}

/**
 * Initializes and populates the shop header using saved store settings.
 */
function initShopHeader() {
  const settings = DukaanStorage.getSettings();
  if (!settings) return;

  const nameEl = document.getElementById('shop-name-display');
  const taglineEl = document.getElementById('shop-tagline-display');
  const hoursEl = document.getElementById('shop-hours-display');

  if (nameEl && settings.shopName) {
    nameEl.textContent = settings.shopName;
  }
  if (taglineEl && settings.tagline) {
    taglineEl.textContent = settings.tagline;
  }
  if (hoursEl && settings.operatingHours) {
    hoursEl.textContent = settings.operatingHours;
  }

  // Display greeting if a customer logged in with their name
  const activeUser = DukaanStorage.getActiveUser();
  const greetingEl = document.getElementById('customer-greeting-pill');
  if (greetingEl && activeUser && activeUser.role === 'customer' && activeUser.name) {
    greetingEl.innerHTML = `👋 <strong>Hi, ${DukaanUI.escapeHtml(activeUser.name)}</strong>`;
    greetingEl.classList.remove('d-none');
  }
}

/**
 * Renders animated shimmer skeleton placeholder cards into the container.
 * @param {HTMLElement} container - DOM container element
 * @param {number} count - Number of skeleton cards to render
 */
function renderSkeletons(container, count = 8) {
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.innerHTML = `
      <div class="skeleton-box skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-box skeleton-line title"></div>
        <div class="skeleton-box skeleton-line sub"></div>
        <div class="skeleton-box skeleton-line price"></div>
        <div class="skeleton-box skeleton-line btn"></div>
      </div>
    `;
    container.appendChild(card);
  }
}

/**
 * Generates an HTML card string for a single product record.
 * @param {Object} product - Product record
 * @param {number} index - Index in the list for animation staggering
 * @returns {string} HTML string
 */
function createProductCardHTML(product, index) {
  const isAvailable = product.available === true;
  const emoji = getCategoryEmoji(product.category);
  const staggerDelay = Math.min(index * 35, 400); // Max delay cap for smooth entry

  // Availability badge markup: explicitly uses TEXT, never color alone (WCAG AA requirement)
  const stockBadgeHTML = isAvailable
    ? `<span class="badge-stock in-stock" aria-label="Status: In Stock">✓ In Stock</span>`
    : `<span class="badge-stock out-of-stock" aria-label="Status: Currently unavailable">✕ Unavailable</span>`;

  // Action button: disabled if product is unavailable
  const buttonHTML = isAvailable
    ? `<button type="button" class="btn-dukaan-primary add-to-list-btn" data-product-id="${DukaanUI.escapeHtml(product.id)}" aria-label="Add ${DukaanUI.escapeHtml(product.name)} to shopping list">
         <span aria-hidden="true">+</span> Add to List
       </button>`
    : `<button type="button" class="btn-dukaan-primary" disabled aria-disabled="true" aria-label="${DukaanUI.escapeHtml(product.name)} is currently unavailable">
         Unavailable
       </button>`;

  // Image block with onError fallback to category emoji
  const imageHTML = `
    <div class="product-image-wrap">
      <span class="badge-category" title="${DukaanUI.escapeHtml(product.category)}">
        ${DukaanUI.escapeHtml(product.category)}
      </span>
      <img src="../${DukaanUI.escapeHtml(product.image)}" 
           alt="${DukaanUI.escapeHtml(product.name)}" 
           class="product-img"
           loading="lazy"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div class="product-emoji-fallback" style="display: none;" aria-hidden="true">
        ${emoji}
      </div>
    </div>
  `;

  return `
    <article class="product-card animate-fade-up" style="animation-delay: ${staggerDelay}ms;" data-id="${DukaanUI.escapeHtml(product.id)}">
      ${imageHTML}
      <div class="product-card-body">
        <h3 class="product-title" title="${DukaanUI.escapeHtml(product.name)}">
          ${DukaanUI.escapeHtml(product.name)}
        </h3>
        <div class="product-unit">
          ${DukaanUI.escapeHtml(product.unit || 'Standard Pack')}
        </div>

        <div class="product-meta-row">
          <div class="product-price-row">
            <div class="product-price-box">
              <span class="product-price">₹${Number(product.price).toLocaleString('en-IN')}</span>
            </div>
            ${stockBadgeHTML}
          </div>
          ${buttonHTML}
        </div>
      </div>
    </article>
  `;
}

/**
 * Loads products from storage and populates the catalog grid.
 */
function loadAndRenderCatalog() {
  const container = document.getElementById('catalog-products-container');
  const errorContainer = document.getElementById('catalog-error-container');
  const countSummary = document.getElementById('product-count-summary');
  const announcer = document.getElementById('catalog-status-announcer');

  if (!container) return;

  // 1. Render initial skeleton placeholders
  renderSkeletons(container, 8);

  // Short timeout simulates non-blocking load and lets user observe smooth transition
  setTimeout(() => {
    try {
      const products = DukaanStorage.getProducts();

      // Handle Empty State
      if (!products || products.length === 0) {
        container.innerHTML = '';
        if (countSummary) countSummary.textContent = '0 items found';
        DukaanUI.renderEmptyState(
          container,
          "No products found. Try resetting demo data.",
          "Reset Sample Products",
          () => {
            DukaanStorage.resetDemoData();
            loadAndRenderCatalog();
          }
        );
        if (announcer) announcer.textContent = "No products found in catalog.";
        return;
      }

      // Render product cards
      const cardsHtml = products.map((prod, idx) => createProductCardHTML(prod, idx)).join('');
      container.innerHTML = cardsHtml;

      // Update count summaries
      const availableCount = products.filter(p => p.available).length;
      if (countSummary) {
        countSummary.textContent = `Showing all ${products.length} products (${availableCount} available today)`;
      }
      if (announcer) {
        announcer.textContent = `Catalog loaded with ${products.length} products.`;
      }

      // Bind click listeners for "Add to List" buttons
      // (In Phase 1, cart logic is out of scope, but clicking provides friendly user feedback)
      const addBtns = container.querySelectorAll('.add-to-list-btn');
      addBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const prodId = e.currentTarget.getAttribute('data-product-id');
          const product = products.find(p => p.id === prodId);
          const prodName = product ? product.name : 'Item';
          DukaanUI.showToast(`"${prodName}" preview selected. (Shopping Cart arrives in Phase 2)`, 'info');
        });
      });

    } catch (err) {
      console.error("[Catalog] Error loading products:", err);
      container.innerHTML = '';
      if (errorContainer) {
        errorContainer.classList.remove('d-none');
        errorContainer.innerHTML = `
          <div class="alert alert-danger text-center p-4" style="border-radius: var(--radius-md);" role="alert">
            <h4 class="alert-heading font-heading mb-2">We couldn't load the catalog</h4>
            <p class="mb-3">There was an issue reading product data from your browser storage.</p>
            <button type="button" class="btn btn-outline-danger" id="btn-recovery-reset">
              Reset Demo Data &amp; Reload
            </button>
          </div>
        `;
        document.getElementById('btn-recovery-reset').addEventListener('click', () => {
          DukaanStorage.resetDemoData();
          window.location.reload();
        });
      }
      if (announcer) {
        announcer.textContent = "Error: Could not load the catalog.";
      }
    }
  }, 250);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initShopHeader();
  loadAndRenderCatalog();
});
