const { z } = require('zod');
const { ORDER_STATUSES } = require('../models/Order');

const statusSchema = z.strictObject({
  status: z.enum(ORDER_STATUSES, { error: 'Unknown order status.' }),
});

const { MAX_STOCK } = require('../services/inventoryService');

const whole = (label, min) =>
  z
    .number({ error: `${label} must be a whole number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} cannot be below ${min}.`)
    .max(MAX_STOCK, `${label} cannot be above ${MAX_STOCK}.`);

// Editable fields are stock, threshold and active only. Setting an absolute stock must say which stock the admin
// saw (expectedStock) so a concurrent order is never silently overwritten; adjustBy is an atomic +/- change.
const inventoryUpdateSchema = z
  .strictObject({
    stock: whole('Stock', 0).optional(),
    expectedStock: whole('Expected stock', 0).optional(),
    adjustBy: whole('Adjustment', -MAX_STOCK).refine((n) => n !== 0, 'Adjustment cannot be zero.').optional(),
    lowStockThreshold: whole('Threshold', 0).optional(),
    active: z.boolean({ error: 'Active must be true or false.' }).optional(),
  })
  .superRefine((body, ctx) => {
    const has = (key) => body[key] !== undefined;
    const issue = (message) => ctx.addIssue({ code: 'custom', message });
    if (!['stock', 'adjustBy', 'lowStockThreshold', 'active'].some(has)) issue('Nothing to update.');
    else if (has('stock') && has('adjustBy')) issue('Set the stock or adjust it, not both.');
    else if (has('stock') && !has('expectedStock')) issue('Setting stock needs expectedStock (the value you saw).');
    else if (has('expectedStock') && !has('stock')) issue('expectedStock is only used together with stock.');
  });

module.exports = { statusSchema, inventoryUpdateSchema };
