// Sets a new password for the existing admin named by ADMIN_EMAIL, using ADMIN_PASSWORD (both from server/.env).
// seed:admin never overwrites a password by design, so this is the only way to change it.
// It refuses non-admin accounts, applies the normal password rule, and invalidates every admin token issued before now.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { env } = require('../config/env');
const { connectDB } = require('../config/db');
const { PASSWORD_RULE, PASSWORD_MESSAGE } = require('../validators/auth.validators');
const { BCRYPT_ROUNDS } = require('../utils/passwords');
const User = require('../models/User');

async function resetAdminPassword() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not set.');
  if (!env.adminEmail || !env.adminPassword) {
    throw new Error('Set ADMIN_EMAIL (the admin to update) and ADMIN_PASSWORD (the new password) in server/.env first.');
  }
  if (!PASSWORD_RULE.test(env.adminPassword)) throw new Error(`ADMIN_PASSWORD: ${PASSWORD_MESSAGE}`);

  await connectDB();

  const admin = await User.findOne({ email: env.adminEmail });
  if (!admin) throw new Error(`No account uses ${env.adminEmail}. Run npm run seed:admin to create it.`);
  if (admin.role !== 'admin') throw new Error(`${env.adminEmail} is not an admin account. Nothing changed.`);

  await User.updateOne(
    { _id: admin._id, role: 'admin' },
    { passwordHash: await bcrypt.hash(env.adminPassword, BCRYPT_ROUNDS), passwordChangedAt: new Date() }
  );
  console.log(`Password updated for admin ${env.adminEmail}. Existing admin sessions were signed out.`);
}

resetAdminPassword()
  .catch((err) => {
    console.error(`Reset failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
