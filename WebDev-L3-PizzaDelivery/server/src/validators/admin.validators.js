const { z } = require('zod');
const { ORDER_STATUSES } = require('../models/Order');

const statusSchema = z.strictObject({
  status: z.enum(ORDER_STATUSES, { error: 'Unknown order status.' }),
});

module.exports = { statusSchema };
