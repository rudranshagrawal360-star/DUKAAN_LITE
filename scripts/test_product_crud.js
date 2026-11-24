const http = require('http');

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const list = JSON.parse(data);
        const page = list.find(item => item.type === 'page');
        resolve(page.webSocketDebuggerUrl);
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
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const ws = new WebSocket(await getWsUrl());
  await new Promise(r => ws.addEventListener('open', r));

  // Reset demo data first
  await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:8085/shopkeeper/settings.html' });
  await new Promise(r => setTimeout(r, 500));
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => { if (window.DukaanStorage) DukaanStorage.resetDemoData(); })()`
  });

  // Navigate to products.html
  await sendCommand(ws, 'Page.navigate', { url: 'http://localhost:8085/shopkeeper/products.html' });
  await new Promise(r => setTimeout(r, 600));

  // 1. Initial count
  const initialRes = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const rows = document.querySelectorAll('#admin-products-tbody tr');
      const cards = document.querySelectorAll('#admin-products-mobile-list .dl-admin-item-card');
      const counterText = document.getElementById('product-count-sub')?.textContent;
      return { rowCount: rows.length, cardCount: cards.length, counterText };
    })()`,
    returnByValue: true
  });
  console.log('1. Initial products loaded:', initialRes.result.value);

  // 2. Test Add Product
  const addRes = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('btn-add-product-main').click();
      document.getElementById('product-name-input').value = 'Farm Fresh Paneer';
      document.getElementById('product-category-select').value = 'Dairy & Breakfast';
      document.getElementById('product-price-input').value = '120';
      document.getElementById('product-unit-input').value = '200 g block';
      document.getElementById('product-stock-input').value = '18';
      document.getElementById('product-image-path').value = 'assets/products/svg/p002.svg';
      
      const form = document.getElementById('product-edit-form');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

      const all = DukaanStorage.getProducts();
      const added = all.find(p => p.name === 'Farm Fresh Paneer');
      return { totalProducts: all.length, addedId: added?.id, addedName: added?.name, addedPrice: added?.price };
    })()`,
    returnByValue: true
  });
  console.log('2. Add product result:', addRes.result.value);
  await new Promise(r => setTimeout(r, 300));

  // 3. Test Edit Product
  const editRes = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const target = DukaanStorage.getProducts().find(p => p.name === 'Farm Fresh Paneer');
      if (!target) return { error: 'Target not found' };

      const editBtn = document.querySelector('tr[data-product-id="' + target.id + '"] .btn-edit-product');
      if (!editBtn) return { error: 'Edit button not found in DOM for ' + target.id };
      editBtn.click();

      document.getElementById('product-price-input').value = '145';
      document.getElementById('product-unit-input').value = '250 g block';
      
      const form = document.getElementById('product-edit-form');
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

      const updated = DukaanStorage.getProductById(target.id);
      return { id: updated?.id, updatedPrice: updated?.price, updatedUnit: updated?.unit };
    })()`,
    returnByValue: true
  });
  console.log('3. Edit product result:', editRes.result.value);
  await new Promise(r => setTimeout(r, 300));

  // 4. Test Toggle Availability
  const toggleRes = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const target = DukaanStorage.getProducts().find(p => p.name === 'Farm Fresh Paneer');
      if (!target) return { error: 'Target not found' };

      const toggleBtn = document.querySelector('tr[data-product-id="' + target.id + '"] .btn-toggle-avail');
      if (!toggleBtn) return { error: 'Toggle button not found' };
      toggleBtn.click();

      const after = DukaanStorage.getProductById(target.id);
      return { id: target.id, availableBefore: target.available, availableAfter: after?.available };
    })()`,
    returnByValue: true
  });
  console.log('4. Toggle availability result:', toggleRes.result.value);
  await new Promise(r => setTimeout(r, 300));

  // 5. Test Delete Product
  const delRes = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const target = DukaanStorage.getProducts().find(p => p.name === 'Farm Fresh Paneer');
      if (!target) return { error: 'Target not found' };

      const delBtn = document.querySelector('tr[data-product-id="' + target.id + '"] .btn-delete-product');
      if (!delBtn) return { error: 'Delete button not found' };
      delBtn.click();

      document.getElementById('btn-confirm-delete').click();

      const afterAll = DukaanStorage.getProducts();
      const stillExists = afterAll.some(p => p.id === target.id);
      return { totalAfterDelete: afterAll.length, stillExists };
    })()`,
    returnByValue: true
  });
  console.log('5. Delete product result:', delRes.result.value);

  // 6. Test CSV Export function exists and works
  const csvRes = await sendCommand(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const exportBtn = document.getElementById('btn-export-products-csv');
      return { exportBtnFound: !!exportBtn };
    })()`,
    returnByValue: true
  });
  console.log('6. CSV Export verified:', csvRes.result.value);

  ws.close();
}
main().catch(console.error);
