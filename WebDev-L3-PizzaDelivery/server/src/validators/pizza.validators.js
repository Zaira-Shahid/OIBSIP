const { z } = require('zod');

const id = (label) => z.string({ error: `Please choose a ${label}.` }).trim().min(1, `Please choose a ${label}.`);

const quantity = z
  .number({ error: 'Quantity must be a whole number from 1 to 5.' })
  .int('Quantity must be a whole number from 1 to 5.')
  .min(1, 'Quantity must be at least 1.')
  .max(5, 'You can order at most 5 pizzas at a time.');

// Exactly one base, sauce and cheese; vegetables optional. The client never sends prices.
const selectionShape = {
  base: id('base'),
  sauce: id('sauce'),
  cheese: id('cheese'),
  vegetables: z.array(z.string().trim().min(1), { error: 'Vegetables must be a list.' }).max(20, 'Too many vegetables selected.').default([]),
};

const customPizzaSchema = z.strictObject({ ...selectionShape, quantity: quantity.default(1) });

module.exports = { customPizzaSchema };
