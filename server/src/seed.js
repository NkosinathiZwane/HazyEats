import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import { config } from './config.js';
import { db } from './db.js';

const stores = JSON.parse(fs.readFileSync(new URL('./seed-stores.json', import.meta.url), 'utf8'));

function addUser({ name, email, password, role, phone, vehicle }) {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return null;
  const r = db.prepare('INSERT INTO users (name, email, password_hash, role, phone, vehicle) VALUES (?,?,?,?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 11), role, phone || null, vehicle || null);
  return r.lastInsertRowid;
}

export function seed() {
  if (!db.prepare('SELECT COUNT(*) AS c FROM stores').get().c) {
    db.transaction(() => {
      for (const s of stores) {
        db.prepare(`INSERT INTO stores (id, name, category, eta, logo, is_community, status) VALUES (?,?,?,?,?,?, 'approved')`)
          .run(s.id, s.name, s.category, s.eta.replace('\u2013', '-'), s.logo || '', s.isCommunity ? 1 : 0);
        for (const m of s.menu) {
          db.prepare('INSERT INTO menu_items (store_id, name, price_cents) VALUES (?,?,?)').run(s.id, m.name, m.priceCents);
        }
      }
    })();
  }

  if (config.adminEmail && config.adminPassword) {
    addUser({ name: 'ZikCode System Admin', email: config.adminEmail, password: config.adminPassword, role: 'admin' });
  } else if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
    console.warn('[seed] No admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env and restart.');
  }

  if (config.seedDemo) {
    const pw = 'Demo@1234';
    addUser({ name: 'Thabo Buyer', email: 'buyer@hazyeats.demo', password: pw, role: 'buyer', phone: '071 234 5678' });
    addUser({ name: 'Sipho Driver', email: 'driver@hazyeats.demo', password: pw, role: 'driver', phone: '072 987 6543', vehicle: 'Honda 125cc Bike' });
    const owner = addUser({ name: 'KFC Hazyview Manager', email: 'store@hazyeats.demo', password: pw, role: 'store', phone: '013 737 0000' });
    if (owner) db.prepare("UPDATE stores SET owner_id = ? WHERE id = 'kfc' AND owner_id IS NULL").run(owner);
  }
}
