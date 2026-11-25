import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.SEED_DEMO = 'true';
process.env.JWT_SECRET = 'test-secret';

const { createApp } = await import('../src/app.js');
let server, base;

// Tiny fetch wrapper that keeps one session cookie per "person".
function person() {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
}

before(async () => {
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('full multi-store order lifecycle', async () => {
  const admin = person(), buyer = person(), kfc = person(), vendor = person(), driver = person();
  const login = (p, email) => p('POST', '/api/auth/login', { email, password: 'Demo@1234' });

  assert.equal((await login(admin, 'admin@hazyeats.demo')).status, 200);
  assert.equal((await login(buyer, 'buyer@hazyeats.demo')).status, 200);
  assert.equal((await login(kfc, 'store@hazyeats.demo')).status, 200);
  assert.equal((await login(driver, 'driver@hazyeats.demo')).status, 200);

  // A new vendor signs up: store stays hidden until the admin approves it.
  const su = await vendor('POST', '/api/auth/signup', {
    name: 'Zakhele M', email: 'zak@example.com', password: 'Passw0rd!', phone: '0721234567',
    role: 'store', storeName: "Zakhele Test Kota", category: 'Community',
  });
  assert.equal(su.status, 201);
  const hidden = (await buyer('GET', '/api/stores')).body.stores;
  assert.ok(!hidden.some((s) => s.name === 'Zakhele Test Kota'));

  assert.equal((await vendor('POST', '/api/store/menu', { name: 'Special Kota', price: 35 })).status, 201);
  const adminStores = (await admin('GET', '/api/admin/stores')).body.stores;
  const pending = adminStores.find((s) => s.name === 'Zakhele Test Kota');
  assert.equal(pending.status, 'pending');
  assert.equal((await admin('PATCH', `/api/admin/stores/${pending.id}`, { status: 'approved' })).status, 200);

  // Order from two stores in one go. Prices come from the server.
  const stores = (await buyer('GET', '/api/stores')).body.stores;
  const kfcItem = stores.find((s) => s.id === 'kfc').menu[0];
  const kotaItem = stores.find((s) => s.id === pending.id).menu[0];
  const order = await buyer('POST', '/api/orders', {
    items: [{ menuItemId: kfcItem.id, qty: 2 }, { menuItemId: kotaItem.id, qty: 1 }],
    address: 'House 412, Shabalala Trust',
  });
  assert.equal(order.status, 201);
  assert.equal(order.body.order.totalCents, kfcItem.priceCents * 2 + 3500 + 2000);
  assert.equal(order.body.order.stores.length, 2);
  const id = order.body.order.id;

  // Stores only see their own part of the order.
  const kfcOrders = (await kfc('GET', '/api/store/orders')).body.orders;
  assert.equal(kfcOrders[0].items.length, 1);
  assert.equal(kfcOrders[0].address, undefined);

  // Driver cannot take it until every store is ready.
  assert.equal((await driver('POST', `/api/driver/orders/${id}/accept`)).status, 409);
  assert.equal((await kfc('POST', `/api/store/orders/${id}/status`, { status: 'ready' })).status, 409);
  assert.equal((await kfc('POST', `/api/store/orders/${id}/status`, { status: 'preparing' })).status, 200);
  assert.equal((await kfc('POST', `/api/store/orders/${id}/status`, { status: 'ready' })).status, 200);
  assert.equal((await driver('POST', `/api/driver/orders/${id}/accept`)).status, 409);
  assert.equal((await buyer('POST', `/api/orders/${id}/cancel`)).status, 409);
  await vendor('POST', `/api/store/orders/${id}/status`, { status: 'preparing' });
  await vendor('POST', `/api/store/orders/${id}/status`, { status: 'ready' });

  const accepted = await driver('POST', `/api/driver/orders/${id}/accept`);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.order.buyerPhone, '071 234 5678');
  assert.equal((await driver('POST', `/api/driver/orders/${id}/accept`)).status, 409);
  assert.equal((await driver('POST', `/api/driver/orders/${id}/deliver`)).status, 200);

  const mine = (await buyer('GET', '/api/orders/mine')).body.orders[0];
  assert.equal(mine.status, 'delivered');
  assert.equal(mine.driver.name, 'Sipho Driver');
  const ov = (await driver('GET', '/api/driver/overview')).body;
  assert.equal(ov.stats.deliveries, 1);
  assert.equal(ov.stats.earningsCents, 2000);
});

test('security rules', async () => {
  const anon = person(), buyer = person(), admin = person();
  assert.equal((await anon('GET', '/api/admin/overview')).status, 401);
  await buyer('POST', '/api/auth/login', { email: 'buyer@hazyeats.demo', password: 'Demo@1234' });
  assert.equal((await buyer('GET', '/api/admin/overview')).status, 403);
  assert.equal((await buyer('GET', '/api/store/me')).status, 403);

  // Nobody can sign themselves up as admin.
  const bad = await anon('POST', '/api/auth/signup', {
    name: 'Hacker', email: 'h@example.com', password: 'Passw0rd!', phone: '0721234567', role: 'admin',
  });
  assert.equal(bad.status, 400);
  assert.equal((await anon('POST', '/api/auth/login', { email: 'buyer@hazyeats.demo', password: 'wrong' })).status, 401);

  // A suspended account is locked out immediately, even with a valid cookie.
  await admin('POST', '/api/auth/login', { email: 'admin@hazyeats.demo', password: 'Demo@1234' });
  const users = (await admin('GET', '/api/admin/users')).body.users;
  const b = users.find((u) => u.email === 'buyer@hazyeats.demo');
  await admin('PATCH', `/api/admin/users/${b.id}`, { status: 'suspended' });
  assert.equal((await buyer('GET', '/api/orders/mine')).status, 401);
  assert.equal((await anon('POST', '/api/auth/login', { email: 'buyer@hazyeats.demo', password: 'Demo@1234' })).status, 403);
  await admin('PATCH', `/api/admin/users/${b.id}`, { status: 'active' });

  // Tampered quantities and unknown items are rejected.
  await buyer('POST', '/api/auth/login', { email: 'buyer@hazyeats.demo', password: 'Demo@1234' });
  assert.equal((await buyer('POST', '/api/orders', { items: [{ menuItemId: 1, qty: -5 }], address: 'Somewhere 123' })).status, 400);
  assert.equal((await buyer('POST', '/api/orders', { items: [{ menuItemId: 99999, qty: 1 }], address: 'Somewhere 123' })).status, 400);
});
