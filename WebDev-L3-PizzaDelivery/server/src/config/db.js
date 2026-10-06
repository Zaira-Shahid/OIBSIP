const dns = require('dns');
const mongoose = require('mongoose');
const { env } = require('./env');

const connectOptions = { serverSelectionTimeoutMS: 10000 };

async function connectDB() {
  try {
    await mongoose.connect(env.mongodbUri, connectOptions);
  } catch (err) {
    // Some networks/Windows setups give Node's resolver an unusable DNS server,
    // so the Atlas mongodb+srv lookup fails even though the OS can resolve it.
    if (err.syscall !== 'querySrv') throw err;
    console.warn('SRV lookup failed with system DNS; retrying with public DNS resolvers');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    await mongoose.connect(env.mongodbUri, connectOptions);
  }
  console.log(`MongoDB connected (db: ${mongoose.connection.name})`);
}

module.exports = { connectDB };
