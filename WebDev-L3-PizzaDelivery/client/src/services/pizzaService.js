import api from './api'

export async function fetchPizzas() {
  const res = await api.get('/pizzas')
  return res.data.data.pizzas
}

// Builder options grouped by category: { base: [], sauce: [], cheese: [], vegetable: [] }.
export async function fetchIngredients() {
  const res = await api.get('/ingredients')
  return res.data.data.ingredients
}
