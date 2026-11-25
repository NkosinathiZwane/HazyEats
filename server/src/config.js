import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] JWT_SECRET not set. Using a temporary secret; everyone is logged out on restart.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 3001),
  jwtSecret,
  dbPath: process.env.DB_PATH || path.join(here, '..', 'data', 'hazyeats.db'),
  clientDist: path.join(here, '..', '..', 'client', 'dist'),
  deliveryFeeCents: Number(process.env.DELIVERY_FEE_CENTS || 2000),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0,
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT || 30),
  seedDemo: process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : !isProd,
  adminEmail: (process.env.ADMIN_EMAIL || (isProd ? '' : 'admin@hazyeats.demo')).toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || (isProd ? '' : 'Demo@1234'),
};
