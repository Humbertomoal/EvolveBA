const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);
  await page.goto("http://localhost:3000/comprador/licitaciones-proceso", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.click('button:has-text("Cotización Manual")').catch(() => {});
  await page.waitForTimeout(300);
  const links = await page.locator('a[href*="captura-manual"]').evaluateAll(els => els.map(e => e.getAttribute("href")));
  console.log("captura-manual links:", JSON.stringify(links));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
