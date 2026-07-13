const { chromium } = require("playwright");
const OUT = "C:/Users/HUMBER~1/AppData/Local/Temp/claude/C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras/16e34ad3-d357-4954-ba11-8e5d7ed49980/scratchpad";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);
  await page.goto("http://localhost:3000/comprador/seleccion-proveedores", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("table").first().evaluate((t) => { t.parentElement.scrollLeft = 999; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/seleccion-tabla-scrolled.png` });
  console.log("saved");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
