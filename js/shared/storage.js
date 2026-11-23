/**
 * ============================================================================
 * DukaanLite - Storage Layer (js/shared/storage.js)
 * ============================================================================
 * This module is the central contract for reading and writing data in the app.
 * Both the Customer vertical and the Shopkeeper vertical use these functions.
 * 
 * Storage Strategy:
 * - Uses browser localStorage with versioned keys (v1).
 * - On first run, seeds default settings, products, and sample orders.
 * - Every read/write is guarded with try/catch to gracefully handle errors
 *   (such as private browsing quota limits or corrupted JSON).
 * - Write operations return true on success, false on failure.
 * ============================================================================
 */

// 1. Versioned Storage Keys
const STORAGE_KEYS = {
  PRODUCTS: 'dukaanlite_products_v1',
  ORDERS: 'dukaanlite_orders_v1',
  SETTINGS: 'dukaanlite_settings_v1',
  ACTIVE_USER: 'dukaanlite_active_user_v1'
};

// 2. Default Store Settings
const DEFAULT_SETTINGS = {
  shopName: "Sharma General Store",
  tagline: "Fresh groceries & daily essentials at fair neighborhood prices",
  whatsappNumber: "919876543210", // Fictional demo number
  operatingHours: "Open 8:00 AM - 9:00 PM",
  address: "Shop 4, Block C Market, Green Park",
  isConfigured: true,
  updatedAt: new Date().toISOString()
};

// 3. Fictional Demo Orders (Each item snapshots name, unit, price & quantity)
const DEFAULT_ORDERS = [
  {
    id: "ORD-1001",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    customerName: "Priya Sharma",
    customerPhone: "9876501234",
    items: [
      { name: "Amul Taaza Toned Fresh Milk", unit: "500 ml pouch", price: 27, quantity: 2, subtotal: 54 },
      { name: "Parle-G Gold Glucose Biscuits", unit: "100 g pack", price: 15, quantity: 2, subtotal: 30 }
    ],
    estimatedTotal: 84,
    status: "Completed",
    notes: "Leave with security guard if not home."
  },
  {
    id: "ORD-1002",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
    customerName: "Rajesh Verma",
    customerPhone: "9811223344",
    items: [
      { name: "Aashirvaad Shudh Chakki Atta", unit: "5 kg bag", price: 245, quantity: 1, subtotal: 245 },
      { name: "Fortune Sunlite Refined Sunflower Oil", unit: "1 L pouch", price: 140, quantity: 1, subtotal: 140 },
      { name: "Tata Salt Vacuum Evaporated Iodized", unit: "1 kg pack", price: 28, quantity: 1, subtotal: 28 }
    ],
    estimatedTotal: 413,
    status: "Preparing",
    notes: "Please pack in a cardboard box."
  },
  {
    id: "ORD-1003",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(), // 8 hours ago
    customerName: "Sunita Patel",
    customerPhone: "9988776655",
    items: [
      { name: "Tata Tea Gold Rich Aroma", unit: "500 g pouch", price: 260, quantity: 1, subtotal: 260 },
      { name: "Britannia Good Day Rich Cashew Cookies", unit: "200 g pack", price: 35, quantity: 2, subtotal: 70 }
    ],
    estimatedTotal: 330,
    status: "Confirmed",
    notes: "Call upon arrival."
  },
  {
    id: "ORD-1004",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
    customerName: "Amit Kumar",
    customerPhone: "9712345678",
    items: [
      { name: "Maggi 2-Minute Masala Noodles", unit: "Pack of 4 (280 g)", price: 56, quantity: 2, subtotal: 112 },
      { name: "Amul Pure Ghee Jar", unit: "500 ml glass jar", price: 310, quantity: 1, subtotal: 310 }
    ],
    estimatedTotal: 422,
    status: "Pending",
    notes: "Door bell is broken, please knock."
  }
];

