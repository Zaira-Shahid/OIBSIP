const { env, assertEnv } = require('./config/env');
const { connectDB } = require('./config/db');
const { startLowStockScheduler } = require('./services/lowStockService');

async function start() {
  assertEnv();
  await connectDB();
  const app = require('./app');
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
  startLowStockScheduler();
}

start().catch((err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
