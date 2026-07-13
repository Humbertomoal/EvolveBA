const { chromium } = require("playwright");
const OUT = "C:/Users/HUMBER~1/AppData/Local/Temp/claude/C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras/16e34ad3-d357-4954-ba11-8e5d7ed49980/scratchpad";
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

  const btn = page.locator('button', { hasText: 'Solar Center' });
  console.log("btn count:", await btn.count());
  await btn.click({ force: true, timeout: 5000 });
  await page.waitForTimeout(500);

  const tableCount = await page.locator("table").count();
  console.log("table count after click:", tableCount);

  if (tableCount > 0) {
    const info = await page.locator("table").first().evaluate((t) => {
      const wrapper = t.parentElement;
      return {
        tableWidth: t.getBoundingClientRect().width,
        wrapperScrollWidth: wrapper.scrollWidth,
        wrapperClientWidth: wrapper.clientWidth,
        overflowX: getComputedStyle(wrapper).overflowX,
      };
    });
    console.log("info:", JSON.stringify(info));
  }
  await page.screenshot({ path: `${OUT}/captura-manual-expanded3.png` });
  console.log("saved");
  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
