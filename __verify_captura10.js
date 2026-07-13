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

  const btn = page.getByRole('button', { name: /Solar Center/ });
  await btn.waitFor({ state: "visible" });
  await btn.click();

  try {
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Solar Center'));
      return btn && btn.querySelector('.tabler-icon-chevron-down');
    }, { timeout: 3000 });
    console.log("TOGGLE WORKED: chevron-down appeared");
  } catch (e) {
    console.log("TOGGLE DID NOT WORK within 3s");
  }

  console.log("table count:", await page.locator("table").count());
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
