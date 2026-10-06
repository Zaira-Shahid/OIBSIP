const mongoose = require('mongoose');
const { env } = require('./env');

async function connectDB() {
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected (db: ${mongoose.connection.name})`);
}

module.exports = { connectDB };