// 4. Default 27 Realistic Seed Products with Authentic Studio Photography
const DEFAULT_PRODUCTS = [
  // Dairy & Breakfast
  { id: "P001", name: "Amul Taaza Toned Fresh Milk", category: "Dairy & Breakfast", price: 27, unit: "500 ml pouch", image: "assets/products/amul_milk.jpg", available: true, stockQuantity: 30, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P002", name: "Amul Pure Ghee Jar", category: "Dairy & Breakfast", price: 310, unit: "500 ml glass jar", image: "assets/products/amul_ghee.jpg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },
  
  // Staples & Grains
  { id: "P003", name: "Aashirvaad Shudh Chakki Atta", category: "Staples & Grains", price: 245, unit: "5 kg bag", image: "assets/products/aashirvaad_atta.jpg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P004", name: "India Gate Feast Rozzana Basmati Rice", category: "Staples & Grains", price: 85, unit: "500 g pouch", image: "assets/products/india_gate_rice.jpg", available: true, stockQuantity: 18, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P005", name: "Tata Sampann Unpolished Toor Dal", category: "Staples & Grains", price: 175, unit: "1 kg pouch", image: "assets/products/tata_toor_dal.jpg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P006", name: "Fortune Sunlite Refined Sunflower Oil", category: "Staples & Grains", price: 140, unit: "1 L pouch", image: "assets/products/fortune_sunflower_oil.jpg", available: true, stockQuantity: 16, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P007", name: "Fortune Premium Kachi Ghani Mustard Oil", category: "Staples & Grains", price: 155, unit: "1 L pouch", image: "assets/products/fortune_mustard_oil.jpg", available: true, stockQuantity: 12, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P008", name: "Tata Salt Vacuum Evaporated Iodized", category: "Staples & Grains", price: 28, unit: "1 kg pack", image: "assets/products/tata_salt.jpg", available: true, stockQuantity: 40, updatedAt: "2026-11-23T08:00:00.000Z" },
  
  // Spices & Masalas
  { id: "P009", name: "Everest Garam Masala Spice Blend", category: "Spices & Masalas", price: 82, unit: "100 g box", image: "assets/products/everest_garam_masala.jpg", available: true, stockQuantity: 22, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P010", name: "MDH Deggi Mirch Red Chilli Powder", category: "Spices & Masalas", price: 95, unit: "100 g tin", image: "assets/products/mdh_deggi_mirch.jpg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },
  
  // Snacks & Biscuits
  { id: "P011", name: "Maggi 2-Minute Masala Noodles", category: "Snacks & Biscuits", price: 56, unit: "Pack of 4 (280 g)", image: "assets/products/maggi_noodles.jpg", available: true, stockQuantity: 25, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P012", name: "Parle-G Gold Glucose Biscuits", category: "Snacks & Biscuits", price: 15, unit: "100 g pack", image: "assets/products/parle_g_gold.jpg", available: true, stockQuantity: 45, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P013", name: "Britannia Good Day Rich Cashew Cookies", category: "Snacks & Biscuits", price: 35, unit: "200 g pack", image: "assets/products/good_day_cookies.jpg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P014", name: "Britannia Bourbon Chocolate Cream Biscuits", category: "Snacks & Biscuits", price: 30, unit: "150 g pack", image: "assets/products/britannia_bourbon.jpg", available: true, stockQuantity: 24, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P015", name: "Cadbury Oreo Original Vanilla Biscuits", category: "Snacks & Biscuits", price: 40, unit: "120 g pack", image: "assets/products/oreo_biscuits.jpg", available: true, stockQuantity: 18, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P016", name: "Haldiram Nagpur Bhujia Sev Namkeen", category: "Snacks & Biscuits", price: 90, unit: "400 g pouch", image: "assets/products/haldirams_bhujia.jpg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P017", name: "Cadbury Dairy Milk Chocolate Bar", category: "Snacks & Biscuits", price: 90, unit: "130 g bar", image: "assets/products/dairy_milk_chocolate.jpg", available: true, stockQuantity: 16, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P018", name: "Nestle KitKat 4-Finger Wafer Bar", category: "Snacks & Biscuits", price: 25, unit: "41.5 g bar", image: "assets/products/kitkat_chocolate.jpg", available: false, stockQuantity: 0, updatedAt: "2026-11-23T08:00:00.000Z" },
  
  // Beverages
  { id: "P019", name: "Tata Tea Gold Rich Aroma", category: "Beverages", price: 260, unit: "500 g pouch", image: "assets/products/tata_tea_gold.jpg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P020", name: "Brooke Bond Red Label Tea", category: "Beverages", price: 240, unit: "500 g carton", image: "assets/products/red_label_tea.jpg", available: true, stockQuantity: 12, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P021", name: "Nescafe Classic Instant Coffee Jar", category: "Beverages", price: 390, unit: "200 g jar", image: "assets/products/nescafe_coffee.jpg", available: true, stockQuantity: 10, updatedAt: "2026-11-23T08:00:00.000Z" },
  
  // Personal & Home Care
  { id: "P022", name: "Dettol Original Bath Soap", category: "Personal & Home Care", price: 140, unit: "Pack of 4 (440 g)", image: "assets/products/dettol_soap.jpg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P023", name: "Colgate Strong Teeth Dental Cream", category: "Personal & Home Care", price: 65, unit: "150 g tube", image: "assets/products/colgate_toothpaste.jpg", available: true, stockQuantity: 25, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P024", name: "Clinic Plus Strong & Long Shampoo", category: "Personal & Home Care", price: 190, unit: "340 ml bottle", image: "assets/products/clinic_plus_shampoo.jpg", available: true, stockQuantity: 11, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P025", name: "Surf Excel Quick Wash Detergent Powder", category: "Personal & Home Care", price: 145, unit: "1 kg carton box", image: "assets/products/surf_excel.jpg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P026", name: "Vim Classic Dishwash Bar with Lemons", category: "Personal & Home Care", price: 25, unit: "300 g bar", image: "assets/products/vim_bar.jpg", available: true, stockQuantity: 35, updatedAt: "2026-11-23T08:00:00.000Z" },
  
  // Fresh Fruits
  { id: "P027", name: "Fresh Ratnagiri Alphonso Mangoes", category: "Fresh Fruits", price: 600, unit: "1 Dozen Box (12 pcs)", image: "assets/products/alphonso_mangoes.jpg", available: false, stockQuantity: 0, updatedAt: "2026-11-23T08:00:00.000Z" }
];

/**
 * Helper: Safely reads a JSON item from localStorage.
 * If malformed or missing, returns fallbackValue without throwing.
 */
function safeGetItem(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Storage] Failed to read or parse key "${key}":`, err);
    return fallbackValue;
  }
}

/**
 * Helper: Safely writes a JSON item to localStorage.
 * Returns true if successful, false if quota exceeded or storage disabled.
 */
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[Storage] Failed to write key "${key}":`, err);
    return false;
  }
}

