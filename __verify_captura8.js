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
  await page.goto("http://localhost:3000/comprador/licitaciones-proceso/cmrcj3fht000204jvm13ai72b/captura-manual", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const urlBefore = page.url();
  await page.locator('button', { hasText: 'Solar Center' }).click();
  await page.waitForTimeout(300);
  console.log("url after click:", page.url(), "changed:", page.url() !== urlBefore);
  const html = await page.locator('div.space-y-2').innerHTML();
  console.log("accordion container html len:", html.length);
  console.log(html.slice(0, 1500));
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
