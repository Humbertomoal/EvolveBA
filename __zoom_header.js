const { chromium } = require("playwright");
const OUT = "C:/Users/HUMBER~1/AppData/Local/Temp/claude/C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras/16e34ad3-d357-4954-ba11-8e5d7ed49980/scratchpad";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
  await page.waitForSelector("aside");

  await page.locator("aside").screenshot({ path: `${OUT}/aside-expanded-crop.png` });

  const btn = page.locator('aside button[title*="Colapsar"], aside button[title*="Expandir"]').first();
  await btn.screenshot({ path: `${OUT}/toggle-btn-expanded.png` });
  console.log("outerHTML:", await btn.evaluate((el) => el.outerHTML));

  await btn.click();
  await page.waitForTimeout(400);
  await page.locator("aside").screenshot({ path: `${OUT}/aside-collapsed-crop.png` });
  const btn2 = page.locator('aside button[title*="Colapsar"], aside button[title*="Expandir"]').first();
  await btn2.screenshot({ path: `${OUT}/toggle-btn-collapsed.png` });
  console.log("outerHTML2:", await btn2.evaluate((el) => el.outerHTML));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
