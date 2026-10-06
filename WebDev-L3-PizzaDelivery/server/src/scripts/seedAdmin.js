// Creates the single admin account from ADMIN_EMAIL / ADMIN_PASSWORD. Safe to run repeatedly.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { env } = require('../config/env');
const { connectDB } = require('../config/db');
const { PASSWORD_RULE, PASSWORD_MESSAGE } = require('../validators/auth.validators');
const User = require('../models/User');

async function seedAdmin() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not set.');
  if (!env.adminEmail || !env.adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.');
  }
  if (!PASSWORD_RULE.test(env.adminPassword)) throw new Error(`ADMIN_PASSWORD: ${PASSWORD_MESSAGE}`);

  await connectDB();

  const existing = await User.findOne({ email: env.adminEmail });
  if (existing) {
    console.log(
      existing.role === 'admin'
        ? `Admin ${env.adminEmail} already exists. Nothing changed (password is not overwritten).`
        : `A non-admin account already uses ${env.adminEmail}. Nothing changed; choose a different ADMIN_EMAIL.`
    );
    return;
  }

  await User.create({
    name: 'Administrator',
    email: env.adminEmail,
    passwordHash: await bcrypt.hash(env.adminPassword, 12),
    role: 'admin',
    isEmailVerified: true,
  });
  console.log(`Admin ${env.adminEmail} created.`);
}

seedAdmin()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
