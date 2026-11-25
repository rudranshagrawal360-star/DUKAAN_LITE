/**
 * ============================================================================
 * DukaanLite - Product Catalog Management (js/shopkeeper/products.js)
 * ============================================================================
 * Handles full CRUD operations for shopkeeper inventory:
 * 1. Product list rendering (responsive desktop table + mobile cards)
 * 2. Search, category filter, stock status filter, and sorting
 * 3. Add new product with validation & SVG icon picker
 * 4. Edit existing product details (price, stock, unit, status)
 * 5. Delete product with confirmation modal
 * 6. Quick inline availability toggle
 * 7. CSV Export for offline records
 * 8. Real-time cross-tab synchronization via DukaanLive
 * ============================================================================
 */

(function () {
  'use strict';

  let products = [];
  let editingProductId = null;
  let deletingProductId = null;

  // Filter & Search states
  let searchQuery = '';
  let activeCategory = 'ALL';
  let activeStockStatus = 'ALL';
  let currentSort = 'name-asc';

  // Preset illustration/photo options for product images
  const SVG_PRESETS = [
    { label: 'Amul Milk', path: 'assets/products/amul_milk.jpg' },
    { label: 'Amul Ghee', path: 'assets/products/amul_ghee.jpg' },
    { label: 'Aashirvaad Atta', path: 'assets/products/aashirvaad_atta.jpg' },
    { label: 'India Gate Rice', path: 'assets/products/india_gate_rice.jpg' },
    { label: 'Tata Toor Dal', path: 'assets/products/tata_toor_dal.jpg' },
    { label: 'Sunflower Oil', path: 'assets/products/fortune_sunflower_oil.jpg' },
    { label: 'Mustard Oil', path: 'assets/products/fortune_mustard_oil.jpg' },
    { label: 'Tata Salt', path: 'assets/products/tata_salt.jpg' },
    { label: 'Garam Masala', path: 'assets/products/everest_garam_masala.jpg' },
    { label: 'Deggi Mirch', path: 'assets/products/mdh_deggi_mirch.jpg' },
    { label: 'Maggi Noodles', path: 'assets/products/maggi_noodles.jpg' },
    { label: 'Parle-G Gold', path: 'assets/products/parle_g_gold.jpg' },
    { label: 'Good Day Cookies', path: 'assets/products/good_day_cookies.jpg' },
    { label: 'Bourbon Biscuits', path: 'assets/products/britannia_bourbon.jpg' },
    { label: 'Oreo Biscuits', path: 'assets/products/oreo_biscuits.jpg' },
    { label: 'Aloo Bhujia', path: 'assets/products/haldirams_bhujia.jpg' },
    { label: 'Dairy Milk', path: 'assets/products/dairy_milk_chocolate.jpg' },
    { label: 'KitKat', path: 'assets/products/kitkat_chocolate.jpg' },
    { label: 'Tata Tea Gold', path: 'assets/products/tata_tea_gold.jpg' },
    { label: 'Red Label Tea', path: 'assets/products/red_label_tea.jpg' },
    { label: 'Nescafe Coffee', path: 'assets/products/nescafe_coffee.jpg' },
    { label: 'Dettol Soap', path: 'assets/products/dettol_soap.jpg' },
    { label: 'Clinic Plus Shampoo', path: 'assets/products/clinic_plus_shampoo.jpg' },
    { label: 'Colgate Toothpaste', path: 'assets/products/colgate_toothpaste.jpg' },
    { label: 'Surf Excel', path: 'assets/products/surf_excel.jpg' },
    { label: 'Vim Dishwash Bar', path: 'assets/products/vim_bar.jpg' },
    { label: 'Alphonso Mangoes', path: 'assets/products/alphonso_mangoes.jpg' }
  ];

  /* --------------------------------------------------------------------------
     1. Data Retrieval, Filtering & Sorting
     -------------------------------------------------------------------------- */
  function loadProducts() {
    products = DukaanStorage.getProducts();
  }

  function getFilteredAndSortedProducts() {
    return products.filter(p => {
      // 1. Text Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name && p.name.toLowerCase().includes(q);
        const matchesCat = p.category && p.category.toLowerCase().includes(q);
        const matchesId = p.id && p.id.toLowerCase().includes(q);
        const matchesUnit = p.unit && p.unit.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesId && !matchesUnit) return false;
      }

      // 2. Category Filter
      if (activeCategory !== 'ALL') {
        if (p.category !== activeCategory) return false;
      }

      // 3. Stock Status Filter
      if (activeStockStatus === 'in-stock') {
        if (!p.available || (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0)) return false;
      } else if (activeStockStatus === 'low-stock') {
        if (!p.available || typeof p.stockQuantity !== 'number' || p.stockQuantity > 5 || p.stockQuantity <= 0) return false;
      } else if (activeStockStatus === 'out-of-stock') {
        if (p.available && (typeof p.stockQuantity !== 'number' || p.stockQuantity > 0)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (currentSort === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (currentSort === 'name-desc') {
        return b.name.localeCompare(a.name);
      } else if (currentSort === 'price-asc') {
        return a.price - b.price;
      } else if (currentSort === 'price-desc') {
        return b.price - a.price;
      } else if (currentSort === 'stock-asc') {
        return (a.stockQuantity || 0) - (b.stockQuantity || 0);
      } else if (currentSort === 'stock-desc') {
        return (b.stockQuantity || 0) - (a.stockQuantity || 0);
      }
      return 0;
    });
  }

  /* --------------------------------------------------------------------------
     2. Rendering Product List (Desktop Table + Mobile Cards)
     -------------------------------------------------------------------------- */
  function renderAll() {
    const filtered = getFilteredAndSortedProducts();

    // Update Counter Text
    const counterEl = document.getElementById('product-count-sub');
    if (counterEl) {
      counterEl.textContent = `Showing ${filtered.length} of ${products.length} catalog items`;
    }

    renderDesktopTable(filtered);
    renderMobileCards(filtered);
    bindActionEvents();
  }

  function renderDesktopTable(items) {
    const tbody = document.getElementById('admin-products-tbody');
    const emptyState = document.getElementById('products-empty-state');
    const tableContainer = document.querySelector('.dl-table-container');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = '';
      if (tableContainer) tableContainer.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
          <div class="dl-parchi-card p-4 text-center my-4" style="max-width: 460px; margin: 2rem auto;">
            <i class="bi bi-box-seam text-dl-muted" style="font-size: 2.25rem;"></i>
            <h3 class="dl-heading mt-2 mb-1" style="font-size: 1.15rem;">No products match your criteria</h3>
            <p class="text-dl-muted small mb-3">Try adjusting your search query, changing filters, or add a new product.</p>
            <div class="d-flex justify-content-center gap-2">
              <button type="button" class="btn-dl-secondary btn-sm" id="btn-reset-filters">Clear filters</button>
              <button type="button" class="btn-dl-primary btn-sm" id="btn-empty-add-product">
                <i class="bi bi-plus-lg"></i> Add new product
              </button>
            </div>
          </div>
        `;
        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) resetBtn.addEventListener('click', resetFilters);
        const addBtn = document.getElementById('btn-empty-add-product');
        if (addBtn) addBtn.addEventListener('click', () => openProductDrawer(null));
      }
      return;
    }

    if (tableContainer) tableContainer.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = items.map(p => {
      const isUnavailable = !p.available || (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0);
      const isLowStock = p.available && typeof p.stockQuantity === 'number' && p.stockQuantity > 0 && p.stockQuantity <= 5;
      const imgPath = p.image.startsWith('../') ? p.image : `../${p.image}`;

      let stockBadge = '';
      if (isUnavailable) {
        stockBadge = '<span class="dl-badge dl-badge-out-stock"><i class="bi bi-x-circle"></i> Unavailable</span>';
      } else if (isLowStock) {
        stockBadge = `<span class="dl-badge" style="background: var(--dl-warning-bg); color: var(--dl-warning-text); border: 1px solid var(--dl-warning);"><i class="bi bi-exclamation-triangle"></i> Low stock (${p.stockQuantity})</span>`;
      } else {
        stockBadge = `<span class="dl-badge dl-badge-in-stock"><i class="bi bi-check-circle"></i> In stock (${p.stockQuantity ?? 20})</span>`;
      }

      return `
        <tr data-product-id="${DukaanUI.escapeHtml(p.id)}">
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="${imgPath}" alt="${DukaanUI.escapeHtml(p.name)}" 
                   style="width: 40px; height: 40px; object-fit: contain; border-radius: 8px; border: 1px solid var(--dl-border); background: var(--dl-surface-2); padding: 2px; flex-shrink: 0;" 
                   loading="lazy">
              <div>
                <strong style="color: var(--dl-ink); display: block;">${DukaanUI.escapeHtml(p.name)}</strong>
                <span class="text-dl-muted small font-monospace">#${DukaanUI.escapeHtml(p.id)}</span>
              </div>
            </div>
          </td>
          <td><span class="text-dl-muted small">${DukaanUI.escapeHtml(p.category || 'General')}</span></td>
          <td><span class="text-dl-muted small">${DukaanUI.escapeHtml(p.unit || '')}</span></td>
          <td><strong class="dl-tabular-nums" style="color: var(--dl-ink);">₹${p.price}</strong></td>
          <td>${stockBadge}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <button type="button" 
                      class="btn-dl-secondary btn-toggle-avail" 
                      data-id="${DukaanUI.escapeHtml(p.id)}" 
                      title="${p.available ? 'Click to mark unavailable' : 'Click to mark in stock'}"
                      style="min-height: 32px; padding: 0.25rem 0.65rem; font-size: 0.78rem;">
                ${p.available ? 'Mark Unavailable' : 'Mark In Stock'}
              </button>
              <button type="button" 
                      class="btn-dl-secondary btn-edit-product" 
                      data-id="${DukaanUI.escapeHtml(p.id)}" 
                      title="Edit product"
                      style="min-height: 32px; padding: 0.25rem 0.6rem; font-size: 0.82rem;">
                <i class="bi bi-pencil" aria-hidden="true"></i>
              </button>
              <button type="button" 
                      class="btn-dl-secondary btn-delete-product text-danger" 
                      data-id="${DukaanUI.escapeHtml(p.id)}" 
                      title="Delete product"
                      style="min-height: 32px; padding: 0.25rem 0.6rem; font-size: 0.82rem;">
                <i class="bi bi-trash" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderMobileCards(items) {
    const list = document.getElementById('admin-products-mobile-list');
    if (!list) return;

    if (items.length === 0) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = items.map(p => {
      const isUnavailable = !p.available || (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0);
      const isLowStock = p.available && typeof p.stockQuantity === 'number' && p.stockQuantity > 0 && p.stockQuantity <= 5;
      const imgPath = p.image.startsWith('../') ? p.image : `../${p.image}`;

      let stockBadge = '';
      if (isUnavailable) {
        stockBadge = '<span class="dl-badge dl-badge-out-stock">✕ Unavailable</span>';
      } else if (isLowStock) {
        stockBadge = `<span class="dl-badge" style="background: var(--dl-warning-bg); color: var(--dl-warning-text); border: 1px solid var(--dl-warning);">⚠ Low (${p.stockQuantity})</span>`;
      } else {
        stockBadge = `<span class="dl-badge dl-badge-in-stock">✓ In stock (${p.stockQuantity ?? 20})</span>`;
      }

      return `
        <div class="dl-admin-item-card" data-product-id="${DukaanUI.escapeHtml(p.id)}">
          <div class="dl-admin-item-header" style="align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
              <img src="${imgPath}" alt="${DukaanUI.escapeHtml(p.name)}" 
                   style="width: 42px; height: 42px; object-fit: contain; border-radius: 8px; border: 1px solid var(--dl-border); background: var(--dl-surface-2); padding: 2px; flex-shrink: 0;" 
                   loading="lazy">
              <div style="min-width: 0;">
                <div class="dl-admin-item-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.95rem;">
                  ${DukaanUI.escapeHtml(p.name)}
                </div>
                <div class="text-dl-muted small font-monospace">#${DukaanUI.escapeHtml(p.id)} &bull; ${DukaanUI.escapeHtml(p.category || 'General')}</div>
              </div>
            </div>
            ${stockBadge}
          </div>

          <div class="d-flex justify-content-between align-items-center mt-2 pt-2" style="border-top: 1px dashed var(--dl-border);">
            <div class="text-dl-muted small">
              Unit: <strong>${DukaanUI.escapeHtml(p.unit || '')}</strong> &bull; Price: <strong class="dl-tabular-nums text-dl-primary" style="font-size: 1rem;">₹${p.price}</strong>
            </div>
          </div>

          <div class="d-flex gap-2 mt-3">
            <button type="button" 
                    class="btn-dl-secondary btn-toggle-avail flex-fill" 
                    data-id="${DukaanUI.escapeHtml(p.id)}" 
                    style="min-height: 38px; font-size: 0.82rem;">
              ${p.available ? 'Mark Out of Stock' : 'Mark In Stock'}
            </button>
            <button type="button" 
                    class="btn-dl-secondary btn-edit-product" 
                    data-id="${DukaanUI.escapeHtml(p.id)}" 
                    title="Edit product"
                    style="min-height: 38px; padding: 0.4rem 0.85rem; font-size: 0.85rem;">
              <i class="bi bi-pencil" aria-hidden="true"></i> Edit
            </button>
            <button type="button" 
                    class="btn-dl-secondary btn-delete-product text-danger" 
                    data-id="${DukaanUI.escapeHtml(p.id)}" 
                    title="Delete product"
                    style="min-height: 38px; padding: 0.4rem 0.85rem; font-size: 0.85rem;">
              <i class="bi bi-trash" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* --------------------------------------------------------------------------
     3. Event Bindings
     -------------------------------------------------------------------------- */
  function bindActionEvents() {
    // Quick Availability Toggles
    document.querySelectorAll('.btn-toggle-avail').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const target = products.find(p => p.id === id);
        if (target) {
          const newAvail = !target.available;
          DukaanStorage.updateProduct(id, { available: newAvail });
          DukaanUI.showToast(`Updated "${target.name}" to ${newAvail ? 'In Stock' : 'Unavailable'}`, 'success');
          loadProducts();
          renderAll();
        }
      };
    });

    // Edit Product Buttons
    document.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openProductDrawer(id);
      };
    });

    // Delete Product Buttons
    document.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openDeleteModal(id);
      };
    });
  }

  /* --------------------------------------------------------------------------
     4. Product Add / Edit Drawer
     -------------------------------------------------------------------------- */
  function initPresetSvgSelector(selectedPath) {
    const grid = document.getElementById('product-svg-picker-grid');
    if (!grid) return;

    grid.innerHTML = SVG_PRESETS.map((preset, idx) => {
      const isSelected = preset.path === selectedPath || (!selectedPath && idx === 0);
      return `
        <button type="button" 
                class="dl-preset-svg-btn ${isSelected ? 'selected' : ''}" 
                data-path="${preset.path}" 
                title="${preset.label}"
                aria-label="${preset.label}">
          <img src="../${preset.path}" alt="${preset.label}" width="28" height="28" style="object-fit: contain;">
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.dl-preset-svg-btn').forEach(btn => {
      btn.onclick = (e) => {
        grid.querySelectorAll('.dl-preset-svg-btn').forEach(b => b.classList.remove('selected'));
        const target = e.currentTarget;
        target.classList.add('selected');
        const path = target.getAttribute('data-path');
        const input = document.getElementById('product-image-path');
        const previewImg = document.getElementById('product-image-preview');
        if (input) input.value = path;
        if (previewImg) previewImg.src = `../${path}`;
      };
    });
  }

  function openProductDrawer(productId = null) {
    editingProductId = productId;
    const drawer = document.getElementById('product-drawer');
    const overlay = document.getElementById('product-drawer-overlay');
    const titleEl = document.getElementById('product-drawer-title');
    const idEl = document.getElementById('product-id-display');
    const form = document.getElementById('product-edit-form');
    if (!drawer || !overlay || !form) return;

    const nameInput = document.getElementById('product-name-input');
    const categorySelect = document.getElementById('product-category-select');
    const priceInput = document.getElementById('product-price-input');
    const unitInput = document.getElementById('product-unit-input');
    const stockInput = document.getElementById('product-stock-input');
    const availCheckbox = document.getElementById('product-avail-checkbox');
    const imagePathInput = document.getElementById('product-image-path');
    const previewImg = document.getElementById('product-image-preview');

    if (productId) {
      // Edit Mode
      const p = products.find(x => x.id === productId);
      if (!p) return;
      if (titleEl) titleEl.textContent = `Edit Product #${p.id}`;
      if (idEl) idEl.textContent = p.id;

      if (nameInput) nameInput.value = p.name || '';
      if (categorySelect) categorySelect.value = p.category || 'Dairy & Breakfast';
      if (priceInput) priceInput.value = p.price || '';
      if (unitInput) unitInput.value = p.unit || '';
      if (stockInput) stockInput.value = p.stockQuantity ?? 20;
      if (availCheckbox) availCheckbox.checked = p.available !== false;

      const path = p.image || 'assets/products/svg/p001.svg';
      if (imagePathInput) imagePathInput.value = path;
      if (previewImg) previewImg.src = path.startsWith('../') ? path : `../${path}`;
      initPresetSvgSelector(path);
    } else {
      // Add Mode
      if (titleEl) titleEl.textContent = 'Add New Product';
      if (idEl) idEl.textContent = 'Auto-generated';

      form.reset();
      if (stockInput) stockInput.value = '20';
      if (availCheckbox) availCheckbox.checked = true;

      const defaultPath = 'assets/products/svg/p001.svg';
      if (imagePathInput) imagePathInput.value = defaultPath;
      if (previewImg) previewImg.src = `../${defaultPath}`;
      initPresetSvgSelector(defaultPath);
    }

    drawer.classList.add('active');
    overlay.classList.add('active');
    if (nameInput) setTimeout(() => nameInput.focus(), 150);
  }

  function closeProductDrawer() {
    const drawer = document.getElementById('product-drawer');
    const overlay = document.getElementById('product-drawer-overlay');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    editingProductId = null;
  }

  function handleProductFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('product-name-input').value.trim();
    const category = document.getElementById('product-category-select').value;
    const priceVal = parseFloat(document.getElementById('product-price-input').value);
    const unit = document.getElementById('product-unit-input').value.trim();
    const stockVal = parseInt(document.getElementById('product-stock-input').value, 10);
    const available = document.getElementById('product-avail-checkbox').checked;
    const imagePath = document.getElementById('product-image-path').value || 'assets/products/svg/p001.svg';

    // Validation rules
    if (!name) {
      DukaanUI.showToast('Please enter a product name', 'error');
      return;
    }
    if (isNaN(priceVal) || priceVal <= 0) {
      DukaanUI.showToast('Enter a valid price greater than zero.', 'error');
      return;
    }
    if (!unit) {
      DukaanUI.showToast('Please specify a unit (e.g. 500 g pouch)', 'error');
      return;
    }

    const payload = {
      name,
      category,
      price: Math.round(priceVal),
      unit,
      stockQuantity: isNaN(stockVal) ? 0 : Math.max(0, stockVal),
      available,
      image: imagePath
    };

    if (editingProductId) {
      // Update
      const ok = DukaanStorage.updateProduct(editingProductId, payload);
      if (ok) {
        DukaanUI.showToast('Product saved successfully.', 'success');
        closeProductDrawer();
        loadProducts();
        renderAll();
      } else {
        DukaanUI.showToast('Failed to update product in storage', 'error');
      }
    } else {
      // Create
      const newProduct = DukaanStorage.addProduct(payload);
      if (newProduct) {
        DukaanUI.showToast(`Product "${newProduct.name}" created successfully.`, 'success');
        closeProductDrawer();
        loadProducts();
        renderAll();
      } else {
        DukaanUI.showToast('Failed to add product to storage', 'error');
      }
    }
  }

  /* --------------------------------------------------------------------------
     5. Delete Product Modal
     -------------------------------------------------------------------------- */
  function openDeleteModal(productId) {
    deletingProductId = productId;
    const p = products.find(x => x.id === productId);
    if (!p) return;

    const modal = document.getElementById('delete-product-modal');
    const overlay = document.getElementById('delete-modal-overlay');
    const nameEl = document.getElementById('delete-product-name-target');
    if (!modal || !overlay) return;

    if (nameEl) nameEl.textContent = p.name;
    modal.classList.add('active');
    overlay.classList.add('active');
  }

  function closeDeleteModal() {
    const modal = document.getElementById('delete-product-modal');
    const overlay = document.getElementById('delete-modal-overlay');
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    deletingProductId = null;
  }

  function handleConfirmDelete() {
    if (!deletingProductId) return;
    const id = deletingProductId;
    const target = products.find(x => x.id === id);
    const name = target ? target.name : id;

    closeDeleteModal();
    const success = DukaanStorage.deleteProduct(id);
    if (success) {
      DukaanUI.showToast(`Product "${name}" deleted.`, 'info');
      loadProducts();
      renderAll();
    } else {
      DukaanUI.showToast('Failed to delete product', 'error');
    }
  }

  /* --------------------------------------------------------------------------
     6. CSV Export Functionality
     -------------------------------------------------------------------------- */
  function exportProductsCSV() {
    if (!products || products.length === 0) {
      DukaanUI.showToast('No products available to export', 'warning');
      return;
    }

    const headers = ['Product ID', 'Name', 'Category', 'Price (INR)', 'Unit', 'Available', 'Stock Quantity', 'Last Updated'];
    const rows = products.map(p => [
      `"${p.id}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.price,
      `"${(p.unit || '').replace(/"/g, '""')}"`,
      p.available ? 'TRUE' : 'FALSE',
      p.stockQuantity ?? 0,
      `"${p.updatedAt || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `dukaanlite-products-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    DukaanUI.showToast(`Exported ${products.length} products to CSV`, 'success');
  }

  /* --------------------------------------------------------------------------
     7. Filter Helpers & Reset
     -------------------------------------------------------------------------- */
  function resetFilters() {
    searchQuery = '';
    activeCategory = 'ALL';
    activeStockStatus = 'ALL';
    currentSort = 'name-asc';

    const searchInput = document.getElementById('admin-product-search');
    if (searchInput) searchInput.value = '';

    const catSelect = document.getElementById('admin-category-filter');
    if (catSelect) catSelect.value = 'ALL';

    const stockSelect = document.getElementById('admin-stock-filter');
    if (stockSelect) stockSelect.value = 'ALL';

    const sortSelect = document.getElementById('admin-sort-select');
    if (sortSelect) sortSelect.value = 'name-asc';

    renderAll();
  }

  /* --------------------------------------------------------------------------
     8. Initialization
     -------------------------------------------------------------------------- */
  function init() {
    loadProducts();
    renderAll();

    // 1. Search input
    const searchInput = document.getElementById('admin-product-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderAll();
      });
    }

    // 2. Category filter
    const catSelect = document.getElementById('admin-category-filter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        activeCategory = e.target.value;
        renderAll();
      });
    }

    // 3. Stock status filter
    const stockSelect = document.getElementById('admin-stock-filter');
    if (stockSelect) {
      stockSelect.addEventListener('change', (e) => {
        activeStockStatus = e.target.value;
        renderAll();
      });
    }

    // 4. Sort select
    const sortSelect = document.getElementById('admin-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderAll();
      });
    }

    // 5. Add Product button
    const addBtn = document.getElementById('btn-add-product-main');
    if (addBtn) {
      addBtn.addEventListener('click', () => openProductDrawer(null));
    }

    // 6. Export CSV button
    const exportBtn = document.getElementById('btn-export-products-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportProductsCSV);
    }

    // 7. Drawer Cancel & Close buttons
    const closeDrawerBtn = document.getElementById('btn-close-product-drawer');
    const cancelDrawerBtn = document.getElementById('btn-cancel-product-drawer');
    const drawerOverlay = document.getElementById('product-drawer-overlay');
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeProductDrawer);
    if (cancelDrawerBtn) cancelDrawerBtn.addEventListener('click', closeProductDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeProductDrawer);

    // 8. Product Form Submit
    const productForm = document.getElementById('product-edit-form');
    if (productForm) {
      productForm.addEventListener('submit', handleProductFormSubmit);
    }

    // 9. Delete Modal buttons
    const cancelDeleteBtn = document.getElementById('btn-cancel-delete');
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
    const deleteOverlay = document.getElementById('delete-modal-overlay');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    if (deleteOverlay) deleteOverlay.addEventListener('click', closeDeleteModal);

    // 10. Escape key listener for modal & drawer
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeProductDrawer();
        closeDeleteModal();
      }
    });

    // 11. Cross-tab live synchronization
    if (window.DukaanLive) {
      window.DukaanLive.subscribe((event, data) => {
        if (event === 'CATALOG_UPDATED') {
          loadProducts();
          renderAll();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (window.DukaanTheme) DukaanTheme.init();
    init();
  });

})();
