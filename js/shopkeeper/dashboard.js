/**
 * DukaanLite — Shopkeeper Dashboard Analytics Engine (js/shopkeeper/dashboard.js)
 * ----------------------------------------------------------------------------
 * Derives all analytics, KPIs, trends, heatmaps, pipeline, and top sellers
 * dynamically at render time from saved orders. Pure vanilla JS and inline SVG.
 */

(function () {
  'use strict';

  // State
  let activeRange = '7days'; // 'today' | '7days' | '30days'
  let trendMetric = 'revenue'; // 'revenue' | 'orders'
  let currentKpiValues = { revenue: 0, orders: 0, aov: 0, cancelRate: 0 };

  const CATEGORY_COLORS = {
    'Dairy & Breakfast': '#0A7D3E',
    'Atta, Rice & Dal': '#F4AA2E',
    'Oils, Masalas & Spices': '#DC2626',
    'Snacks & Biscuits': '#8B5CF6',
    'Chocolates & Sweets': '#D946EF',
    'Tea, Coffee & Drinks': '#0284C7',
    'Bath & Personal Care': '#EC4899',
    'Cleaning & Household': '#059669',
    'Fresh Fruits': '#10B981',
    'Other': '#6B7280'
  };

  /* --------------------------------------------------------------------------
     Initialization
     -------------------------------------------------------------------------- */
  function init() {
    if (window.DukaanTheme) DukaanTheme.init();

    setupControls();
    setupLiveListener();
    renderDashboard();
  }

  function setupControls() {
    // Range switcher buttons
    document.querySelectorAll('.dl-range-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dl-range-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        activeRange = e.currentTarget.getAttribute('data-range');
        renderDashboard();
      });
    });

    // Trend metric switcher
    document.querySelectorAll('.dl-chart-metric-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dl-chart-metric-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        trendMetric = e.currentTarget.getAttribute('data-metric');
        renderTrendChart();
      });
    });
  }

  function setupLiveListener() {
    if (window.DukaanLive) {
      window.DukaanLive.subscribe((event) => {
        if (event === 'ORDER_CREATED' || event === 'ORDER_UPDATED') {
          renderDashboard();
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     Filter Orders by Active Range & Previous Comparison Range
     -------------------------------------------------------------------------- */
  function getOrdersForRange(orders, range) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let currentOrders = [];
    let prevOrders = [];

    if (range === 'today') {
      const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
      currentOrders = orders.filter(o => new Date(o.createdAt).getTime() >= startOfToday.getTime());
      prevOrders = orders.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= startOfYesterday.getTime() && t < startOfToday.getTime();
      });
    } else if (range === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
      currentOrders = orders.filter(o => new Date(o.createdAt).getTime() >= sevenDaysAgo.getTime());
      prevOrders = orders.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= fourteenDaysAgo.getTime() && t < sevenDaysAgo.getTime();
      });
    } else { // 30days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
      currentOrders = orders.filter(o => new Date(o.createdAt).getTime() >= thirtyDaysAgo.getTime());
      prevOrders = orders.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= sixtyDaysAgo.getTime() && t < thirtyDaysAgo.getTime();
      });
    }

    return { currentOrders, prevOrders };
  }

  /* --------------------------------------------------------------------------
     Main Render Loop
     -------------------------------------------------------------------------- */
  function renderDashboard() {
    const orders = DukaanStorage.getOrders();
    const products = DukaanStorage.getProducts();

    const { currentOrders, prevOrders } = getOrdersForRange(orders, activeRange);

    renderNeedsAttention(orders, products);
    renderKpiRow(currentOrders, prevOrders);
    renderPipelineBar(orders);
    renderTrendChart();
    renderBusiestHoursHeatmap(orders);
    renderTopSellers(currentOrders);
    renderCategoryShare(currentOrders);
  }

  /* --------------------------------------------------------------------------
     1. Needs Attention Triage Section
     -------------------------------------------------------------------------- */
  function renderNeedsAttention(allOrders, products) {
    const container = document.getElementById('dl-attention-items-grid');
    const wrap = document.getElementById('dl-attention-card');
    if (!container || !wrap) return;

    const attentionItems = [];

    // Check overdue pending (> 10m)
    const overduePending = allOrders.filter(o => 
      o.status === 'Pending' && (Date.now() - new Date(o.createdAt).getTime() > 10 * 60 * 1000)
    );
    if (overduePending.length > 0) {
      const topOverdue = overduePending[0];
      const mins = Math.floor((Date.now() - new Date(topOverdue.createdAt).getTime()) / 60000);
      attentionItems.push({
        urgent: true,
        icon: 'bi-clock-history text-warning',
        text: `Order <strong>#${topOverdue.id}</strong> waiting for ${mins} min`,
        actionLabel: 'Accept order →',
        actionUrl: 'orders.html'
      });
    }

    // Check unavailable products
    const unavailable = products.filter(p => !p.available || p.stockQuantity === 0);
    if (unavailable.length > 0) {
      const p = unavailable[0];
      attentionItems.push({
        urgent: false,
        icon: 'bi-exclamation-circle text-danger',
        text: `<strong>${DukaanUI.escapeHtml(p.name)}</strong> is out of stock`,
        actionLabel: 'Restock →',
        actionUrl: 'products.html'
      });
    }

    // Check low stock products (<= 12 units)
    const lowStock = products.filter(p => p.available && p.stockQuantity > 0 && p.stockQuantity <= 12);
    if (lowStock.length > 0) {
      const p = lowStock[0];
      attentionItems.push({
        urgent: false,
        icon: 'bi-box-seam text-warning',
        text: `<strong>${DukaanUI.escapeHtml(p.name)}</strong> running low (${p.stockQuantity} left)`,
        actionLabel: 'Update stock →',
        actionUrl: 'products.html'
      });
    }

    if (attentionItems.length === 0) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';
    container.innerHTML = attentionItems.map(item => `
      <div class="dl-attention-item ${item.urgent ? 'urgent' : ''}">
        <div class="dl-attention-item-text">
          <i class="bi ${item.icon}"></i>
          <span>${item.text}</span>
        </div>
        <a href="${item.actionUrl}" class="dl-attention-item-action">${item.actionLabel}</a>
      </div>
    `).join('');
  }

  /* --------------------------------------------------------------------------
     2. KPI Row with Animated Numbers & Sparklines
     -------------------------------------------------------------------------- */
  function renderKpiRow(currentOrders, prevOrders) {
    // Current period metrics
    const validCurrent = currentOrders.filter(o => o.status !== 'Cancelled');
    const revenue = validCurrent.reduce((s, o) => s + Number(o.estimatedTotal || 0), 0);
    const orderCount = currentOrders.length;
    const aov = validCurrent.length > 0 ? Math.round(revenue / validCurrent.length) : 0;
    const cancelCount = currentOrders.filter(o => o.status === 'Cancelled').length;
    const cancelRate = orderCount > 0 ? Number(((cancelCount / orderCount) * 100).toFixed(1)) : 0;

    // Previous period metrics
    const validPrev = prevOrders.filter(o => o.status !== 'Cancelled');
    const prevRevenue = validPrev.reduce((s, o) => s + Number(o.estimatedTotal || 0), 0);
    const prevOrderCount = prevOrders.length;
    const prevAov = validPrev.length > 0 ? Math.round(prevRevenue / validPrev.length) : 0;
    const prevCancelCount = prevOrders.filter(o => o.status === 'Cancelled').length;
    const prevCancelRate = prevOrderCount > 0 ? Number(((prevCancelCount / prevOrderCount) * 100).toFixed(1)) : 0;

    // Calculate % changes
    const revChange = calcPctChange(revenue, prevRevenue);
    const orderChange = calcPctChange(orderCount, prevOrderCount);
    const aovChange = calcPctChange(aov, prevAov);
    const cancelChange = Number((cancelRate - prevCancelRate).toFixed(1));

    // Animate KPI numbers
    animateValue('kpi-revenue-val', currentKpiValues.revenue, revenue, '₹');
    animateValue('kpi-orders-val', currentKpiValues.orders, orderCount, '');
    animateValue('kpi-aov-val', currentKpiValues.aov, aov, '₹');
    animateValue('kpi-cancel-val', currentKpiValues.cancelRate, cancelRate, '', '%');

    currentKpiValues = { revenue, orders: orderCount, aov, cancelRate };

    // Update badges
    updateKpiBadge('kpi-revenue-badge', revChange, false);
    updateKpiBadge('kpi-orders-badge', orderChange, false);
    updateKpiBadge('kpi-aov-badge', aovChange, false);
    updateKpiBadge('kpi-cancel-badge', cancelChange, true); // For cancel rate, negative is positive

    // Render tiny sparklines
    renderKpiSparkline('kpi-revenue-sparkline', getDailySeries(currentOrders, 'revenue'), '#0A7D3E');
    renderKpiSparkline('kpi-orders-sparkline', getDailySeries(currentOrders, 'orders'), '#0284C7');
    renderKpiSparkline('kpi-aov-sparkline', getDailySeries(currentOrders, 'aov'), '#F4AA2E');
    renderKpiSparkline('kpi-cancel-sparkline', getDailySeries(currentOrders, 'cancel'), '#DC2626');
  }

  function calcPctChange(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  function updateKpiBadge(id, changeVal, invertPolarity = false) {
    const el = document.getElementById(id);
    if (!el) return;

    const isGood = invertPolarity ? changeVal <= 0 : changeVal >= 0;
    const sign = changeVal > 0 ? '+' : '';
    const arrow = changeVal >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right';

    el.className = `dl-kpi-badge ${isGood ? 'positive' : 'negative'}`;
    el.innerHTML = `<i class="bi ${arrow}"></i> ${sign}${changeVal}%`;
  }

  function animateValue(id, start, end, prefix = '', suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;

    const duration = 400;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuad
      const eased = 1 - (1 - progress) * (1 - progress);
      const val = Math.round(start + (end - start) * eased);
      el.textContent = `${prefix}${val.toLocaleString('en-IN')}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = `${prefix}${end.toLocaleString('en-IN')}${suffix}`;
      }
    }

    requestAnimationFrame(step);
  }

  function getDailySeries(orders, metric) {
    const days = activeRange === 'today' ? 12 : (activeRange === '7days' ? 7 : 30);
    const series = new Array(days).fill(0);

    const now = Date.now();
    const bucketDuration = activeRange === 'today' ? 3600000 : 86400000;

    orders.forEach(o => {
      const diff = now - new Date(o.createdAt).getTime();
      const idx = Math.floor(diff / bucketDuration);
      if (idx >= 0 && idx < days) {
        const slot = days - 1 - idx;
        if (metric === 'revenue' && o.status !== 'Cancelled') {
          series[slot] += Number(o.estimatedTotal || 0);
        } else if (metric === 'orders') {
          series[slot] += 1;
        } else if (metric === 'cancel' && o.status === 'Cancelled') {
          series[slot] += 1;
        } else if (metric === 'aov') {
          series[slot] += Number(o.estimatedTotal || 0);
        }
      }
    });

    return series;
  }

  function renderKpiSparkline(svgId, dataSeries, strokeColor) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const w = 90;
    const h = 26;
    const max = Math.max(...dataSeries, 1);
    const min = 0;

    const points = dataSeries.map((v, i) => {
      const x = (i / (dataSeries.length - 1 || 1)) * w;
      const y = h - ((v - min) / (max - min)) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    svg.innerHTML = `
      <polyline 
        fill="none" 
        stroke="${strokeColor}" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        points="${points.join(' ')}" />
    `;
  }

  /* --------------------------------------------------------------------------
     3. Active Orders Pipeline
     -------------------------------------------------------------------------- */
  function renderPipelineBar(allOrders) {
    const barEl = document.getElementById('dl-pipeline-bar');
    const totalEl = document.getElementById('pipeline-total-count');
    if (!barEl) return;

    // Filter to active / current day orders
    const todayOrders = allOrders.filter(o => {
      const diff = Date.now() - new Date(o.createdAt).getTime();
      return diff < 86400000;
    });

    const counts = {
      'Pending': todayOrders.filter(o => o.status === 'Pending').length,
      'Confirmed': todayOrders.filter(o => o.status === 'Confirmed').length,
      'Preparing': todayOrders.filter(o => o.status === 'Preparing').length,
      'Ready': todayOrders.filter(o => o.status === 'Ready').length,
      'Completed': todayOrders.filter(o => o.status === 'Completed').length
    };

    const total = Object.values(counts).reduce((s, c) => s + c, 0) || 1;
    if (totalEl) totalEl.textContent = `${total} order${total === 1 ? '' : 's'} in pipeline`;

    barEl.innerHTML = Object.entries(counts).map(([status, count]) => {
      const pct = Math.round((count / total) * 100);
      if (pct === 0) return '';
      return `
        <div class="dl-pipeline-seg seg-${status.toLowerCase()}" 
             style="width: ${pct}%;" 
             title="${status}: ${count} (${pct}%)"
             aria-label="${status}: ${count} orders">
          ${pct >= 14 ? `${status} ${count}` : count}
        </div>
      `;
    }).join('');
  }

  /* --------------------------------------------------------------------------
     4. Orders & Revenue Trend (Smooth Area Chart with Hover & Keyboard Focus)
     -------------------------------------------------------------------------- */
  function renderTrendChart() {
    const orders = DukaanStorage.getOrders();
    const { currentOrders } = getOrdersForRange(orders, activeRange);

    const svg = document.getElementById('dl-trend-svg');
    const tableBody = document.getElementById('trend-accessible-tbody');
    const tooltip = document.getElementById('dl-chart-floating-tooltip');
    if (!svg) return;

    const numBuckets = activeRange === 'today' ? 14 : (activeRange === '7days' ? 7 : 30);
    const buckets = [];

    const now = new Date();
    if (activeRange === 'today') {
      // 8 AM to 9 PM
      for (let h = 8; h <= 21; h++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0);
        buckets.push({
          date: d,
          label: `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`,
          revenue: 0,
          orders: 0
        });
      }
      currentOrders.forEach(o => {
        const h = new Date(o.createdAt).getHours();
        const b = buckets.find(b => b.date.getHours() === h);
        if (b) {
          b.orders++;
          if (o.status !== 'Cancelled') b.revenue += Number(o.estimatedTotal || 0);
        }
      });
    } else {
      // Daily buckets
      for (let i = numBuckets - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        buckets.push({
          date: d,
          label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          revenue: 0,
          orders: 0
        });
      }
      currentOrders.forEach(o => {
        const oDate = new Date(o.createdAt);
        const b = buckets.find(b => 
          b.date.getDate() === oDate.getDate() && b.date.getMonth() === oDate.getMonth()
        );
        if (b) {
          b.orders++;
          if (o.status !== 'Cancelled') b.revenue += Number(o.estimatedTotal || 0);
        }
      });
    }

    const svgW = 800;
    const svgH = 240;
    const padX = 50;
    const padY = 30;

    const values = buckets.map(b => trendMetric === 'revenue' ? b.revenue : b.orders);
    const maxVal = Math.max(...values, trendMetric === 'revenue' ? 1000 : 5);

    // Calculate coordinates
    const points = buckets.map((b, i) => {
      const x = padX + (i / (buckets.length - 1)) * (svgW - 2 * padX);
      const val = trendMetric === 'revenue' ? b.revenue : b.orders;
      const y = (svgH - padY) - (val / maxVal) * (svgH - 2 * padY);
      return { x, y, bucket: b, val };
    });

    // Smooth spline path
    const linePath = buildSmoothPath(points);
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${svgH - padY} L ${points[0].x} ${svgH - padY} Z`;

    // Horizontal gridlines & Y labels
    const gridRows = 4;
    let gridHtml = '';
    for (let r = 0; r <= gridRows; r++) {
      const gy = (svgH - padY) - (r / gridRows) * (svgH - 2 * padY);
      const rowVal = Math.round((r / gridRows) * maxVal);
      const label = trendMetric === 'revenue' ? `₹${rowVal.toLocaleString('en-IN')}` : rowVal;
      gridHtml += `
        <line x1="${padX}" y1="${gy}" x2="${svgW - padX}" y2="${gy}" class="dl-chart-gridline" />
        <text x="${padX - 8}" y="${gy + 4}" text-anchor="end" class="dl-chart-axis-label">${label}</text>
      `;
    }

    // X-axis labels (skip intermediate labels on mobile/dense ranges)
    let xLabelsHtml = '';
    const stepLabel = numBuckets > 15 ? 4 : (numBuckets > 8 ? 2 : 1);
    points.forEach((p, idx) => {
      if (idx % stepLabel === 0 || idx === points.length - 1) {
        xLabelsHtml += `
          <text x="${p.x}" y="${svgH - 8}" text-anchor="middle" class="dl-chart-axis-label">${p.bucket.label}</text>
        `;
      }
    });

    // Data points for hover & keyboard focus
    const pointsHtml = points.map((p, idx) => `
      <circle cx="${p.x}" cy="${p.y}" r="4" 
              class="dl-chart-data-point" 
              tabindex="0"
              role="graphics-symbol"
              aria-label="${p.bucket.label}: ${trendMetric === 'revenue' ? '₹' + p.val.toLocaleString('en-IN') : p.val + ' orders'}"
              data-idx="${idx}" />
    `).join('');

    svg.innerHTML = `
      <defs>
        <linearGradient id="dlTrendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--dl-primary)" stop-opacity="0.32" />
          <stop offset="100%" stop-color="var(--dl-primary)" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      ${gridHtml}
      ${xLabelsHtml}
      <path d="${areaPath}" class="dl-chart-area-path" />
      <path d="${linePath}" class="dl-chart-line-path" />
      ${pointsHtml}
    `;

    // Accessible Table representation
    if (tableBody) {
      tableBody.innerHTML = buckets.map(b => `
        <tr>
          <td>${b.label}</td>
          <td>₹${b.revenue.toLocaleString('en-IN')}</td>
          <td>${b.orders}</td>
        </tr>
      `).join('');
    }

    // Attach hover & keyboard focus interactions
    const container = svg.parentElement;
    svg.querySelectorAll('.dl-chart-data-point').forEach(pt => {
      function showTip() {
        const idx = pt.getAttribute('data-idx');
        const p = points[idx];
        if (!tooltip || !p) return;

        tooltip.innerHTML = `
          <strong>${p.bucket.label}</strong><br>
          Revenue: ₹${p.bucket.revenue.toLocaleString('en-IN')}<br>
          Orders: ${p.bucket.orders}
        `;
        const pctX = (p.x / svgW) * 100;
        const pctY = (p.y / svgH) * 100;
        tooltip.style.left = `${pctX}%`;
        tooltip.style.top = `${pctY}%`;
        tooltip.classList.add('active');
      }

      function hideTip() {
        if (tooltip) tooltip.classList.remove('active');
      }

      pt.addEventListener('mouseenter', showTip);
      pt.addEventListener('focus', showTip);
      pt.addEventListener('mouseleave', hideTip);
      pt.addEventListener('blur', hideTip);
    });
  }

  function buildSmoothPath(points) {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    return d;
  }

  /* --------------------------------------------------------------------------
     5. Busiest Hours Heatmap Grid (7 Days x 8am to 9pm)
     -------------------------------------------------------------------------- */
  function renderBusiestHoursHeatmap(allOrders) {
    const tbody = document.getElementById('dl-heatmap-tbody');
    const headerRow = document.getElementById('dl-heatmap-header-row');
    if (!tbody || !headerRow) return;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

    // Build header hours (8a to 9p)
    headerRow.innerHTML = `
      <th class="dl-heatmap-th-day">Day</th>
      ${hours.map(h => `
        <th class="dl-heatmap-th-hour">${h > 12 ? h - 12 : h}${h >= 12 ? 'p' : 'a'}</th>
      `).join('')}
    `;

    // Map orders into 7 x 14 grid
    // Day index: Monday = 0, Sunday = 6
    const matrix = Array.from({ length: 7 }, () => Array(14).fill(0));
    const revenueMatrix = Array.from({ length: 7 }, () => Array(14).fill(0));

    allOrders.forEach(o => {
      const d = new Date(o.createdAt);
      let dayIdx = d.getDay() - 1; // 0 = Mon, 6 = Sun
      if (dayIdx === -1) dayIdx = 6; // Sunday was 0, now 6

      const hr = d.getHours();
      const hrIdx = hr - 8;
      if (dayIdx >= 0 && dayIdx < 7 && hrIdx >= 0 && hrIdx < 14) {
        matrix[dayIdx][hrIdx]++;
        if (o.status !== 'Cancelled') {
          revenueMatrix[dayIdx][hrIdx] += Number(o.estimatedTotal || 0);
        }
      }
    });

    let maxCount = 1;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 14; c++) {
        if (matrix[r][c] > maxCount) maxCount = matrix[r][c];
      }
    }

    // Render 7 rows
    tbody.innerHTML = days.map((dayName, r) => {
      const cellsHtml = hours.map((hour, c) => {
        const count = matrix[r][c];
        const rev = revenueMatrix[r][c];
        const intensity = count > 0 ? 0.15 + 0.85 * (count / maxCount) : 0.03;
        const hrLabel = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
        const tooltip = `${dayName} ${hrLabel}: ${count} order${count === 1 ? '' : 's'} (₹${rev.toLocaleString('en-IN')})`;

        return `
          <td class="dl-heatmap-cell"
              style="background-color: rgba(10, 125, 62, ${intensity.toFixed(2)});"
              title="${tooltip}"
              tabindex="0"
              role="gridcell"
              aria-label="${tooltip}">
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td class="dl-heatmap-th-day">${dayName}</td>
          ${cellsHtml}
        </tr>
      `;
    }).join('');
  }

  /* --------------------------------------------------------------------------
     6. Top Sellers Ranked List with Proportional Bars
     -------------------------------------------------------------------------- */
  function renderTopSellers(currentOrders) {
    const container = document.getElementById('dl-top-sellers-list');
    if (!container) return;

    // Aggregate items across non-cancelled orders
    const itemMap = {};
    currentOrders.filter(o => o.status !== 'Cancelled').forEach(o => {
      (o.items || []).forEach(item => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            name: item.name,
            category: item.category || 'General',
            units: 0,
            revenue: 0
          };
        }
        itemMap[item.name].units += Number(item.quantity || 1);
        itemMap[item.name].revenue += Number(item.subtotal || item.price * item.quantity || 0);
      });
    });

    const ranked = Object.values(itemMap).sort((a, b) => b.units - a.units).slice(0, 5);

    if (ranked.length === 0) {
      container.innerHTML = `<div class="text-dl-muted small py-3 text-center">No orders in selected range</div>`;
      return;
    }

    const maxUnits = ranked[0].units || 1;

    container.innerHTML = ranked.map((item, idx) => {
      const pct = Math.round((item.units / maxUnits) * 100);
      return `
        <div class="dl-seller-row">
          <div class="dl-seller-info-row">
            <div class="dl-seller-rank-name">
              <span class="dl-seller-rank">#${idx + 1}</span>
              <span>${DukaanUI.escapeHtml(item.name)}</span>
            </div>
            <div class="dl-seller-stats">
              <strong>${item.units} units</strong> · ₹${item.revenue.toLocaleString('en-IN')}
            </div>
          </div>
          <div class="dl-seller-bar-track">
            <div class="dl-seller-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* --------------------------------------------------------------------------
     7. Category Share Donut Chart with Legend
     -------------------------------------------------------------------------- */
  function renderCategoryShare(currentOrders) {
    const svg = document.getElementById('dl-donut-svg');
    const legend = document.getElementById('dl-donut-legend');
    const centerVal = document.getElementById('dl-donut-center-val');
    if (!svg || !legend) return;

    // Aggregate items by category
    const catMap = {};
    let totalUnits = 0;

    currentOrders.filter(o => o.status !== 'Cancelled').forEach(o => {
      (o.items || []).forEach(item => {
        const cat = item.category || 'Other';
        const qty = Number(item.quantity || 1);
        catMap[cat] = (catMap[cat] || 0) + qty;
        totalUnits += qty;
      });
    });

    if (totalUnits === 0) {
      svg.innerHTML = '<circle cx="80" cy="80" r="54" fill="none" stroke="var(--dl-border)" stroke-width="20" />';
      legend.innerHTML = '<div class="text-dl-muted small py-2">No category data</div>';
      if (centerVal) centerVal.textContent = '0';
      return;
    }

    if (centerVal) centerVal.textContent = totalUnits.toLocaleString('en-IN');

    // Calculate arcs
    const radius = 54;
    const circumference = 2 * Math.PI * radius; // ~339.29
    let accumulatedOffset = 0;

    const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const circlesHtml = entries.map(([category, count]) => {
      const ratio = count / totalUnits;
      const strokeLength = ratio * circumference;
      const strokeColor = CATEGORY_COLORS[category] || '#0A7D3E';
      const offset = accumulatedOffset;
      accumulatedOffset += strokeLength;

      return `
        <circle cx="80" cy="80" r="${radius}"
                fill="none"
                stroke="${strokeColor}"
                stroke-width="22"
                stroke-dasharray="${strokeLength.toFixed(2)} ${circumference.toFixed(2)}"
                stroke-dashoffset="-${offset.toFixed(2)}"
                tabindex="0"
                role="graphics-symbol"
                aria-label="${category}: ${count} units (${Math.round(ratio * 100)}%)" />
      `;
    }).join('');

    svg.innerHTML = circlesHtml;

    // Legend
    legend.innerHTML = entries.map(([category, count]) => {
      const pct = Math.round((count / totalUnits) * 100);
      const color = CATEGORY_COLORS[category] || '#0A7D3E';
      return `
        <div class="dl-donut-legend-item">
          <div class="dl-donut-legend-label">
            <span class="dl-donut-legend-dot" style="background-color: ${color};"></span>
            <span>${DukaanUI.escapeHtml(category)}</span>
          </div>
          <span class="dl-donut-legend-pct">${pct}% (${count})</span>
        </div>
      `;
    }).join('');
  }

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
