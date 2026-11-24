const fs = require('fs');
const http = require('http');

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const list = JSON.parse(data);
        const page = list.find(item => item.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          resolve(page.webSocketDebuggerUrl);
        } else {
          reject(new Error('No page debug URL found'));
        }
      });
    }).on('error', reject);
  });
}

function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function navigate(ws, url) {
  await sendCommand(ws, 'Page.navigate', { url });
  await new Promise(r => setTimeout(r, 700));
}

async function run() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);

  await new Promise((res) => ws.addEventListener('open', res));

  await sendCommand(ws, 'Page.enable');
  await sendCommand(ws, 'DOM.enable');
  await sendCommand(ws, 'Network.enable');
  await sendCommand(ws, 'Network.setCacheDisabled', { cacheDisabled: true });

  // Initial navigation to reset demo data so brand-free data is populated
  await navigate(ws, 'http://localhost:8085/shopkeeper/orders.html');
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      if (window.DukaanStorage) DukaanStorage.resetDemoData();
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  const viewports = [
    { name: '375px', width: 375, height: 812, mobile: true },
    { name: '1366px', width: 1366, height: 800, mobile: false }
  ];

  const responsiveTestWidths = [320, 375, 768, 1366];

  const pages = [
    { name: 'shopkeeper_orders', url: 'http://localhost:8085/shopkeeper/orders.html' },
    { name: 'shopkeeper_dashboard', url: 'http://localhost:8085/shopkeeper/dashboard.html' },
    { name: 'shopkeeper_products', url: 'http://localhost:8085/shopkeeper/products.html' },
    { name: 'shopkeeper_settings', url: 'http://localhost:8085/shopkeeper/settings.html' }
  ];

  let anyOverflowFailed = false;

  // 1. Responsive overflow test
  for (const page of pages) {
    for (const w of responsiveTestWidths) {
      await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
        width: w,
        height: w <= 768 ? 812 : 800,
        deviceScaleFactor: 1,
        mobile: w <= 768
      });
      await navigate(ws, page.url);

      const evalRes = await sendCommand(ws, 'Runtime.evaluate', {
        expression: `(() => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          return { docW, scrollW, hasOverflow: scrollW > docW };
        })()`,
        returnByValue: true
      });

      const { docW, scrollW, hasOverflow } = evalRes.result.value;
      if (hasOverflow) {
        console.error(`❌ [${page.name} @ ${w}px] OVERFLOW DETECTED: clientWidth=${docW}, scrollWidth=${scrollW}`);
        anyOverflowFailed = true;
      } else {
        console.log(`✓ [${page.name} @ ${w}px] No overflow (clientWidth=${docW}, scrollWidth=${scrollW})`);
      }
    }

    // 2. Screenshots in Light and Dark mode
    for (const vp of viewports) {
      await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile
      });
      await navigate(ws, page.url);

      // Light mode
      await sendCommand(ws, 'Runtime.evaluate', {
        expression: `(() => {
          if (window.DukaanTheme) window.DukaanTheme.set('light');
          else document.documentElement.setAttribute('data-theme', 'light');
        })()`
      });
      await new Promise(r => setTimeout(r, 350));
      let shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`screenshots/${page.name}_${vp.name}_light.png`, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: screenshots/${page.name}_${vp.name}_light.png`);

      // Dark mode
      await sendCommand(ws, 'Runtime.evaluate', {
        expression: `(() => {
          if (window.DukaanTheme) window.DukaanTheme.set('dark');
          else document.documentElement.setAttribute('data-theme', 'dark');
        })()`
      });
      await new Promise(r => setTimeout(r, 350));
      shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`screenshots/${page.name}_${vp.name}_dark.png`, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: screenshots/${page.name}_${vp.name}_dark.png`);
    }
  }

  // 3. Stage C Interactive States: Drawer Open & List View
  for (const vp of viewports) {
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile
    });

    // Orders page with Drawer Open
    await navigate(ws, 'http://localhost:8085/shopkeeper/orders.html');

    // Open first card drawer in Light mode
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `(() => {
        if (window.DukaanTheme) window.DukaanTheme.set('light');
        const card = document.querySelector('.dl-parchi-card');
        if (card) card.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 450));
    let shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`screenshots/shopkeeper_orders_drawer_${vp.name}_light.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: screenshots/shopkeeper_orders_drawer_${vp.name}_light.png`);

    // In Dark mode
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `(() => {
        if (window.DukaanTheme) window.DukaanTheme.set('dark');
      })()`
    });
    await new Promise(r => setTimeout(r, 350));
    shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`screenshots/shopkeeper_orders_drawer_${vp.name}_dark.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: screenshots/shopkeeper_orders_drawer_${vp.name}_dark.png`);

    // Switch to List View
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const closeBtn = document.getElementById('drawer-close-btn');
        if (closeBtn) closeBtn.click();
        const listBtn = document.getElementById('view-list-btn');
        if (listBtn) listBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 400));
    
    // List view in Dark mode
    shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`screenshots/shopkeeper_orders_list_${vp.name}_dark.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: screenshots/shopkeeper_orders_list_${vp.name}_dark.png`);

    // List view in Light mode
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `(() => {
        if (window.DukaanTheme) window.DukaanTheme.set('light');
      })()`
    });
    await new Promise(r => setTimeout(r, 350));
    shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`screenshots/shopkeeper_orders_list_${vp.name}_light.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: screenshots/shopkeeper_orders_list_${vp.name}_light.png`);
  }

  ws.close();
  if (anyOverflowFailed) {
    console.error('Some pages had overflow!');
    process.exit(1);
  } else {
    console.log('All responsive tests passed with zero overflow! All Stage C screenshots captured.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
