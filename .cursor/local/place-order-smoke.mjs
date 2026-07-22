const ORG = 'c2887ddb-0cba-4df1-9086-e7399c92d159';
const BASE = 'https://app.sync2dine.io';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-org-id': ORG },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  console.log(path, res.status, JSON.stringify(json).slice(0, 500));
  return { status: res.status, json };
}

const menu = await fetch(`${BASE}/api/menu`, { headers: { 'x-org-id': ORG } });
const menuJson = await menu.json();
const item = (menuJson.items || []).find((i) => i.name);
console.log('menu', menu.status, 'count', (menuJson.items || []).length, 'first', item?.name);

await post('/api/orders', {
  items: [{ name: item?.name || 'Onion bhaji', qty: 1 }],
  orderType: 'collection',
  allergyConfirmed: true,
  customerAllergies: 'none',
  customerName: 'Till Smoke Guest',
  channel: 'staff',
  source: 'sync2dine',
});

await post('/api/orders', {
  items: [{ name: 'NotARealDishXYZ', qty: 1 }],
  orderType: 'collection',
  allergyConfirmed: true,
  customerAllergies: 'none',
  channel: 'staff',
});
