// Captures the README screenshots that can genuinely be produced (no paid order is needed for these).
// Usage: node screenshots.js <outDir>   (client on :5273, API on :5100, see serve.js)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const db = require('./lib/db');

const BASE = 'http://localhost:5273';
const OUT = path.resolve(process.argv[2]);
const CUSTOMER = { name: 'Demo Customer', email: 'shots@demo.invalid', password: 'DemoPizza2026' };
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  await db.connect();
  const admin = db.adminCredentials();
  await db.createVerifiedUser(CUSTOMER);
  const before = await db.stockSnapshot();
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const shot = async (name, full) => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(800); await page.screenshot({ path: path.join(OUT, name), fullPage: Boolean(full) }); console.log('saved', name); };
  try {
    await page.goto(`${BASE}/login`); await shot('01-login.png');
    await page.fill('#email', CUSTOMER.email); await page.fill('#password', CUSTOMER.password); await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard'); await page.waitForSelector('.pizza-card img');
    // The photos are lazy-loaded from an external host: load them all and wait until every one has really arrived.
    await page.evaluate(() => document.querySelectorAll('.pizza-card img').forEach((i) => { i.loading = 'eager'; }));
    await page.waitForFunction(() => { const imgs = [...document.querySelectorAll('.pizza-card img')]; return imgs.length === 6 && imgs.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 60000 });
    await shot('02-user-dashboard.png', true);
    await page.getByRole('link', { name: /Customize Margherita/ }).click(); await page.waitForURL('**/builder');
    await page.locator('input[type=radio]:not(:checked):not(:disabled)').first().check({ force: true });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('input[type=radio]:not(:checked):not(:disabled)').first().check({ force: true });
    await shot('03-pizza-builder.png');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Review pizza' }).click();
    await page.getByRole('button', { name: 'Continue to summary' }).click(); await page.waitForURL('**/order-summary');
    await page.selectOption('#quantity', '2'); await page.waitForTimeout(1500); await shot('04-order-summary.png', true);
    await page.evaluate(() => localStorage.clear());
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const a = await ctx.newPage();
    await a.goto(`${BASE}/admin/login`); await a.fill('#email', admin.email); await a.fill('#password', admin.password); await a.click('button[type=submit]');
    await a.waitForURL('**/admin/dashboard'); await a.waitForLoadState('networkidle'); await a.waitForTimeout(800);
    await a.screenshot({ path: path.join(OUT, '06-admin-dashboard.png') }); console.log('saved 06-admin-dashboard.png');
    await a.goto(`${BASE}/admin/inventory`); await a.waitForLoadState('networkidle');
    const low = before.find((i) => i.category === 'vegetable' && i.active);
    const thr = a.getByLabel(`Low-stock threshold for ${low.name}`);
    await thr.fill(String(low.stock + 25)); await a.getByRole('button', { name: `Save changes for ${low.name}` }).click();
    await a.getByText('Saved.').first().waitFor(); await thr.scrollIntoViewIfNeeded(); await a.waitForTimeout(800);
    await a.screenshot({ path: path.join(OUT, '07-admin-inventory.png') }); console.log('saved 07-admin-inventory.png');
  } finally {
    await browser.close();
    for (const i of before) {
      const restore = { $set: { stock: i.stock, lowStockThreshold: i.threshold, active: i.active } };
      if (i.alertState) restore.$set.lowStockAlertState = i.alertState; else restore.$unset = { lowStockAlertState: 1 };
      await db.models.InventoryItem.updateOne({ _id: i.id }, restore);
    }
    await db.deleteDemoAccount(CUSTOMER.email);
    await db.disconnect();
    console.log('inventory restored, demo account removed');
  }
})().catch((e) => { console.error('FAILED:', e.message.slice(0, 160).replace(/\s+/g, ' ')); process.exitCode = 1; });
