const { z } = require('zod');

const id = (label) => z.string({ error: `Please choose a ${label}.` }).trim().min(1, `Please choose a ${label}.`);

// Exactly one base, sauce and cheese; vegetables optional. The client never sends prices.
const customPizzaSchema = z.strictObject({
  base: id('base'),
  sauce: id('sauce'),
  cheese: id('cheese'),
  vegetables: z.array(z.string().trim().min(1), { error: 'Vegetables must be a list.' }).max(20, 'Too many vegetables selected.').default([]),
});

module.exports = { customPizzaSchema };
