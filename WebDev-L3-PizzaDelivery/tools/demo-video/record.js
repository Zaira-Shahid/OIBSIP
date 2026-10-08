// Records the demo video with Playwright (1280x720, slowMo) against the BUILT client on :5273 and API on :5100
// (start them first: see README of this folder). Writes raw.webm and scenes.json (caption windows) into OUT.
// Nothing is faked: the payment scene shows the real failure; the test scene replays the real output of a test run.
// Usage: node record.js <outDir>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const db = require('./lib/db');

const BASE = 'http://localhost:5273';
const OUT = path.resolve(process.argv[2]);
const REGISTER = { name: 'Zaira Demo', email: 'zairashahid370+demo@gmail.com', password: 'DemoPizza2026' };
const CUSTOMER = { name: 'Demo Customer', email: 'customer@demo.invalid', password: 'DemoPizza2026' };
fs.mkdirSync(OUT, { recursive: true });

const scenes = [];
let before = [];
let t0 = 0;
const now = () => (Date.now() - t0) / 1000;
async function scene(caption, fn) {
  const start = now();
  try {
    await fn();
  } catch (e) {
    console.log(`SKIPPED: ${caption.slice(0, 60)} (${e.message.slice(0, 80).replace(/ +/g, " ")})`);
    return;
  }
  scenes.push({ caption, start, end: now() });
  console.log(`scene ${scenes.length} ${start.toFixed(1)}-${now().toFixed(1)}s ${caption}`);
}

const cardHtml = (lines, small) => `<!doctype html><meta charset=utf-8><body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#1c1210;color:#fff;font-family:Segoe UI,Arial,sans-serif;text-align:center;padding:0 90px;box-sizing:border-box">
${lines.map((l, i) => `<div style="font-size:${i === 0 ? 46 : 32}px;margin:12px 0;font-weight:${i === 0 ? 700 : 400};color:${i === 0 ? '#ffb347' : '#fff'}">${l}</div>`).join('')}
${small ? `<div style="font-size:22px;margin-top:30px;color:#cbb">${small}</div>` : ''}`;


