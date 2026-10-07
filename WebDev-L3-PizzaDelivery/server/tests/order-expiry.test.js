// Run with: npm test. Uses the "pizza-delivery-test" database.
// Unpaid orders expire after 24 hours through a partial TTL index. The live test below uses a scratch collection with
// the SAME index definition but a 3-second expiry, and waits for MongoDB's real TTL sweep (it runs about once a minute).
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const Order = require('../src/models/Order');

const { UNPAID_TTL_SECONDS, UNPAID_FILTER } = Order;
const SCRATCH = 'ttl_check_orders';
const ago = (ms) => new Date(Date.now() - ms);
const DAY = 24 * 60 * 60 * 1000;

test.before(async () => {
  assertEnv();
  await connectDB();
  await Order.init(); // make sure the model's indexes exist
});

test.after(async () => {
  await mongoose.connection.db.collection(SCRATCH).drop().catch(() => {});
  await mongoose.disconnect();
});

test('the Order collection has a 24-hour TTL index limited to PENDING and FAILED orders', async () => {
  assert.equal(UNPAID_TTL_SECONDS, 86400);
  assert.deepEqual(UNPAID_FILTER, { paymentStatus: { $in: ['PENDING', 'FAILED'] } });
  const index = (await Order.collection.indexes()).find((i) => i.key.createdAt === 1 && i.expireAfterSeconds !== undefined);
  assert.ok(index, 'a TTL index on createdAt exists');
  assert.equal(index.expireAfterSeconds, 86400);
  assert.deepEqual(index.partialFilterExpression, UNPAID_FILTER);
  // It does not touch the user's order-history index.
  assert.ok((await Order.collection.indexes()).some((i) => i.key.userId === 1 && i.expireAfterSeconds === undefined));
});

test('real TTL sweep: old unpaid orders are deleted; paid, refund-pending and recent orders never are', { timeout: 240000 }, async () => {
  const col = mongoose.connection.db.collection(SCRATCH);
  await col.drop().catch(() => {});
  await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3, partialFilterExpression: UNPAID_FILTER });

  const old = ago(2 * DAY);
  const docs = {
    pending: { paymentStatus: 'PENDING', createdAt: old },
    failed: { paymentStatus: 'FAILED', createdAt: old },
    paid: { paymentStatus: 'PAID', orderStatus: 'ORDER_RECEIVED', createdAt: old },
    refund: { paymentStatus: 'PAID', needsRefund: true, createdAt: old }, // paid, no status, awaiting a refund
    fresh: { paymentStatus: 'PENDING', createdAt: new Date(Date.now() + 10 * 60 * 1000) }, // not due yet
    raced: { paymentStatus: 'PENDING', createdAt: old }, // paid just before the sweep, like verify does
  };
  const ids = {};
  for (const [key, doc] of Object.entries(docs)) ids[key] = (await col.insertOne({ ...doc, key })).insertedId;
  await col.updateOne({ _id: ids.raced }, { $set: { paymentStatus: 'PAID' } });

  const deadline = Date.now() + 200000;
  let remaining;
  do {
    await new Promise((r) => setTimeout(r, 5000));
    remaining = (await col.find({}).toArray()).map((d) => d.key).sort();
  } while (Date.now() < deadline && (remaining.includes('pending') || remaining.includes('failed')));

  assert.deepEqual(remaining, ['fresh', 'paid', 'raced', 'refund']);
});
