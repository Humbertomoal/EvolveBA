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
  await page.waitForTimeout(500);

  // Expand the first provider accordion so the table renders.
  const header = page.locator("button", { hasText: /./ }).filter({ has: page.locator("text=/./") });
  const accordionBtn = page.locator("div.space-y-2 > div > button").first();
  const count = await accordionBtn.count();
  console.log("accordion buttons found:", count);
  if (count > 0) {
    await accordionBtn.click();
    await page.waitForTimeout(300);
  }

  const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  console.log("documentElement.scrollWidth:", bodyScrollWidth, "viewport:", viewportWidth);

  const tableCount = await page.locator("table").count();
  console.log("table count:", tableCount);
  if (tableCount > 0) {
    const info = await page.locator("table").first().evaluate((t) => {
      const wrapper = t.parentElement;
      return {
        wrapperScrollWidth: wrapper.scrollWidth,
        wrapperClientWidth: wrapper.clientWidth,
        overflowX: getComputedStyle(wrapper).overflowX,
      };
    });
    console.log("captura-manual table wrapper info:", JSON.stringify(info));
  }

  await page.screenshot({ path: `${OUT}/captura-manual-check.png` });
  console.log("saved captura-manual-check.png");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