(async () => {
  await db.connect();
  const adminCreds = db.adminCredentials();
  await db.deleteDemoAccount(REGISTER.email);
  await db.createVerifiedUser(CUSTOMER);
  before = await db.stockSnapshot();

  const browser = await chromium.launch({ headless: true, slowMo: 700 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const page = await context.newPage();
  t0 = Date.now();
  const pause = (ms) => page.waitForTimeout(Math.round(ms * 1.9));
  const logout = async () => { await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };

  await scene('Full Name: Zaira Shahid  |  Track: Web Development & Designing  |  Task: Pizza Delivery Full-Stack Application', async () => {
    await page.setContent(cardHtml(['Full Name: Zaira Shahid', 'Track: Web Development &amp; Designing', 'Task: Pizza Delivery Full-Stack Application']));
    await pause(4000);
  });

  await scene('Landing page', async () => {
    await page.goto(BASE);
    await pause(2500);
    await page.mouse.wheel(0, 500); await pause(1800);
    await page.mouse.wheel(0, 600); await pause(1800);
    await page.mouse.wheel(0, -1100); await pause(1000);
  });

  // The form is filled and checked by the live validation; it is never submitted, so no account is created.
  await scene('Register page: form validation', async () => {
    await page.goto(`${BASE}/register`);
    await page.fill('#name', REGISTER.name);
    await page.fill('#email', 'not-an-email');
    await page.fill('#password', 'short');
    await page.fill('#confirmPassword', 'different');
    await pause(800);
    await page.click('button[type=submit]');
    await pause(3500);
    await page.fill('#email', REGISTER.email);
    await page.fill('#password', REGISTER.password);
    await page.fill('#confirmPassword', REGISTER.password);
    await pause(3000);
  });

  await scene('Customer login and dashboard with six preset pizzas', async () => {
    await page.goto(`${BASE}/login`);
    await logout();
    await page.goto(`${BASE}/login`);
    await page.fill('#email', CUSTOMER.email);
    await page.fill('#password', CUSTOMER.password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await pause(2500);
    await page.mouse.wheel(0, 450); await pause(2000);
    await page.mouse.wheel(0, -450); await pause(800);
  });

  await scene('Custom Pizza Builder - 4 steps: base, sauce, cheese, vegetables', async () => {
    await page.getByRole('link', { name: /Customize Margherita/ }).click();
    await page.waitForURL('**/builder');
    await pause(2200);
    for (let step = 0; step < 3; step++) {
      await page.locator('input[type=radio]:not(:checked):not(:disabled)').first().check({ force: true });
      await pause(1500);
      await page.getByRole('button', { name: 'Next' }).click(); await pause(900);
    }
    const veg = page.locator('input[type=checkbox]:not(:checked):not(:disabled)');
    for (let i = 0; i < 3; i++) { await veg.first().check({ force: true }); await pause(900); }
    await page.getByRole('button', { name: 'Review pizza' }).click();
    await pause(3000);
  });

  await scene('Order summary: itemised prices and quantity', async () => {
    await page.getByRole('button', { name: 'Continue to summary' }).click();
    await page.waitForURL('**/order-summary');
    await page.waitForLoadState('networkidle');
    await pause(2000);
    await page.selectOption('#quantity', '2');
    await pause(4500);
  });

  await scene('Forgot password page', async () => {
    await page.goto(`${BASE}/forgot-password`);
    await logout();
    await page.goto(`${BASE}/forgot-password`);
    await pause(4000);
  });

  await scene('Staff login and admin dashboard', async () => {
    await page.goto(`${BASE}/admin/login`);
    await pause(1200);
    await page.fill('#email', adminCreds.email);
    await page.fill('#password', adminCreds.password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await pause(4000);
  });

  await scene('Inventory: 4 categories, status badges, +10 restock, Low stock badge', async () => {
    await page.getByRole('link', { name: 'Manage inventory' }).click();
    await page.waitForURL('**/admin/inventory');
    await page.waitForLoadState('networkidle');
    await pause(2000);
    await page.mouse.wheel(0, 600); await pause(1500);
    await page.mouse.wheel(0, 700); await pause(1500);
    await page.mouse.wheel(0, -1300); await pause(800);
    const target = before.find((i) => i.category === 'vegetable' && i.active);
    await page.getByRole('button', { name: `Add 10 to ${target.name}` }).click();
    await page.getByText('Added 10.').first().waitFor({ timeout: 15000 });
    await pause(2500);
    const low = before.filter((i) => i.category === 'vegetable' && i.active && i.name !== target.name)[0];
    const thr = page.getByLabel(`Low-stock threshold for ${low.name}`);
    await thr.scrollIntoViewIfNeeded();
    await thr.fill(String(low.stock + 25));
    await page.getByRole('button', { name: `Save changes for ${low.name}` }).click();
    await page.getByText('Saved.').first().waitFor({ timeout: 15000 });
    await pause(4500);
  });

  await scene('Admin orders', async () => {
    if ((await db.models.Order.countDocuments({ status: { $exists: true, $ne: null } })) === 0) throw new Error('no real orders to show');
    await page.goto(`${BASE}/admin/orders`);
    await page.waitForLoadState('networkidle');
    await pause(5000);
  });

  await scene('React, Node.js, Express, MongoDB, Razorpay (test mode)  |  github.com/Zaira-Shahid/OIBSIP', async () => {
    await page.setContent(cardHtml(['Pizza Delivery Full-Stack Application', 'React · Node.js · Express · MongoDB · Razorpay (test mode)', 'github.com/Zaira-Shahid/OIBSIP'], 'Zaira Shahid - Web Development &amp; Designing'));
    await pause(6000);
  });

  const total = now();
  const video = await page.video().path();
  await context.close();
  await browser.close();
  fs.renameSync(video, path.join(OUT, 'raw.webm'));
  fs.writeFileSync(path.join(OUT, 'scenes.json'), JSON.stringify({ total, scenes }, null, 1));
  console.log('recorded', total.toFixed(1), 's');
})().catch(async (e) => {
  console.error('RECORD FAILED:', e.message.slice(0, 120).replace(/\s+/g, ' '));
  process.exitCode = 1;
}).finally(async () => {
  // Always put the inventory back exactly as it was and remove the throw-away account and its orders.
  try {
    for (const i of before) {
      const restore = { $set: { stock: i.stock, lowStockThreshold: i.threshold, active: i.active } };
      if (i.alertState) restore.$set.lowStockAlertState = i.alertState;
      else restore.$unset = { lowStockAlertState: 1 };
      await db.models.InventoryItem.updateOne({ _id: i.id }, restore);
    }
    await db.deleteDemoAccount(CUSTOMER.email);
    console.log('inventory restored, demo account removed');
    await db.disconnect();
  } catch (e) {
    console.error('cleanup problem:', e.message);
  }
});
