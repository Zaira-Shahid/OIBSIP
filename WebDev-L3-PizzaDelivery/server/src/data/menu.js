// Seed data (prices in rupees). Ingredient names follow the project spec, section 10.
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

const make = (category, unit, stock, lowStockThreshold, rows) =>
  rows.map(([name, price]) => ({ name, category, price, stock, lowStockThreshold, unit }));

const ingredients = [
  ...make('base', 'pcs', 100, 20, [['Classic', 80], ['Thin Crust', 90], ['Cheese Burst', 130], ['Whole Wheat', 100], ['Stuffed Crust', 140]]),
  ...make('sauce', 'ml', 5000, 1000, [['Classic Tomato', 20], ['Spicy Marinara', 25], ['Garlic Herb', 25], ['BBQ', 30], ['Pesto', 35]]),
  ...make('cheese', 'g', 4000, 800, [['Mozzarella', 40], ['Cheddar', 40], ['Parmesan', 50], ['Four Cheese', 60]]),
  ...make('vegetable', 'g', 3000, 600, [
    ['Bell Pepper', 15], ['Onion', 10], ['Mushroom', 20], ['Olive', 20], ['Jalapeño', 15], ['Sweet Corn', 15], ['Tomato', 10],
  ]),
];

const pizzas = [
  { name: 'Margherita', description: 'Classic tomato sauce, fresh mozzarella and basil on a hand-stretched crust.', price: 249, image: img('1574071318508-1cdbab80d002') },
  { name: 'Pepperoni Feast', description: 'Generous slices of spicy pepperoni over bubbling mozzarella.', price: 349, image: img('1628840042765-356cda07504e') },
  { name: 'Veggie Supreme', description: 'Bell pepper, onion, mushroom, olives and sweet corn on garlic herb sauce.', price: 299, image: img('1594007654729-407eedc4be65') },
  { name: 'Four Cheese', description: 'Mozzarella, cheddar, parmesan and a creamy blend on a golden crust.', price: 329, image: img('1513104890138-7c749659a591') },
  { name: 'BBQ Paneer', description: 'Smoky BBQ sauce, marinated paneer, onion and jalapeño.', price: 319, image: img('1565299624946-b28f40a0ae38') },
  { name: 'Spicy Garden', description: 'Spicy marinara, jalapeño, tomato, onion and a sprinkle of parmesan.', price: 279, image: img('1571407970349-bc81e7e96d47') },
];

module.exports = { ingredients, pizzas };
