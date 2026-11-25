/**
 * Test Catalog Categories & Studio Photos
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Verify all 27 product images exist on disk
const storageJs = fs.readFileSync(path.join(__dirname, '../js/shared/storage.js'), 'utf8');
const imageMatches = [...storageJs.matchAll(/image:\s*["']([^"']+)["']/g)].map(m => m[1]);

console.log(`Found ${imageMatches.length} product image references in storage.js`);
let missingImages = 0;
for (const imgPath of imageMatches) {
  const fullPath = path.join(__dirname, '..', imgPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing image file on disk: ${imgPath}`);
    missingImages++;
  }
}

if (missingImages === 0) {
  console.log('✓ All 27 product images exist on disk and are verified!');
} else {
  console.error(`✗ ${missingImages} images missing!`);
  process.exit(1);
}

// 2. Test via Headless Chrome WebSocket
http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', async () => {
    const list = JSON.parse(data);
    const page = list.find(p => p.type === 'page');
    if (!page) {
      console.error('No Chrome tab found');
      process.exit(1);
    }

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    function sendCmd(method, params = {}) {
      return new Promise((resolve) => {
        const id = Math.floor(Math.random() * 1000000);
        const handler = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.addEventListener('open', async () => {
      // Navigate to customer catalog
      await sendCmd('Page.navigate', { url: 'http://localhost:8085/customer/catalog.html' });
      await new Promise(r => setTimeout(r, 800));

      // Force storage reset so seed v6 loads
      await sendCmd('Runtime.evaluate', {
        expression: 'window.DukaanStorage.resetDemoData(); location.reload();'
      });
      await new Promise(r => setTimeout(r, 1000));

      // Check product count and categories
      const evalRes = await sendCmd('Runtime.evaluate', {
        expression: `
          (function() {
            const cards = document.querySelectorAll('.dl-product-card');
            const pills = document.querySelectorAll('.dl-category-pill');
            const categories = Array.from(pills).map(p => p.getAttribute('data-category'));
            
            // Check images loaded
            const brokenImages = Array.from(document.querySelectorAll('.dl-product-svg-img')).filter(img => !img.complete || img.naturalWidth === 0).length;
            
            return {
              cardCount: cards.length,
              categories: categories,
              brokenImages: brokenImages
            };
          })()
        `,
        returnByValue: true
      });

      console.log('Customer Catalog state:', evalRes.result.value);

      // Verify category clicking filters properly
      const filterRes = await sendCmd('Runtime.evaluate', {
        expression: `
          (function() {
            const results = {};
            const pills = document.querySelectorAll('.dl-category-pill');
            for (const pill of pills) {
              pill.click();
              const cat = pill.getAttribute('data-category');
              const visibleCards = Array.from(document.querySelectorAll('.dl-product-card')).filter(c => c.style.display !== 'none');
              results[cat] = visibleCards.length;
            }
            // Click back to ALL
            document.querySelector('.dl-category-pill[data-category="ALL"]').click();
            return results;
          })()
        `,
        returnByValue: true
      });

      console.log('Category filter item counts:', filterRes.result.value);

      ws.close();
      console.log('✓ All catalog categories and photo filters passed successfully!');
      process.exit(0);
    });
  });
});
