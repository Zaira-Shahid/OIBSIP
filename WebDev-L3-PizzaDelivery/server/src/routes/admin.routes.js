const express = require('express');
const c = require('../controllers/admin.controller');
const inventory = require('../controllers/inventory.controller');
const { authenticateUser, requireAdmin } = require('../middleware/auth');
const { adminLoginLimiter } = require('../middleware/rateLimiters');
const { validate, loginSchema } = require('../validators/auth.validators');
const { statusSchema, inventoryUpdateSchema } = require('../validators/admin.validators');

const router = express.Router();

// The only public admin route. Everything registered below is behind authenticateUser + requireAdmin,
// so a route added later cannot forget the check (tests crawl this router to prove it).
router.post('/login', adminLoginLimiter, validate(loginSchema), c.login);

router.use(authenticateUser, requireAdmin);
router.get('/me', c.me);
router.get('/orders', c.listOrders);
router.patch('/orders/:id/status', validate(statusSchema), c.updateOrderStatus);
router.get('/inventory', inventory.listInventory);
router.patch('/inventory/:id', validate(inventoryUpdateSchema), inventory.updateInventoryItem);

module.exports = router;
