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

// 3. Realistic seed products with authentic studio photography from stitch datasets
const DEFAULT_PRODUCTS = [
  // Dairy & Breakfast
  { id: "P001", name: "Amul Taaza Toned Fresh Milk", category: "Dairy & Breakfast", price: 27, unit: "500 ml pouch", image: "assets/products/amul_milk.jpg", available: true, stockQuantity: 30, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P002", name: "Amul Pure Ghee Jar", category: "Dairy & Breakfast", price: 310, unit: "500 ml glass jar", image: "assets/products/amul_ghee.jpg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Atta, Rice & Dal
  { id: "P003", name: "Aashirvaad Shudh Chakki Atta", category: "Atta, Rice & Dal", price: 245, unit: "5 kg bag", image: "assets/products/aashirvaad_atta.jpg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P004", name: "India Gate Feast Rozzana Basmati Rice", category: "Atta, Rice & Dal", price: 85, unit: "500 g pouch", image: "assets/products/india_gate_rice.jpg", available: true, stockQuantity: 18, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P005", name: "Tata Sampann Unpolished Toor Dal", category: "Atta, Rice & Dal", price: 175, unit: "1 kg pouch", image: "assets/products/tata_toor_dal.jpg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Oils, Masalas & Spices
  { id: "P006", name: "Fortune Sunlite Refined Sunflower Oil", category: "Oils, Masalas & Spices", price: 140, unit: "1 L pouch", image: "assets/products/fortune_sunflower_oil.jpg", available: true, stockQuantity: 16, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P007", name: "Fortune Premium Kachi Ghani Mustard Oil", category: "Oils, Masalas & Spices", price: 155, unit: "1 L bottle", image: "assets/products/fortune_mustard_oil.jpg", available: true, stockQuantity: 12, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P008", name: "Tata Salt Vacuum Evaporated Iodized", category: "Oils, Masalas & Spices", price: 28, unit: "1 kg pack", image: "assets/products/tata_salt.jpg", available: true, stockQuantity: 40, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P009", name: "Everest Garam Masala Spice Blend", category: "Oils, Masalas & Spices", price: 82, unit: "100 g box", image: "assets/products/everest_garam_masala.jpg", available: true, stockQuantity: 22, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P010", name: "MDH Deggi Mirch Red Chilli Powder", category: "Oils, Masalas & Spices", price: 95, unit: "100 g tin", image: "assets/products/mdh_deggi_mirch.jpg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Snacks & Biscuits
  { id: "P011", name: "Maggi 2-Minute Masala Noodles", category: "Snacks & Biscuits", price: 56, unit: "Pack of 4 (280 g)", image: "assets/products/maggi_noodles.jpg", available: true, stockQuantity: 25, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P012", name: "Parle-G Gold Glucose Biscuits", category: "Snacks & Biscuits", price: 15, unit: "100 g pack", image: "assets/products/parle_g_gold.jpg", available: true, stockQuantity: 45, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P013", name: "Britannia Good Day Rich Cashew Cookies", category: "Snacks & Biscuits", price: 35, unit: "200 g pack", image: "assets/products/good_day_cookies.jpg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P014", name: "Britannia Bourbon Chocolate Cream Biscuits", category: "Snacks & Biscuits", price: 30, unit: "150 g pack", image: "assets/products/britannia_bourbon.jpg", available: true, stockQuantity: 24, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P015", name: "Oreo Original Vanilla Creme Biscuits", category: "Snacks & Biscuits", price: 40, unit: "120 g pack", image: "assets/products/oreo_biscuits.jpg", available: true, stockQuantity: 18, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P016", name: "Haldiram's Nagpur Aloo Bhujia", category: "Snacks & Biscuits", price: 48, unit: "150 g pouch", image: "assets/products/haldirams_bhujia.jpg", available: true, stockQuantity: 15, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Chocolates & Sweets
  { id: "P017", name: "Cadbury Dairy Milk Chocolate", category: "Chocolates & Sweets", price: 45, unit: "52 g bar", image: "assets/products/dairy_milk_chocolate.jpg", available: true, stockQuantity: 16, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P018", name: "Nestle KitKat 4 Finger Chocolate Bar", category: "Chocolates & Sweets", price: 25, unit: "38 g bar", image: "assets/products/kitkat_chocolate.jpg", available: false, stockQuantity: 0, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Tea, Coffee & Drinks
  { id: "P019", name: "Tata Tea Gold Rich Aroma", category: "Tea, Coffee & Drinks", price: 260, unit: "500 g pouch", image: "assets/products/tata_tea_gold.jpg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P020", name: "Brooke Bond Red Label Strong Tea", category: "Tea, Coffee & Drinks", price: 145, unit: "250 g box", image: "assets/products/red_label_tea.jpg", available: true, stockQuantity: 12, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P021", name: "Nescafe Classic Instant Coffee Jar", category: "Tea, Coffee & Drinks", price: 165, unit: "50 g glass jar", image: "assets/products/nescafe_coffee.jpg", available: true, stockQuantity: 10, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Bath & Personal Care
  { id: "P022", name: "Dettol Original Bathing Soap Bar", category: "Bath & Personal Care", price: 36, unit: "125 g bar", image: "assets/products/dettol_soap.jpg", available: true, stockQuantity: 20, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P023", name: "Clinic Plus Strong & Long Shampoo", category: "Bath & Personal Care", price: 120, unit: "340 ml bottle", image: "assets/products/clinic_plus_shampoo.jpg", available: true, stockQuantity: 25, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P024", name: "Colgate Strong Teeth Dental Cream", category: "Bath & Personal Care", price: 55, unit: "150 g tube", image: "assets/products/colgate_toothpaste.jpg", available: true, stockQuantity: 11, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Cleaning & Household
  { id: "P025", name: "Surf Excel Quick Wash Detergent Powder", category: "Cleaning & Household", price: 135, unit: "1 kg carton", image: "assets/products/surf_excel.jpg", available: true, stockQuantity: 14, updatedAt: "2026-11-23T08:00:00.000Z" },
  { id: "P026", name: "Vim Dishwash Bar with Lemon", category: "Cleaning & Household", price: 20, unit: "300 g bar", image: "assets/products/vim_bar.jpg", available: true, stockQuantity: 35, updatedAt: "2026-11-23T08:00:00.000Z" },

  // Fresh Fruits
  { id: "P027", name: "Fresh Ratnagiri Alphonso Mangoes", category: "Fresh Fruits", price: 600, unit: "1 Dozen Box (12 pcs)", image: "assets/products/alphonso_mangoes.jpg", available: false, stockQuantity: 0, updatedAt: "2026-11-23T08:00:00.000Z" }
];

// 4. Fictional Demo Orders (authentic packaging item names, fake phone numbers)
const DEFAULT_TODAY_ORDERS = [
  {
    id: "ORD-1001",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    customerName: "Meera S.",
    customerPhone: "9800001111",
    items: [
      { name: "Amul Taaza Toned Fresh Milk", unit: "500 ml pouch", price: 27, quantity: 2, subtotal: 54 },
      { name: "Parle-G Gold Glucose Biscuits", unit: "100 g pack", price: 15, quantity: 2, subtotal: 30 }
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
      { name: "Aashirvaad Shudh Chakki Atta", unit: "5 kg bag", price: 245, quantity: 1, subtotal: 245 },
      { name: "Fortune Sunlite Refined Sunflower Oil", unit: "1 L pouch", price: 140, quantity: 1, subtotal: 140 },
      { name: "Tata Salt Vacuum Evaporated Iodized", unit: "1 kg pack", price: 28, quantity: 1, subtotal: 28 }
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
      { name: "Tata Tea Gold Rich Aroma", unit: "500 g pouch", price: 260, quantity: 1, subtotal: 260 },
      { name: "Britannia Good Day Rich Cashew Cookies", unit: "200 g pack", price: 35, quantity: 2, subtotal: 70 }
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
      { name: "Maggi 2-Minute Masala Noodles", unit: "Pack of 4", price: 56, quantity: 2, subtotal: 112 },
      { name: "Amul Pure Ghee Jar", unit: "500 ml jar", price: 310, quantity: 1, subtotal: 310 }
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
      { name: "India Gate Feast Rozzana Basmati Rice", unit: "500 g pouch", price: 85, quantity: 2, subtotal: 170 },
      { name: "Tata Sampann Unpolished Toor Dal", unit: "1 kg pouch", price: 175, quantity: 1, subtotal: 175 }
    ],
    estimatedTotal: 345,
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
      { name: "Vim Dishwash Bar with Lemon", unit: "300 g bar", price: 20, quantity: 2, subtotal: 40 }
    ],
    estimatedTotal: 40,
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
      { name: "Amul Taaza Toned Fresh Milk", unit: "500 ml pouch", price: 27, quantity: 2, subtotal: 54 },
      { name: "Cadbury Dairy Milk Chocolate", unit: "52 g bar", price: 45, quantity: 1, subtotal: 45 },
      { name: "Maggi 2-Minute Masala Noodles", unit: "Pack of 4", price: 56, quantity: 1, subtotal: 56 }
    ],
    estimatedTotal: 155,
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

const SEED_VERSION_KEY = 'dukaanlite_catalog_seed_v6';

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
 * Add a new product to the catalog.
 * @param {Object} product - Product properties
 * @returns {Object|null} The saved product object or null on error
 */
function addProduct(product) {
  if (!product || !product.name || typeof product.price !== 'number' || product.price <= 0) {
    console.error("[Storage] addProduct: Invalid product details.");
    return null;
  }
  const products = getProducts();
  const nextNum = products.reduce((max, p) => {
    const num = parseInt(String(p.id).replace(/\D/g, ''), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0) + 1;
  const newId = `P${String(nextNum).padStart(3, '0')}`;
  
  const newProduct = {
    id: newId,
    name: product.name.trim(),
    category: product.category || 'General',
    price: Math.round(product.price),
    unit: product.unit || '1 unit',
    image: product.image || 'assets/products/svg/p001.svg',
    available: product.available !== false,
    stockQuantity: typeof product.stockQuantity === 'number' ? Math.max(0, product.stockQuantity) : 20,
    updatedAt: new Date().toISOString()
  };

  products.push(newProduct);
  const success = saveProducts(products);
  if (success) {
    if (typeof window !== 'undefined' && window.DukaanLive) {
      const fn = window.DukaanLive.broadcast || window.DukaanLive.publish;
      if (typeof fn === 'function') fn('CATALOG_UPDATED', { action: 'ADD', product: newProduct });
    }
    return newProduct;
  }
  return null;
}

/**
 * Update an existing product.
 * @param {string} id - Product identifier
 * @param {Object} updates - Updated properties
 * @returns {boolean} True if successfully updated
 */
function updateProduct(id, updates) {
  const products = getProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return false;

  products[idx] = {
    ...products[idx],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  const success = saveProducts(products);
  if (success && typeof window !== 'undefined' && window.DukaanLive) {
    const fn = window.DukaanLive.broadcast || window.DukaanLive.publish;
    if (typeof fn === 'function') fn('CATALOG_UPDATED', { action: 'UPDATE', product: products[idx] });
  }
  return success;
}

/**
 * Delete a product from the catalog.
 * @param {string} id - Product identifier
 * @returns {boolean} True if successfully deleted
 */
function deleteProduct(id) {
  const products = getProducts();
  const filtered = products.filter(p => p.id !== id);
  if (filtered.length === products.length) return false;

  const success = saveProducts(filtered);
  if (success && typeof window !== 'undefined' && window.DukaanLive) {
    const fn = window.DukaanLive.broadcast || window.DukaanLive.publish;
    if (typeof fn === 'function') fn('CATALOG_UPDATED', { action: 'DELETE', productId: id });
  }
  return success;
}

/**
 * Get product by ID.
 * @param {string} id
 * @returns {Object|null}
 */
function getProductById(id) {
  const products = getProducts();
  return products.find(p => p.id === id) || null;
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
    localStorage.removeItem(STORAGE_KEYS.MY_ORDERS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    
    // Re-seed defaults immediately
    safeSetItem(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    safeSetItem(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS);
    safeSetItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    try {
      localStorage.setItem(SEED_VERSION_KEY, 'true');
    } catch (e) {}
    console.log("[Storage] Demo data successfully reset to clean defaults.");
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
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
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
