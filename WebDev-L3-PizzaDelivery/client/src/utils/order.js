// Flattens an order's saved snapshot into [{ category, name, price }] rows for PizzaBreakdown.
export function orderItems({ customPizza }) {
  const row = (category) => (line) => ({ category, name: line.name, price: line.price })
  return [
    row('base')(customPizza.base),
    row('sauce')(customPizza.sauce),
    row('cheese')(customPizza.cheese),
    ...customPizza.vegetables.map(row('vegetable')),
  ]
}
