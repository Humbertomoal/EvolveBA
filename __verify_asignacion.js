const { chromium } = require("playwright");
const OUT = "C:/Users/HUMBER~1/AppData/Local/Temp/claude/C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras/16e34ad3-d357-4954-ba11-8e5d7ed49980/scratchpad";
const LIC_ID = "cmrcjm2az000204layj0ez5d3"; // 0026, Cerrada

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console error]", msg.text());
  });
  page.on("pageerror", (err) => console.log("[page error]", err.message));

  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);

  await page.goto(`http://localhost:3000/comprador/seleccion-proveedores/${LIC_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/asignacion-antes.png`, fullPage: true });
  console.log("saved asignacion-antes.png");

  // Editar el precio unitario de la primera fila
  const precioInput = page.locator("table tbody tr").first().locator('input[type="number"]').last();
  await precioInput.fill("999");
  await precioInput.blur();
  await page.waitForTimeout(300);

  // Editar la fecha estimada de la primera fila
  const fechaInput = page.locator("table tbody tr").first().locator('input[type="date"]').first();
  await fechaInput.fill("2026-12-25");
  await page.waitForTimeout(300);

  await page.screenshot({ path: `${OUT}/asignacion-editado.png`, fullPage: true });
  console.log("saved asignacion-editado.png");

  // Click en restablecer
  const resetBtn = page.locator("table tbody tr").first().locator('button[title="Restablecer a la oferta original"]');
  await resetBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/asignacion-restablecido.png`, fullPage: true });
  console.log("saved asignacion-restablecido.png");

  await browser.close();
})().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
