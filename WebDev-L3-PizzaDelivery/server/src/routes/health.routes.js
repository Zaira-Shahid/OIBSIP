const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/', (req, res) => {
  const database = DB_STATES[mongoose.connection.readyState] || 'unknown';
  const ok = database === 'connected';
  res.status(ok ? 200 : 503).json({
    success: ok,
    data: { status: ok ? 'ok' : 'degraded', database, uptime: Math.round(process.uptime()) },
  });
});

module.exports = router;
