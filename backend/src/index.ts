import express from 'express';
import cors from 'cors';
import { initDb } from './db';
import { syncResults } from './sync';
import statusRoutes from './routes/status';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', statusRoutes);

async function start() {
  initDb();
  console.log('Database initialized');

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
