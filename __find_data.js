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

  await page.goto("http://localhost:3000/comprador/licitaciones-proceso", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const links = await page.locator('table a[href*="/comprador/licitaciones-proceso/"]').evaluateAll(els =>
    els.map(e => e.getAttribute("href"))
  );
  console.log("all links:", JSON.stringify(links));

  for (const link of links) {
    await page.goto(`http://localhost:3000${link}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Mejores Precios" }).click();
    await page.waitForTimeout(300);
    const hasOffers = await page.locator("text=Sin ofertas").count();
    const rows = await page.locator("table tbody tr").count();
    console.log(link, "rows:", rows, "sinOfertasCount:", hasOffers);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
