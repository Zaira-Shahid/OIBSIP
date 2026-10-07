// Seed data (prices in rupees). Ingredient names follow the project spec, section 10.
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

// rows are [name, price, previousPrice?]. previousPrice is what an older seed used: seed:menu only moves an existing
// record to the new price when it still holds that old value, so an admin's later price edit is never overwritten.
const make = (category, unit, stock, lowStockThreshold, rows) =>
  rows.map(([name, price, legacyPrice]) => ({ name, category, price, legacyPrice, stock, lowStockThreshold, unit }));

const ingredients = [
  ...make('base', 'pcs', 100, 20, [['Classic', 140, 80], ['Thin Crust', 150, 90], ['Cheese Burst', 190, 130], ['Whole Wheat', 160, 100], ['Stuffed Crust', 200, 140]]),
  ...make('sauce', 'ml', 5000, 1000, [['Classic Tomato', 20, 20], ['Spicy Marinara', 30, 25], ['Garlic Herb', 30, 25], ['BBQ', 35, 30], ['Pesto', 45, 35]]),
  ...make('cheese', 'g', 4000, 800, [['Mozzarella', 70, 40], ['Cheddar', 70, 40], ['Parmesan', 80, 50], ['Four Cheese', 110, 60]]),
  ...make('vegetable', 'g', 3000, 600, [
    ['Bell Pepper', 25, 15], ['Onion', 15, 10], ['Mushroom', 30, 20], ['Olive', 30, 20], ['Jalapeño', 25, 15], ['Sweet Corn', 20, 15], ['Tomato', 15, 10],
    ['Paneer', 40],
  ]),
];

// A preset is a starting point for the builder: `defaults` are [category, name] pairs (exactly one base, sauce and
// cheese, any vegetables). The price shown on the menu is the server-computed sum of these ingredients, so it is
// always what the builder charges. `legacyDescription` / `replaces` describe an older seed record that may be
// upgraded in place, but only while it is still exactly as the old seed wrote it.
const pizzas = [
  {
    name: 'Margherita',
    description: 'Classic tomato sauce, mozzarella and ripe tomato on a hand-stretched crust.',
    legacyDescription: 'Classic tomato sauce, fresh mozzarella and basil on a hand-stretched crust.',
    image: img('1574071318508-1cdbab80d002'),
    defaults: [['base', 'Classic'], ['sauce', 'Classic Tomato'], ['cheese', 'Mozzarella'], ['vegetable', 'Tomato']],
  },
  {
    name: 'Mushroom Melt',
    description: 'Garlic herb sauce, mushroom, olives and onion with melted mozzarella on a whole-wheat crust.',
    image: img('1590947132387-155cc02f3212'),
    replaces: {
      name: 'Pepperoni Feast',
      description: 'Generous slices of spicy pepperoni over bubbling mozzarella.',
      image: img('1628840042765-356cda07504e'),
    },
    defaults: [['base', 'Whole Wheat'], ['sauce', 'Garlic Herb'], ['cheese', 'Mozzarella'], ['vegetable', 'Mushroom'], ['vegetable', 'Olive'], ['vegetable', 'Onion']],
  },
  {
    name: 'Veggie Supreme',
    description: 'Bell pepper, onion, mushroom, olives and sweet corn on garlic herb sauce.',
    image: img('1594007654729-407eedc4be65'),
    defaults: [
      ['base', 'Classic'], ['sauce', 'Garlic Herb'], ['cheese', 'Mozzarella'],
      ['vegetable', 'Bell Pepper'], ['vegetable', 'Onion'], ['vegetable', 'Mushroom'], ['vegetable', 'Olive'], ['vegetable', 'Sweet Corn'],
    ],
  },
  {
    name: 'Four Cheese',
    description: 'A rich four-cheese blend on a golden cheese-burst crust.',
    legacyDescription: 'Mozzarella, cheddar, parmesan and a creamy blend on a golden crust.',
    image: img('1513104890138-7c749659a591'),
    defaults: [['base', 'Cheese Burst'], ['sauce', 'Classic Tomato'], ['cheese', 'Four Cheese']],
  },
  {
    name: 'BBQ Paneer',
    description: 'Smoky BBQ sauce, paneer, onion and jalapeño on a thin crust.',
    legacyDescription: 'Smoky BBQ sauce, marinated paneer, onion and jalapeño.',
    image: img('1565299624946-b28f40a0ae38'),
    defaults: [['base', 'Thin Crust'], ['sauce', 'BBQ'], ['cheese', 'Cheddar'], ['vegetable', 'Paneer'], ['vegetable', 'Onion'], ['vegetable', 'Jalapeño']],
  },
  {
    name: 'Spicy Garden',
    description: 'Spicy marinara, jalapeño, tomato, onion and a sprinkle of parmesan.',
    image: img('1571407970349-bc81e7e96d47'),
    defaults: [['base', 'Thin Crust'], ['sauce', 'Spicy Marinara'], ['cheese', 'Parmesan'], ['vegetable', 'Jalapeño'], ['vegetable', 'Tomato'], ['vegetable', 'Onion']],
  },
];

module.exports = { ingredients, pizzas };
