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

async function run() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);

  await new Promise((res) => ws.addEventListener('open', res));

  await sendCommand(ws, 'Page.enable');
  await sendCommand(ws, 'DOM.enable');
  await sendCommand(ws, 'Network.enable');
  await sendCommand(ws, 'Network.setCacheDisabled', { cacheDisabled: true });

  // Navigate to dashboard and reset/seed deterministic data
  await navigate(ws, 'http://localhost:8085/shopkeeper/dashboard.html');
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      if (window.DukaanStorage) DukaanStorage.resetDemoData();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  const viewports = [
    { name: '375px', width: 375, height: 812, mobile: true },
    { name: '1366px', width: 1366, height: 800, mobile: false }
  ];

  const responsiveTestWidths = [320, 375, 768, 1366];

  let anyOverflowFailed = false;

  // 1. Thorough responsive overflow test across 320, 375, 768, 1366px
  for (const w of responsiveTestWidths) {
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: w,
      height: w <= 768 ? 812 : 800,
      deviceScaleFactor: 1,
      mobile: w <= 768
    });
    await navigate(ws, 'http://localhost:8085/shopkeeper/dashboard.html');

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
      console.error(`❌ [shopkeeper_dashboard @ ${w}px] OVERFLOW DETECTED: clientWidth=${docW}, scrollWidth=${scrollW}`);
      anyOverflowFailed = true;
    } else {
      console.log(`✓ [shopkeeper_dashboard @ ${w}px] No overflow (clientWidth=${docW}, scrollWidth=${scrollW})`);
    }
  }

  // 2. Capture Screenshots at 375px and 1366px in Light & Dark modes (7 days default)
  for (const vp of viewports) {
    await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile
    });
    await navigate(ws, 'http://localhost:8085/shopkeeper/dashboard.html');

    // Light mode
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `(() => {
        if (window.DukaanTheme) window.DukaanTheme.set('light');
        else document.documentElement.setAttribute('data-theme', 'light');
      })()`
    });
    await new Promise(r => setTimeout(r, 450));
    let shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`screenshots/shopkeeper_dashboard_${vp.name}_light.png`, Buffer.from(shot.data, 'base64'));
    fs.writeFileSync(`screenshots/shopkeeper_dashboard_${vp.name}.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: screenshots/shopkeeper_dashboard_${vp.name}_light.png`);

    // Dark mode
    await sendCommand(ws, 'Runtime.evaluate', {
      expression: `(() => {
        if (window.DukaanTheme) window.DukaanTheme.set('dark');
        else document.documentElement.setAttribute('data-theme', 'dark');
      })()`
    });
    await new Promise(r => setTimeout(r, 450));
    shot = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`screenshots/shopkeeper_dashboard_${vp.name}_dark.png`, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: screenshots/shopkeeper_dashboard_${vp.name}_dark.png`);
  }

  // 3. Capture 30 days and Today range variations at 1366px
  await sendCommand(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Switch to 30 days range in Light mode
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      if (window.DukaanTheme) window.DukaanTheme.set('light');
      const btn = document.querySelector('.dl-range-btn[data-range="30days"]');
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));
  let shot30 = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screenshots/shopkeeper_dashboard_1366px_30days_light.png', Buffer.from(shot30.data, 'base64'));
  console.log('Saved screenshot: screenshots/shopkeeper_dashboard_1366px_30days_light.png');

  // Switch to Today range in Light mode
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.dl-range-btn[data-range="today"]');
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));
  let shotToday = await sendCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screenshots/shopkeeper_dashboard_1366px_today_light.png', Buffer.from(shotToday.data, 'base64'));
  console.log('Saved screenshot: screenshots/shopkeeper_dashboard_1366px_today_light.png');

  ws.close();
  if (anyOverflowFailed) {
    console.error('Overflow detected in dashboard!');
    process.exit(1);
  } else {
    console.log('All responsive tests passed with zero overflow! All Stage D screenshots captured.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
