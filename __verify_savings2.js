const { chromium } = require("playwright");
const OUT = "C:/Users/HUMBER~1/AppData/Local/Temp/claude/C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras/16e34ad3-d357-4954-ba11-8e5d7ed49980/scratchpad";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on("pageerror", (err) => console.log("[page error]", err.message));

  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);

  await page.goto("http://localhost:3000/comprador/licitaciones-proceso/cmqsi3rmf0000y0ke8qiq424w", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/real-participantes.png`, fullPage: true });

  // Open the "Ver detalle" modal
  await page.locator('button[title="Ver detalle por ronda"]').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/real-modal-historial.png`, fullPage: true });

  // Close modal, switch tab
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator('button:has-text("Cerrar")').first().click().catch(() => {});
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Mejores Precios" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/real-mejores.png`, fullPage: true });

  console.log("done");
  await browser.close();
})().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