// ============================================================================
// Public Storage API Functions
// ============================================================================

const SEED_VERSION_KEY = 'dukaanlite_catalog_seed_v2';

/**
 * Retrieve all products.
 * Seeds default products if storage is currently empty or uninitialized.
 * @returns {Array<Object>} List of product objects
 */
function getProducts() {
  const seedMark = localStorage.getItem(SEED_VERSION_KEY);
  let products = safeGetItem(STORAGE_KEYS.PRODUCTS, null);
  if (!products || !Array.isArray(products) || products.length === 0 || !seedMark) {
    console.log("[Storage] Seeding 27 products with authentic studio photography into localStorage.");
    products = DEFAULT_PRODUCTS;
    safeSetItem(STORAGE_KEYS.PRODUCTS, products);
    try {
      localStorage.setItem(SEED_VERSION_KEY, 'true');
    } catch (e) {}
  }
  return products;
}

/**
 * Save the entire list of products.
 * @param {Array<Object>} productsList - The updated array of products
 * @returns {boolean} True if successfully saved, false otherwise
 */
function saveProducts(productsList) {
  if (!Array.isArray(productsList)) {
    console.error("[Storage] saveProducts error: Expected an array of products.");
    return false;
  }
  return safeSetItem(STORAGE_KEYS.PRODUCTS, productsList);
}

/**
 * Retrieve all recorded orders.
 * Seeds initial demo orders if storage is uninitialized.
 * @returns {Array<Object>} List of order objects
 */
function getOrders() {
  let orders = safeGetItem(STORAGE_KEYS.ORDERS, null);
  if (!orders || !Array.isArray(orders)) {
    console.log("[Storage] Seeding initial demo orders.");
    orders = DEFAULT_ORDERS;
    safeSetItem(STORAGE_KEYS.ORDERS, orders);
  }
  return orders;
}

