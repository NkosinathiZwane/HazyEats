import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { attachUser } from './auth.js';
import { errorHandler } from './http.js';
import { seed } from './seed.js';
import authRoutes from './routes/auth.js';
import storeListRoutes from './routes/stores.js';
import orderRoutes from './routes/orders.js';
import storeConsoleRoutes from './routes/store.js';
import driverRoutes from './routes/driver.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  seed();
  const app = express();
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameSrc: ['https://accounts.google.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '50kb' }));
  app.use(attachUser);

  app.get('/api/config', (_req, res) => res.json({
    googleClientId: config.googleClientId, deliveryFeeCents: config.deliveryFeeCents, demo: config.seedDemo,
  }));
  app.use('/api/auth', authRoutes);
  app.use('/api/stores', storeListRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/store', storeConsoleRoutes);
  app.use('/api/driver', driverRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
