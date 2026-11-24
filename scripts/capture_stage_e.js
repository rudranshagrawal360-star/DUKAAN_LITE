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
  await new Promise(r => setTimeout(r, 650));
}

async function runQA() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);

  await new Promise((res) => ws.addEventListener('open', res));

  await sendCommand(ws, 'Page.enable');
  await sendCommand(ws, 'DOM.enable');
  await sendCommand(ws, 'Network.enable');
  await sendCommand(ws, 'Network.setCacheDisabled', { cacheDisabled: true });

  // 1. Reset demo data before final screenshots
  console.log('Resetting demo data to pristine factory state...');
  await navigate(ws, 'http://localhost:8085/shopkeeper/settings.html');
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      if (window.DukaanStorage) {
        window.DukaanStorage.resetDemoData();
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  const viewports = [
    { name: '375px', width: 375, height: 812, mobile: true },
    { name: '1366px', width: 1366, height: 800, mobile: false }
  ];

  const responsiveTestWidths = [320, 375, 768, 1366];

  const targetPages = [
    { name: 'customer_catalog', url: 'http://localhost:8085/customer/catalog.html' },
    { name: 'customer_track', url: 'http://localhost:8085/customer/track.html?id=ORD-1001' },
    { name: 'shopkeeper_dashboard', url: 'http://localhost:8085/shopkeeper/dashboard.html' },
    { name: 'shopkeeper_orders', url: 'http://localhost:8085/shopkeeper/orders.html' },
    { name: 'shopkeeper_products', url: 'http://localhost:8085/shopkeeper/products.html' },
    { name: 'shopkeeper_settings', url: 'http://localhost:8085/shopkeeper/settings.html' },
    { name: 'index_customer', url: 'http://localhost:8085/index.html' }
  ];

  let anyOverflowFailed = false;

  // 2. Full responsive overflow test across 320, 375, 768, 1366px for all pages
  for (const page of targetPages) {
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
        console.error(`❌ [${page.name} @ ${w}px] OVERFLOW: clientWidth=${docW}, scrollWidth=${scrollW}`);
        anyOverflowFailed = true;
      } else {
        console.log(`✓ [${page.name} @ ${w}px] No overflow (clientWidth=${docW}, scrollWidth=${scrollW})`);
      }
    }

    // 3. Capture high-res Light & Dark mode screenshots at 375px and 1366px
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
      await new Promise(r => setTimeout(r, 400));
      let shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`screenshots/${page.name}_${vp.name}_light.png`, Buffer.from(shot.data, 'base64'));
      fs.writeFileSync(`screenshots/${page.name}_${vp.name}.png`, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: screenshots/${page.name}_${vp.name}_light.png`);

      // Dark mode
      await sendCommand(ws, 'Runtime.evaluate', {
        expression: `(() => {
          if (window.DukaanTheme) window.DukaanTheme.set('dark');
          else document.documentElement.setAttribute('data-theme', 'dark');
        })()`
      });
      await new Promise(r => setTimeout(r, 400));
      shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`screenshots/${page.name}_${vp.name}_dark.png`, Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: screenshots/${page.name}_${vp.name}_dark.png`);
    }
  }

  if (anyOverflowFailed) {
    console.error('FAILED: One or more pages have horizontal scroll overflow!');
    process.exit(1);
  } else {
    console.log('SUCCESS: All pages verified with 0 horizontal overflow across all responsive viewports!');
  }

  ws.close();
}

runQA().catch(err => {
  console.error('Fatal error during QA pass:', err);
  process.exit(1);
});
