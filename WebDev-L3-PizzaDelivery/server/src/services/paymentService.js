const crypto = require('crypto');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

let gateway = null;

// Tests inject a fake gateway ({ createOrder }) so Razorpay is never contacted.
function setGateway(custom) {
  gateway = custom;
}

// Payments need test-mode keys. Live keys are refused on purpose (this project is test-mode only).
function assertConfigured() {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) {
    throw new ApiError(503, 'Online payments are not configured yet.', 'PAYMENTS_NOT_CONFIGURED');
  }
  if (!keyId.startsWith('rzp_test_')) {
    throw new ApiError(503, 'Only Razorpay test-mode keys are allowed.', 'PAYMENTS_NOT_CONFIGURED');
  }
}

const razorpayGateway = {
  async createOrder({ amount, receipt }) {
    const { keyId, keySecret } = env.razorpay;
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify({ amount, currency: 'INR', receipt }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Razorpay responded ${res.status}`);
    return res.json();
  },
};

// Creates a fresh Razorpay order. `amount` is in paise. Gateway details never reach the client on failure.
async function createGatewayOrder({ amount, receipt }) {
  assertConfigured();
  try {
    const created = await (gateway || razorpayGateway).createOrder({ amount, receipt });
    if (!created?.id) throw new Error('Gateway returned no order id.');
    return created;
  } catch (err) {
    console.error('Razorpay order creation failed:', err.message);
    throw new ApiError(502, 'We could not start the payment. Please try again.', 'GATEWAY_ERROR');
  }
}

// Checkout signature = HMAC-SHA256(secret, "<razorpay_order_id>|<razorpay_payment_id>").
function isValidSignature({ razorpayOrderId, paymentId, signature }) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

module.exports = { setGateway, assertConfigured, createGatewayOrder, isValidSignature };
