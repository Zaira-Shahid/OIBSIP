// Turns a Pizza document (with its defaultIngredients populated) into what the menu and the builder need.
// Returns null when the preset cannot be built (a default is missing or inactive, or it lacks exactly one base,
// sauce and cheese), so a broken preset is hidden instead of showing a price that the builder would not charge.
function presentPizza(pizza) {
  const items = pizza.defaultIngredients;
  if (!Array.isArray(items) || items.length === 0 || items.some((i) => !i || !i.active)) return null;

  const of = (category) => items.filter((i) => i.category === category);
  if (of('base').length !== 1 || of('sauce').length !== 1 || of('cheese').length !== 1) return null;

  return {
    id: pizza.id,
    name: pizza.name,
    description: pizza.description,
    image: pizza.image,
    available: pizza.available,
    // What you see is what you pay: the same sum the builder's price endpoint computes for these ingredients.
    price: items.reduce((sum, i) => sum + i.price, 0),
    selection: {
      base: of('base')[0].id,
      sauce: of('sauce')[0].id,
      cheese: of('cheese')[0].id,
      vegetables: of('vegetable').map((v) => v.id),
    },
    ingredients: items.map((i) => i.name),
  };
}

module.exports = { presentPizza };
