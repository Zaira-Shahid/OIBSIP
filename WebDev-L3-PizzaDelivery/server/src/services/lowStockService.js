const InventoryItem = require('../models/InventoryItem');
const { env, DEFAULT_LOW_STOCK_CRON } = require('../config/env');
const { inventoryStatus } = require('./inventoryService');
const { sendLowStockDigest } = require('./emailService');

// How bad a state is. An alert is only sent when an item gets WORSE than the state it was last alerted for,
// so an unchanged low item is never emailed again, but LOW -> OUT_OF_STOCK is a new alert.
const RANK = { OK: 0, LOW: 1, OUT_OF_STOCK: 2 };
const rankOf = (state) => RANK[state] ?? 0;

const clearAlert = { $unset: { lowStockAlertState: 1, lowStockAlertedAt: 1 } };
const stateUpdate = (state) => (state ? { $set: { lowStockAlertState: state } } : clearAlert);

// The item's condition improved (restocked, threshold lowered): lower the recorded alert state to match, silently.
// Restocked to >= threshold clears it, so a later drop alerts again; OUT_OF_STOCK -> LOW keeps LOW so a later
// fall to 0 alerts as an escalation.
async function reconcileAlertState(itemId) {
  const item = await InventoryItem.findById(itemId);
  if (!item?.lowStockAlertState) return;
  const status = inventoryStatus(item);
  if (rankOf(status) >= rankOf(item.lowStockAlertState)) return;
  await InventoryItem.updateOne(
    { _id: item._id, lowStockAlertState: item.lowStockAlertState },
    stateUpdate(status === 'OK' ? null : status)
  );
}

let running = false;

// One scheduler pass. Items are claimed atomically (alert state set) BEFORE the email is sent, so overlapping runs
// or two server instances cannot email the same item twice; a failed send releases the claim so the next run retries.
// Returns { checked, alerted: [items], skipped?, failed? } and never throws for a mail problem.
async function runLowStockCheck() {
  if (running) return { checked: 0, alerted: [], skipped: 'ALREADY_RUNNING' };
  running = true;
  try {
    const items = await InventoryItem.find({ active: true });
    const needAlert = [];
    for (const item of items) {
      const status = inventoryStatus(item);
      const previous = item.lowStockAlertState;
      if (rankOf(status) < rankOf(previous)) {
        await InventoryItem.updateOne({ _id: item._id, lowStockAlertState: previous }, stateUpdate(status === 'OK' ? null : status));
      } else if (rankOf(status) > rankOf(previous)) {
        needAlert.push({ item, status, previous });
      }
    }
    if (needAlert.length === 0) return { checked: items.length, alerted: [] };
    if (!env.alertEmail) return { checked: items.length, alerted: [], skipped: 'NO_RECIPIENT' };

    const claimed = [];
    for (const entry of needAlert) {
      const res = await InventoryItem.updateOne(
        { _id: entry.item._id, active: true, lowStockAlertState: entry.previous ?? null },
        { $set: { lowStockAlertState: entry.status, lowStockAlertedAt: new Date() } }
      );
      if (res.modifiedCount === 1) claimed.push(entry);
    }
    if (claimed.length === 0) return { checked: items.length, alerted: [] };

    const digest = claimed.map(({ item, status }) => ({
      name: item.name,
      category: item.category,
      stock: item.stock,
      unit: item.unit,
      lowStockThreshold: item.lowStockThreshold,
      status,
    }));
    try {
      await sendLowStockDigest(env.alertEmail, digest);
    } catch (err) {
      await Promise.all(
        claimed.map(({ item, status, previous }) =>
          InventoryItem.updateOne({ _id: item._id, lowStockAlertState: status }, stateUpdate(previous))
        )
      );
      console.error(`[low-stock] alert email failed (will retry next run): ${err.message}`);
      return { checked: items.length, alerted: [], failed: true };
    }
    return { checked: items.length, alerted: digest };
  } finally {
    running = false;
  }
}

// Starts the cron job. Never starts under NODE_ENV=test (tests call runLowStockCheck directly).
function startLowStockScheduler({ cron = require('node-cron') } = {}) {
  if (env.nodeEnv === 'test') return null;
  let expression = env.lowStockCron;
  if (!cron.validate(expression)) {
    console.warn(`[low-stock] Invalid LOW_STOCK_CHECK_CRON "${expression}"; using "${DEFAULT_LOW_STOCK_CRON}" instead.`);
    expression = DEFAULT_LOW_STOCK_CRON;
  }
  const task = cron.schedule(expression, async () => {
    try {
      const r = await runLowStockCheck();
      const note = r.skipped ? ` (skipped: ${r.skipped})` : r.failed ? ' (email failed, will retry)' : '';
      console.log(`[low-stock] checked ${r.checked} items, alerted ${r.alerted.length}${note}`);
    } catch (err) {
      console.error(`[low-stock] check failed: ${err.message}`);
    }
  });
  console.log(`[low-stock] scheduler running (${expression}); alerts go to ${env.alertEmail ? 'the configured admin address' : 'NOBODY: set ADMIN_ALERT_EMAIL or ADMIN_EMAIL'}`);
  return task;
}

module.exports = { runLowStockCheck, reconcileAlertState, startLowStockScheduler };
