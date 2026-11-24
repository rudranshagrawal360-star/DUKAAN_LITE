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
  ACTIVE_USER: 'dukaanlite_active_user_v1',
  THEME: 'dukaanlite_theme_v1',
  MY_ORDERS: 'dukaanlite_my_orders_v1'
};

// 2. Default Store Settings
const DEFAULT_SETTINGS = {
  shopName: "Sharma General Store",
  tagline: "Fresh groceries & daily essentials at fair prices",
  whatsappNumber: "919800000000",   // Fictional demo number
  operatingHours: "Open 8:00 AM – 9:00 PM",
  address: "Shop 4, Block C Market, Green Park",
  isConfigured: true,
  updatedAt: new Date().toISOString()
};

// 3. Brand-free seed products (fictional generic names, existing product photos)
const DEFAULT_PRODUCTS = [
  // Dairy & Breakfast
  { id: "P001", name: "Toned Milk", category: "Dairy & Breakfast", price: 27, unit: "500 ml pouch", image: "assets/products/svg/p001.svg", available: true, stockQuantity: 30, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P002", name: "Pure Ghee", category: "Dairy & Breakfast", price: 310, unit: "500 ml glass jar", image: "assets/products/svg/p002.svg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Staples & Grains
  { id: "P003", name: "Chakki Atta", category: "Staples & Grains", price: 245, unit: "5 kg bag", image: "assets/products/svg/p003.svg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P004", name: "Basmati Rice", category: "Staples & Grains", price: 85, unit: "500 g pouch", image: "assets/products/svg/p004.svg", available: true, stockQuantity: 18, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P005", name: "Toor Dal", category: "Staples & Grains", price: 175, unit: "1 kg pouch", image: "assets/products/svg/p005.svg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P006", name: "Refined Sunflower Oil", category: "Staples & Grains", price: 140, unit: "1 L pouch", image: "assets/products/svg/p006.svg", available: true, stockQuantity: 16, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P007", name: "Kachi Ghani Mustard Oil", category: "Staples & Grains", price: 155, unit: "1 L bottle", image: "assets/products/svg/p007.svg", available: true, stockQuantity: 12, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P008", name: "Iodised Salt", category: "Staples & Grains", price: 28, unit: "1 kg pack", image: "assets/products/svg/p008.svg", available: true, stockQuantity: 40, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Spices & Masalas
  { id: "P009", name: "Garam Masala", category: "Spices & Masalas", price: 82, unit: "100 g box", image: "assets/products/svg/p009.svg", available: true, stockQuantity: 22, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P010", name: "Red Chilli Powder", category: "Spices & Masalas", price: 95, unit: "100 g box", image: "assets/products/svg/p010.svg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Snacks & Biscuits
  { id: "P011", name: "Instant Noodles", category: "Snacks & Biscuits", price: 56, unit: "Pack of 4 (280 g)", image: "assets/products/svg/p011.svg", available: true, stockQuantity: 25, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P012", name: "Glucose Biscuits", category: "Snacks & Biscuits", price: 15, unit: "100 g pack", image: "assets/products/svg/p012.svg", available: true, stockQuantity: 45, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P013", name: "Cashew Cookies", category: "Snacks & Biscuits", price: 35, unit: "200 g pack", image: "assets/products/svg/p013.svg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P014", name: "Chocolate Cream Biscuits", category: "Snacks & Biscuits", price: 30, unit: "150 g pack", image: "assets/products/svg/p014.svg", available: true, stockQuantity: 24, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P015", name: "Vanilla Cream Biscuits", category: "Snacks & Biscuits", price: 40, unit: "120 g pack", image: "assets/products/svg/p015.svg", available: true, stockQuantity: 18, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P016", name: "Bhujia Sev", category: "Snacks & Biscuits", price: 90, unit: "400 g pouch", image: "assets/products/svg/p016.svg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P017", name: "Milk Chocolate Bar", category: "Snacks & Biscuits", price: 90, unit: "130 g bar", image: "assets/products/svg/p017.svg", available: true, stockQuantity: 16, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P018", name: "Crisp Wafer Bar", category: "Snacks & Biscuits", price: 25, unit: "41.5 g bar", image: "assets/products/svg/p018.svg", available: false, stockQuantity: 0, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Beverages
  { id: "P019", name: "Masala Chai Dust", category: "Beverages", price: 260, unit: "500 g pouch", image: "assets/products/svg/p019.svg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P020", name: "CTC Leaf Tea", category: "Beverages", price: 240, unit: "500 g carton", image: "assets/products/svg/p020.svg", available: true, stockQuantity: 12, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P021", name: "Instant Coffee", category: "Beverages", price: 390, unit: "200 g jar", image: "assets/products/svg/p021.svg", available: true, stockQuantity: 10, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Personal & Home Care
  { id: "P022", name: "Antiseptic Bath Soap", category: "Personal & Home Care", price: 140, unit: "Pack of 4 (440 g)", image: "assets/products/svg/p022.svg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P023", name: "Toothpaste", category: "Personal & Home Care", price: 65, unit: "150 g tube", image: "assets/products/svg/p023.svg", available: true, stockQuantity: 25, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P024", name: "Nourishing Shampoo", category: "Personal & Home Care", price: 190, unit: "340 ml bottle", image: "assets/products/svg/p024.svg", available: true, stockQuantity: 11, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P025", name: "Detergent Powder", category: "Personal & Home Care", price: 145, unit: "1 kg carton", image: "assets/products/svg/p025.svg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P026", name: "Dishwash Bar", category: "Personal & Home Care", price: 25, unit: "300 g bar", image: "assets/products/svg/p026.svg", available: true, stockQuantity: 35, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Fresh Fruits
  { id: "P027", name: "Alphonso Mangoes", category: "Fresh Fruits", price: 600, unit: "1 Dozen Box (12 pcs)", image: "assets/products/svg/p027.svg", available: false, stockQuantity: 0, updatedAt: "2026-11-23T08:00:00.000Z" }
];

// 4. Fictional Demo Orders (brand-free item names, fake phone numbers)
const DEFAULT_TODAY_ORDERS = [
  {
    id: "ORD-1001",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    customerName: "Meera S.",
    customerPhone: "9800001111",
    items: [
      { name: "Toned Milk", unit: "500 ml pouch", price: 27, quantity: 2, subtotal: 54 },
      { name: "Glucose Biscuits", unit: "100 g pack", price: 15, quantity: 2, subtotal: 30 }
    ],
    estimatedTotal: 84,
    status: "Completed",
    statusHistory: [
      { status: "Pending", at: new Date(Date.now() - 3600000 * 2).toISOString() },
      { status: "Confirmed", at: new Date(Date.now() - 3600000 * 1.8).toISOString() },
      { status: "Preparing", at: new Date(Date.now() - 3600000 * 1.5).toISOString() },
      { status: "Ready", at: new Date(Date.now() - 3600000 * 1.2).toISOString() },
      { status: "Completed", at: new Date(Date.now() - 3600000 * 1.0).toISOString() }
    ],
    notes: "Leave with security guard."
  },
  {
    id: "ORD-1002",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    customerName: "Rajan V.",
    customerPhone: "9800002222",
    items: [
      { name: "Chakki Atta", unit: "5 kg bag", price: 245, quantity: 1, subtotal: 245 },
      { name: "Refined Sunflower Oil", unit: "1 L pouch", price: 140, quantity: 1, subtotal: 140 },
      { name: "Iodised Salt", unit: "1 kg pack", price: 28, quantity: 1, subtotal: 28 }
    ],
    estimatedTotal: 413,
    status: "Preparing",
    statusHistory: [
      { status: "Pending", at: new Date(Date.now() - 3600000 * 5).toISOString() },
      { status: "Confirmed", at: new Date(Date.now() - 3600000 * 4.6).toISOString() },
      { status: "Preparing", at: new Date(Date.now() - 3600000 * 4.1).toISOString() }
    ],
    notes: "Pack in a cardboard box."
  },
  {
    id: "ORD-1003",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    customerName: "Sunita P.",
    customerPhone: "9800003333",
    items: [
      { name: "Masala Chai Dust", unit: "500 g pouch", price: 260, quantity: 1, subtotal: 260 },
      { name: "Cashew Cookies", unit: "200 g pack", price: 35, quantity: 2, subtotal: 70 }
    ],
    estimatedTotal: 330,
    status: "Confirmed",
    statusHistory: [
      { status: "Pending", at: new Date(Date.now() - 3600000 * 8).toISOString() },
      { status: "Confirmed", at: new Date(Date.now() - 3600000 * 7.5).toISOString() }
    ],
    notes: "Call on arrival."
  },
  {
    id: "ORD-1004",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 mins ago (triggers > 10m amber warning)
    customerName: "Amit K.",
    customerPhone: "9800004444",
    items: [
      { name: "Instant Noodles", unit: "Pack of 4", price: 56, quantity: 2, subtotal: 112 },
      { name: "Pure Ghee", unit: "500 ml jar", price: 310, quantity: 1, subtotal: 310 }
    ],
    estimatedTotal: 422,
    status: "Pending",
    statusHistory: [
      { status: "Pending", at: new Date(Date.now() - 1000 * 60 * 18).toISOString() }
    ],
    notes: "Doorbell broken – please knock."
  },
  {
    id: "ORD-1005",
    createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    customerName: "Pooja D.",
    customerPhone: "9800005555",
    items: [
      { name: "Basmati Rice", unit: "1 kg pack", price: 115, quantity: 2, subtotal: 230 },
      { name: "Toor Dal", unit: "1 kg pack", price: 155, quantity: 1, subtotal: 155 }
    ],
    estimatedTotal: 385,
    status: "Ready",
    statusHistory: [
      { status: "Pending", at: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
      { status: "Confirmed", at: new Date(Date.now() - 1000 * 60 * 28).toISOString() },
      { status: "Preparing", at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
      { status: "Ready", at: new Date(Date.now() - 1000 * 60 * 3).toISOString() }
    ],
    notes: "Please pack neatly."
  },
  {
    id: "ORD-1006",
    createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    customerName: "Vikram N.",
    customerPhone: "9800006666",
    items: [
      { name: "Dishwash Liquid", unit: "500 ml bottle", price: 95, quantity: 1, subtotal: 95 }
    ],
    estimatedTotal: 95,
    status: "Cancelled",
    statusHistory: [
      { status: "Pending", at: new Date(Date.now() - 1000 * 60 * 75).toISOString() },
      { status: "Cancelled", at: new Date(Date.now() - 1000 * 60 * 68).toISOString() }
    ],
    notes: "Customer cancelled via phone."
  },
  {
    id: "ORD-1007",
    createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(), // 4 mins ago (recent pending)
    customerName: "Neha G.",
    customerPhone: "9800007777",
    items: [
      { name: "Toned Milk", unit: "500 ml pouch", price: 27, quantity: 2, subtotal: 54 },
      { name: "Whole Wheat Bread", unit: "400 g loaf", price: 45, quantity: 1, subtotal: 45 },
      { name: "Farm Fresh Eggs", unit: "Pack of 6", price: 52, quantity: 1, subtotal: 52 }
    ],
    estimatedTotal: 151,
    status: "Pending",
    statusHistory: [
      { status: "Pending", at: new Date(Date.now() - 1000 * 60 * 4).toISOString() }
    ],
    notes: "Ring bell twice."
  }
];

/**
 * Deterministic PRNG: Mulberry32
 * Ensures every reset or generation produces identical, realistic 30-day order patterns.
 */
function createPrng(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically generates 30 days of realistic quick-commerce orders.
 * Realistic morning & evening peaks, weekend lift (1.35x), low cancellation rate (~3.8%).
 */
function generateDeterministicHistory() {
  const rng = createPrng(42);
  const customers = [
    { name: "Meera S.", phone: "9800001111" },
    { name: "Rajan V.", phone: "9800002222" },
    { name: "Sunita P.", phone: "9800003333" },
    { name: "Amit K.", phone: "9800004444" },
    { name: "Pooja D.", phone: "9800005555" },
    { name: "Vikram N.", phone: "9800006666" },
    { name: "Neha G.", phone: "9800007777" },
    { name: "Rohan M.", phone: "9800008888" },
    { name: "Priya K.", phone: "9800009999" },
    { name: "Deepak R.", phone: "9800001234" },
    { name: "Ananya B.", phone: "9800002345" },
    { name: "Suresh T.", phone: "9800003456" },
    { name: "Kavita M.", phone: "9800004567" },
    { name: "Arjun S.", phone: "9800005678" }
  ];

  // Hourly weighting: Morning peak (8-10am), steady (11-1pm), afternoon lull (1-4pm), evening peak (5-9pm)
  const hourWeights = [
    { hour: 8, weight: 14 },
    { hour: 9, weight: 18 },
    { hour: 10, weight: 13 },
    { hour: 11, weight: 8 },
    { hour: 12, weight: 7 },
    { hour: 13, weight: 4 },
    { hour: 14, weight: 3 },
    { hour: 15, weight: 4 },
    { hour: 16, weight: 7 },
    { hour: 17, weight: 14 },
    { hour: 18, weight: 20 },
    { hour: 19, weight: 22 },
    { hour: 20, weight: 16 },
    { hour: 21, weight: 8 }
  ];
  const totalWeight = hourWeights.reduce((s, h) => s + h.weight, 0);

  function pickHour() {
    let roll = rng() * totalWeight;
    for (const hw of hourWeights) {
      if (roll < hw.weight) return hw.hour;
      roll -= hw.weight;
    }
    return 18;
  }

  const generatedOrders = [];
  const now = new Date();

  // Generate for past 30 days (day 30 ago down to day 1 ago)
  for (let d = 30; d >= 1; d--) {
    const targetDate = new Date(now.getTime() - d * 86400000);
    const dayOfWeek = targetDate.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const baseCount = Math.floor(10 + rng() * 5); // 10-14 weekday base
    const orderCount = isWeekend ? Math.round(baseCount * 1.35) : baseCount;

    for (let o = 0; o < orderCount; o++) {
      const cust = customers[Math.floor(rng() * customers.length)];
      const hour = pickHour();
      const minute = Math.floor(rng() * 60);
      const second = Math.floor(rng() * 60);

      const orderDate = new Date(targetDate);
      orderDate.setHours(hour, minute, second, 0);

      const itemCount = 1 + Math.floor(rng() * 3.4);
      const items = [];
      let total = 0;
      const picked = new Set();

      for (let i = 0; i < itemCount; i++) {
        let pIdx = Math.floor(rng() * DEFAULT_PRODUCTS.length);
        if (picked.has(pIdx)) continue;
        picked.add(pIdx);

        const prod = DEFAULT_PRODUCTS[pIdx];
        const qty = 1 + Math.floor(rng() * 2.2);
        const subtotal = prod.price * qty;
        total += subtotal;

        items.push({
          name: prod.name,
          category: prod.category,
          unit: prod.unit,
          price: prod.price,
          quantity: qty,
          subtotal: subtotal
        });
      }

      const isCancelled = rng() < 0.038;
      const status = isCancelled ? "Cancelled" : "Completed";
      const idNum = 700 + generatedOrders.length;
      const id = `ORD-${idNum}`;
      const isoTime = orderDate.toISOString();

      const statusHistory = [
        { status: "Pending", at: isoTime }
      ];
      if (isCancelled) {
        statusHistory.push({
          status: "Cancelled",
          at: new Date(orderDate.getTime() + 1000 * 60 * (5 + Math.floor(rng() * 10))).toISOString()
        });
      } else {
        statusHistory.push({
          status: "Confirmed",
          at: new Date(orderDate.getTime() + 1000 * 60 * 3).toISOString()
        });
        statusHistory.push({
          status: "Preparing",
          at: new Date(orderDate.getTime() + 1000 * 60 * 8).toISOString()
        });
        statusHistory.push({
          status: "Ready",
          at: new Date(orderDate.getTime() + 1000 * 60 * 18).toISOString()
        });
        statusHistory.push({
          status: "Completed",
          at: new Date(orderDate.getTime() + 1000 * 60 * 30).toISOString()
        });
      }

      generatedOrders.push({
        id,
        createdAt: isoTime,
        customerName: cust.name,
        customerPhone: cust.phone,
        items,
        estimatedTotal: total,
        status,
        statusHistory
      });
    }
  }

  // Combine with today's interactive orders
  return [...generatedOrders, ...DEFAULT_TODAY_ORDERS];
}

const DEFAULT_ORDERS = generateDeterministicHistory();

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

const SEED_VERSION_KEY = 'dukaanlite_catalog_seed_v4';

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
  if (!orders || !Array.isArray(orders) || orders.length < 20) {
    console.log("[Storage] Seeding 30-day deterministic demo orders.");
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
  
  if (!order.statusHistory || !Array.isArray(order.statusHistory) || order.statusHistory.length === 0) {
    order.statusHistory = [{ status: order.status, at: order.createdAt }];
  }
  
  orders.unshift(order); // Add newest order to the top
  const saved = safeSetItem(STORAGE_KEYS.ORDERS, orders);
  
  if (saved) {
    // Record in local my-orders list
    const myOrders = safeGetItem(STORAGE_KEYS.MY_ORDERS, []);
    if (!myOrders.includes(order.id)) {
      myOrders.unshift(order.id);
      safeSetItem(STORAGE_KEYS.MY_ORDERS, myOrders);
    }
    // Broadcast live event across open tabs
    if (typeof window !== 'undefined' && window.DukaanLive) {
      window.DukaanLive.broadcast('ORDER_CREATED', order);
    }
  }
  return saved;
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

  const now = new Date().toISOString();
  orders[orderIndex].status = newStatus;
  orders[orderIndex].updatedAt = now;
  
  if (!orders[orderIndex].statusHistory) {
    orders[orderIndex].statusHistory = [
      { status: "Pending", at: orders[orderIndex].createdAt || now }
    ];
  }
  orders[orderIndex].statusHistory.push({ status: newStatus, at: now });
  
  const saved = safeSetItem(STORAGE_KEYS.ORDERS, orders);
  if (saved && typeof window !== 'undefined' && window.DukaanLive) {
    window.DukaanLive.broadcast('ORDER_UPDATED', {
      orderId,
      newStatus,
      order: orders[orderIndex]
    });
  }
  return saved;
}

/**
 * Retrieve a single order by ID.
 * @param {string} orderId
 * @returns {Object|null}
 */
function getOrderById(orderId) {
  if (!orderId) return null;
  const orders = getOrders();
  return orders.find(o => o.id === orderId) || null;
}

/**
 * Retrieve list of orders created in this browser session.
 * @returns {Array<Object>}
 */
function getMyOrders() {
  const myIds = safeGetItem(STORAGE_KEYS.MY_ORDERS, []);
  const allOrders = getOrders();
  if (!myIds.length) {
    // If no explicit local orders saved yet, return recent orders for demonstration
    return allOrders.slice(0, 3);
  }
  return allOrders.filter(o => myIds.includes(o.id));
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
    getOrderById,
    getMyOrders,
    getActiveUser,
    setActiveUser,
    clearActiveUser,
    STORAGE_KEYS
  };
}
