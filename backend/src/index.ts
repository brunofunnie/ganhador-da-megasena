import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db';
import { syncResults } from './sync';
import { dedupeAllWallets } from './wallets';
import statusRoutes from './routes/status';
import statisticsRoutes from './routes/statistics';
import generateRoutes from './routes/generate';
import strategiesRoutes from './routes/strategies';
import simulateRoutes from './routes/simulate';
import walletsRoutes from './routes/wallets';
import drawsRoutes from './routes/draws';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', statusRoutes);
app.use('/api', statisticsRoutes);
app.use('/api', generateRoutes);
app.use('/api', strategiesRoutes);
app.use('/api', simulateRoutes);
app.use('/api', walletsRoutes);
app.use('/api', drawsRoutes);

// In production the frontend build is copied into the image and served by this
// same process, so the SPA and /api share an origin (frontend calls plain /api).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public');

if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  app.use(express.static(PUBLIC_DIR));
  // Client-side routing fallback for every non-/api path.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

async function start() {
  initDb();
  console.log('Database initialized');

  const removedDuplicates = dedupeAllWallets();
  if (removedDuplicates > 0) {
    console.log(`Removed ${removedDuplicates} duplicate game(s) from wallets`);
  }

  try {
    const status = await syncResults();
    console.log(`Sync complete: ${status.inserted} new, ${status.total} total draws`);
  } catch (err) {
    console.warn('Initial sync failed, using existing data:', err);
  }

  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

start();

export default app;