/**
 * Add a new order record.
 * Snapshots all items with current unit price and quantity.
 * @param {Object} order - The new order object
 * @returns {boolean} True if successfully appended, false otherwise
 */
function addOrder(order) {
  if (!order || !order.items || !Array.isArray(order.items)) {
    console.error("[Storage] addOrder error: Invalid order object format.");
    return false;
  }
  const orders = getOrders();
  // Ensure required fields exist
  order.id = order.id || `ORD-${Date.now().toString().slice(-4)}`;
  order.createdAt = order.createdAt || new Date().toISOString();
  order.status = order.status || "Pending";
  
  orders.unshift(order); // Add newest order to the top
  return safeSetItem(STORAGE_KEYS.ORDERS, orders);
}

/**
 * Update the status of an existing order.
 * Allowed statuses: "Pending", "Confirmed", "Preparing", "Ready", "Completed", "Cancelled".
 * @param {string} orderId - The unique ID of the order (e.g. "ORD-1001")
 * @param {string} newStatus - The new status to apply
 * @returns {boolean} True if order was found and updated, false otherwise
 */
function updateOrderStatus(orderId, newStatus) {
  const allowedStatuses = ["Pending", "Confirmed", "Preparing", "Ready", "Completed", "Cancelled"];
  if (!allowedStatuses.includes(newStatus)) {
    console.error(`[Storage] Invalid status "${newStatus}". Must be one of:`, allowedStatuses);
    return false;
  }

  const orders = getOrders();
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    console.error(`[Storage] Order "${orderId}" not found.`);
    return false;
  }

  orders[orderIndex].status = newStatus;
  orders[orderIndex].updatedAt = new Date().toISOString();
  return safeSetItem(STORAGE_KEYS.ORDERS, orders);
}

/**
 * Retrieve store settings (shop name, phone number, operating hours, etc.).
 * Seeds default settings if uninitialized.
 * @returns {Object} Store settings object
 */
function getSettings() {
  let settings = safeGetItem(STORAGE_KEYS.SETTINGS, null);
  if (!settings || typeof settings !== 'object') {
    console.log("[Storage] Seeding default store settings.");
    settings = DEFAULT_SETTINGS;
    safeSetItem(STORAGE_KEYS.SETTINGS, settings);
  }
  return settings;
}

/**
 * Save updated store settings.
 * @param {Object} newSettings - The updated settings object
 * @returns {boolean} True if saved, false otherwise
 */
function saveSettings(newSettings) {
  if (!newSettings || typeof newSettings !== 'object') {
    console.error("[Storage] saveSettings error: Invalid settings object.");
    return false;
  }
  const current = getSettings();
  const merged = { ...current, ...newSettings, updatedAt: new Date().toISOString() };
  return safeSetItem(STORAGE_KEYS.SETTINGS, merged);
}

/**
 * Reset all application data back to initial demo seeds.
 * Clears products, orders, and settings, and reloads initial seeds.
 * @returns {boolean} True if reset was successful
 */
function resetDemoData() {
  try {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    
    // Re-seed defaults immediately
    safeSetItem(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    safeSetItem(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS);
    safeSetItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    console.log("[Storage] Demo data successfully reset to defaults.");
    return true;
  } catch (err) {
    console.error("[Storage] Failed to reset demo data:", err);
    return false;
  }
}

/**
 * Session helper: Get currently logged in demo user (Role: "customer" | "shopkeeper")
 */
function getActiveUser() {
  return safeGetItem(STORAGE_KEYS.ACTIVE_USER, null);
}

/**
 * Session helper: Set currently logged in demo user
 */
function setActiveUser(user) {
  return safeSetItem(STORAGE_KEYS.ACTIVE_USER, user);
}

/**
 * Session helper: Clear logged in user session
 */
function clearActiveUser() {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    return true;
  } catch (e) {
    return false;
  }
}

// Export for ES modules or attach to window for plain browser script tags
if (typeof window !== 'undefined') {
  window.DukaanStorage = {
    getProducts,
    saveProducts,
    getOrders,
    addOrder,
    updateOrderStatus,
    getSettings,
    saveSettings,
    resetDemoData,
    getActiveUser,
    setActiveUser,
    clearActiveUser,
    STORAGE_KEYS
  };
}
