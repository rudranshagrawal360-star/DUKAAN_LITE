# DukaanLite 🥬

> A hyper-local Kirana store digital catalog and order management system built with vanilla web technologies.
> Crafted following authentic Indian quick-commerce patterns (Blinkit, Zepto, Instamart) for customers, and restaurant-partner order management screens (Zomato, Swiggy partner apps) for shopkeepers.

---

## 🌟 Key Highlights & Design Principles

DukaanLite is designed strictly according to **anti-template craft principles**:
- **No generic AI templates or emoji decoration**: Uses a single cohesive iconography system via [Bootstrap Icons](https://icons.getbootstrap.com/).
- **Authentic Indian Quick-Commerce UX**: Category rail with scroll-snap and edge fades, compact shop strip with scalloped awning motif, flying arc cart animation, and mobile-first sticky bottom cart bar.
- **Shopkeeper Operations Hub**: 5-column Kanban board with auto-refreshing relative time indicators (`12m ago`), overdue alerts (>10m amber timer), single-click next-action status progression (no error-prone dropdowns), slide-in order drawer, and a full 30-day deterministic analytics dashboard.
- **Traditional "Parchi" Motif**: Dashed tear lines and notch accents used exclusively on customer order receipts, cart summary slips, and shopkeeper order cards.
- **Typographic Rigor in Inter**: `font-variant-numeric: tabular-nums` applied across every price, time stamp, KPI, and counter; strict 4-tier typographic hierarchy; WCAG 2.1 AA text contrast in both light and dark themes.

---

## 🚀 Features Breakdown

### 🛒 1. Customer Experience (`customer/`)
- **Compact Shop Strip**: Displays shop status (`Open 8:00 AM – 9:00 PM`), location, and subtle scalloped awning brand styling.
- **Sticky Search & Category Rail**: Real-time debounce search, sort selector (Relevance, Price: Low to High, Price: High to Low, Name: A to Z), and horizontal scroll-snap category filters.
- **Product Cards**: 1:1 square media area with category-tinted backdrop, flat SVG product illustrations, and dynamic unit/price display.
- **Interactive Cart & Steppers**: Adding an item triggers a smooth flying-arc animation into the cart; buttons morph into responsive `[ - 1 + ]` steppers.
- **Sticky Bottom Cart (Mobile)**: Slides up when items exist in the cart, displaying item count and subtotal for single-tap drawer access.
- **Parchi Cart Drawer (Desktop & Mobile)**: Sliding drawer styled as a grocery slip with live item subtotals, packaging notes, and instant **"Order on WhatsApp"** button.
- **Live Order Tracking (`customer/track.html`)**:
  - 5-stage visual progress stepper (`Pending` → `Confirmed` → `Preparing` → `Ready` → `Completed`, with `Cancelled` handling).
  - Microcopy aligned with real kirana expectations (*"Waiting for the shop to confirm"*, *"Send the message in WhatsApp so the shop sees it"* — no false claims of GPS or automated delivery).
  - One-tap WhatsApp chat prefilled with order details.
  - "My Orders" drawer tracking all orders placed from this browser.

### 🏪 2. Shopkeeper Administration (`shopkeeper/`)
- **Operational Sidebar**: Compact navigation with marigold active indicator, live pending orders badge, "View store" link, and dark mode toggle.
- **Order Management Hub (`shopkeeper/orders.html`)**:
  - **Board View (Default)**: 5-column Kanban board (`Pending`, `Confirmed`, `Preparing`, `Ready`, `Completed`) with column totals. Cancelled orders stored behind a clean toggle.
  - **Live Relative Timestamps**: Automatically refreshed every 30 seconds (`"2m ago"`, `"14m ago"`); orders pending for >10 minutes receive an amber badge.
  - **Single Next-Action Buttons**: Direct progression (`"Accept order"`, `"Start preparing"`, `"Mark ready"`, `"Complete"`) preventing invalid transitions.
  - **Context Actions**: `"..."` menu offering safe order cancellation (with confirmation modal) and direct WhatsApp customer messaging prefilled with status updates.
  - **Detailed Order Drawer**: Slides out from the right showing customer contact (tap-to-call), full itemized parchi slip, delivery notes, and complete ISO status timeline.
  - **List View**: Dense operational table with sticky headers, status badges, and phone-friendly card transformation.
- **Analytics Dashboard (`shopkeeper/dashboard.html`)**:
  - **Pure Vanilla Engine**: Zero third-party chart libraries — rendered entirely with responsive inline SVGs, CSS variables, and vanilla JavaScript.
  - **Dynamic Range Selector**: Toggle between `Today`, `7 days`, and `30 days` with smooth number count-up transitions.
  - **Key Performance Indicators**: Revenue, Orders count, Average Order Value (AOV), and Cancellation Rate with inline sparklines and period-over-period percentage changes.
  - **Orders & Revenue Trend**: Smooth cubic bezier SVG area chart with gradient fill, hover tooltip, keyboard focus accessibility, and an accessible data table alternative.
  - **Busiest Hours Heatmap**: 7 days × 14 hours (8:00 AM – 9:00 PM) intensity grid revealing peak order concentration.
  - **Top Sellers**: Ranked item list with proportional progress fill bars showing volume and revenue.
  - **Category Share**: SVG donut chart with central total units count and color-coded category breakdown.
  - **Order Pipeline**: Stacked proportional bar of live active orders by status.
  - **Needs Attention Widget**: Immediate alerts for pending orders older than 10 minutes and low-stock inventory.

### 🌗 3. Design System & Dark Mode Engine
- **CSS Variable Tokens**: Complete design tokens defined in `css/shared.css` (`--dl-primary`, `--dl-surface`, `--dl-forest`, `--dl-marigold`, `--dl-border`, `--dl-text`, `--dl-muted`).
- **Dark Theme (`[data-theme="dark"]`)**: Hand-tuned dark palette (`#0F1A14` background, `#16241C` surface, `#3DBE75` primary accent) achieving WCAG AA contrast ratios (10:1+ for headers, 5.4:1+ for muted body copy).
- **Zero-Flash Theme Init**: Inline `<head>` script inspects `localStorage` (`dukaanlite_theme_v1`) or system `prefers-color-scheme` before first paint, eliminating light flashes on reload.
- **Adaptive Brand Logos**: Automatically swaps between light and dark SVG brand assets.

---

## ⚡ How Live Tracking Works Across Tabs

DukaanLite operates entirely in the browser without requiring a backend server or WebSockets:
```
┌──────────────────────────────┐                ┌──────────────────────────────┐
│     Customer Catalog /       │                │      Shopkeeper Orders /     │
│         Tracking Tab         │                │        Dashboard Tab         │
└──────────────┬───────────────┘                └──────────────┬───────────────┘
               │                                               │
               │         BroadcastChannel("dukaanlite")        │
               ├───────────────────────────────────────────────┤
               │   • Event: ORDER_CREATED (new WhatsApp order) │
               │   • Event: ORDER_UPDATED (status transition)  │
               │                                               │
               ▼                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│         Fallback: window.addEventListener('storage', (e) => { ... })         │
└──────────────────────────────────────────────────────────────────────────────┘
```
1. **Primary Transport**: Uses the native browser `BroadcastChannel("dukaanlite")` API (`js/shared/live.js`).
2. **Instant Sync**: When a shopkeeper clicks *"Accept order"* or *"Mark ready"*, an `ORDER_UPDATED` event is published. If the customer has `customer/track.html` open in another tab, the stepper immediately advances with a smooth animation and updates the live status badge.
3. **Storage Fallback**: If `BroadcastChannel` is unsupported or across different browser windows, a `storage` event listener on `dukaanlite_orders_v1` triggers instant re-renders.
4. **Live Dot**: A pulsing green badge indicates that cross-tab sync is active and listening.

---

## 💾 Data Architecture & Local Storage

All data stays securely inside the browser using versioned `localStorage` keys:
| Storage Key | Purpose |
| :--- | :--- |
| `dukaanlite_products_v1` | Product catalog items (IDs, names, prices, categories, stock, units, SVG media) |
| `dukaanlite_orders_v1` | Full order history with item snapshots and `statusHistory` timestamp log |
| `dukaanlite_settings_v1` | Shop configurations (store name, tagline, WhatsApp recipient, hours, address) |
| `dukaanlite_theme_v1` | User theme preference (`"light"` or `"dark"`) |
| `dukaanlite_my_orders_v1` | List of order IDs submitted from this specific browser session |

### Deterministic History Generator
To ensure the dashboard displays realistic, beautiful analytics upon first launch, `js/shared/storage.js` incorporates a **Mulberry32 seeded PRNG** (`generateDeterministicHistory`). It synthesizes 30 days of authentic grocery orders (~400 orders) featuring:
- Morning peaks (8:00 AM – 11:00 AM) and evening spikes (5:00 PM – 8:30 PM).
- 25–40% weekend volume lift.
- Realistic 3.8% cancellation rate.
- Deterministic output: Every demo reset produces identical, repeatable data for testing.

---

## ♿ Accessibility & Standards Compliance

- **Semantic HTML5**: Native elements (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`) with single `<h1>` hierarchy per page.
- **Screen Reader Announcements**: Dedicated `aria-live="polite"` announcer regions for new incoming orders and status updates.
- **Keyboard Operability**: Full tab index flow with visible `:focus-visible` rings (2.5px solid primary accent with 2px offset). The Kanban board uses interactive `<button>` controls — never drag-only mechanics.
- **Touch-Friendly**: Minimum 44px touch targets across all interactive buttons, pills, dropdowns, and links.
- **Reduced Motion**: Complete `@media (prefers-reduced-motion: reduce)` support disabling transforms, arcs, and smooth scrolls.

---

## 🔒 Disclosures & Limitations

1. **Client-Side Prototype**: Data stays strictly inside the local browser (`localStorage`). State does not synchronize across separate physical devices or incognito sessions.
2. **WhatsApp Order Handoff**: DukaanLite formats cart items into a clean WhatsApp text template and launches `https://wa.me/<number>?text=...`. Payment, delivery logistics, and receipts are completed directly between customer and shopkeeper over WhatsApp.
3. **Demo Reset**: A *"Reset sample data"* button is available on `shopkeeper/settings.html` to return products, orders, and settings to clean factory defaults at any time.

---

## 🛠️ Local Development & Running

No build tools, bundlers, or package installations are required.

### 1. Clone the Repository
```bash
git clone https://github.com/rudranshagrawal360-star/DUKAAN_LITE.git
cd DUKAAN_LITE
```

### 2. Start a Local Server
Run any local static file server from the root directory:
```bash
# Python 3
python3 -m http.server 8085

# Or Node.js npx serve
npx serve -l 8085 .
```

### 3. Open in Browser
- **Landing / Role Selection**: [http://localhost:8085/index.html](http://localhost:8085/index.html)
- **Customer Catalog**: [http://localhost:8085/customer/catalog.html](http://localhost:8085/customer/catalog.html)
- **Shopkeeper Orders Board**: [http://localhost:8085/shopkeeper/orders.html](http://localhost:8085/shopkeeper/orders.html)
- **Shopkeeper Analytics Dashboard**: [http://localhost:8085/shopkeeper/dashboard.html](http://localhost:8085/shopkeeper/dashboard.html)
- **Shopkeeper Settings**: [http://localhost:8085/shopkeeper/settings.html](http://localhost:8085/shopkeeper/settings.html)
