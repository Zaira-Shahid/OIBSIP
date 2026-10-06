import api from './api'

export async function fetchPizzas() {
  const res = await api.get('/pizzas')
  return res.data.data.pizzas
}

// Authoritative price from the server: { items: [{ id, name, category, price }], total }.
// `selection` is ingredient ids only: { base, sauce, cheese, vegetables: [] }. Prices are never sent.
export async function fetchCustomPizzaPrice(selection) {
  const res = await api.post('/pizzas/price', selection)
  return res.data.data
}

// Builder options grouped by category: { base: [], sauce: [], cheese: [], vegetable: [] }.
export async function fetchIngredients() {
  const res = await api.get('/ingredients')
  return res.data.data.ingredients
}
