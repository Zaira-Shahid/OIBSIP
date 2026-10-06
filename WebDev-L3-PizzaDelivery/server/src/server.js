const { env, assertEnv } = require('./config/env');
const { connectDB } = require('./config/db');

async function start() {
  assertEnv();
  await connectDB();
  const app = require('./app');
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
}

start().catch((err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
