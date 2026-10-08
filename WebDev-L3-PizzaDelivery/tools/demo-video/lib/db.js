// Database helpers for the demo run. They reuse the server's own config and models, so credentials are read from
// server/.env at runtime and are never printed. Deletion is restricted to throw-away demo accounts.
const path = require('path');

const SERVER = path.resolve(__dirname, '../../../server');
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const bcrypt = require(path.join(SERVER, 'node_modules/bcryptjs'));
const { env } = require(path.join(SERVER, 'src/config/env'));
const { connectDB } = require(path.join(SERVER, 'src/config/db'));
const User = require(path.join(SERVER, 'src/models/User'));
const Order = require(path.join(SERVER, 'src/models/Order'));
const InventoryItem = require(path.join(SERVER, 'src/models/InventoryItem'));

// Only these kinds of accounts may ever be deleted by this tooling.
const isDemoEmail = (email) => /(\+demo@gmail\.com|@demo\.invalid)$/i.test(email);

async function connect() {
  const log = console.log;
  console.log = () => {}; // silence the connection banner
  try {
    await connectDB();
  } finally {
    console.log = log;
  }
}

const disconnect = () => mongoose.disconnect();

// The seeded admin from server/.env. The password is only ever handed to the browser form, never logged.
function adminCredentials() {
  if (!env.adminEmail || !env.adminPassword) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD are not set in server/.env');
  return { email: env.adminEmail, password: env.adminPassword };
}

async function adminExists() {
  const admin = await User.findOne({ email: env.adminEmail });
  return Boolean(admin && admin.role === 'admin');
}

async function createVerifiedUser({ name, email, password }) {
  if (!isDemoEmail(email)) throw new Error('refusing to create a non-demo account');
  await deleteDemoAccount(email); // also removes that account's orders, so re-runs leave nothing behind
  return User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), isEmailVerified: true });
}

// Marks the account verified WITHOUT consuming the emailed link, so the link in the real email still works afterwards.
async function markVerified(email) {
  const res = await User.updateOne({ email }, { isEmailVerified: true });
  if (res.matchedCount !== 1) throw new Error(`no account to verify for ${email}`);
}

async function deleteDemoAccount(email) {
  if (!isDemoEmail(email)) throw new Error('refusing to delete a non-demo account');
  const user = await User.findOne({ email });
  if (!user) return { user: 0, orders: 0 };
  const orders = await Order.deleteMany({ userId: user._id });
  await User.deleteOne({ _id: user._id });
  return { user: 1, orders: orders.deletedCount };
}

const stockSnapshot = async () =>
  (await InventoryItem.find({}).sort({ category: 1, name: 1 })).map((i) => ({
    id: String(i._id),
    category: i.category,
    name: i.name,
    stock: i.stock,
    threshold: i.lowStockThreshold,
    active: i.active,
    alertState: i.lowStockAlertState || null,
  }));

const latestOrderFor = async (email) => {
  const user = await User.findOne({ email });
  return user ? Order.findOne({ userId: user._id }).sort({ createdAt: -1 }) : null;
};

module.exports = {
  connect, disconnect, adminCredentials, adminExists, createVerifiedUser, markVerified, deleteDemoAccount,
  stockSnapshot, latestOrderFor, isDemoEmail, mongoose, models: { User, Order, InventoryItem },
};
