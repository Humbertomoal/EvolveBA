const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) console.log("NAVIGATED:", f.url());
  });
  page.on("load", () => console.log("LOAD EVENT fired at", new Date().toISOString()));

  await page.goto("http://localhost:3000/login", { timeout: 60000 });
  await page.locator("#email").fill("admin@cyrgo.com");
  await page.locator("#password").fill("Admin2026!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });

  await page.goto("http://localhost:3000/comprador/configuracion/catalogos", { timeout: 60000 });
  await page.waitForSelector("text=Monedas");

  // Switch to "Familias de Producto" tab (middle tab, the example the user gave)
  await page.getByRole("button", { name: "Familias de Producto" }).click();
  await page.waitForTimeout(300);

  // Open edit modal on first row of that tab
  const firstEditBtn = page.locator("table tbody tr").first().locator('button[title="Editar"]');
  await firstEditBtn.click();
  await page.waitForSelector("text=Editar valor");

  // Modify the "Nombre" field to a genuinely different value
  const nombreInput = page.locator('input[placeholder="Nombre visible en el sistema"]');
  const current = await nombreInput.inputValue();
  await nombreInput.fill(current + " EDITADO");

  await page.getByRole("button", { name: /Guardar/ }).click();
  await page.waitForTimeout(1500);

  // Which tab button is now highlighted (has the primary color class)?
  const tabButtons = page.locator("div.border-b.border-zinc-200 button");
  const count = await tabButtons.count();
  let activeLabel = null;
  for (let i = 0; i < count; i++) {
    const cls = await tabButtons.nth(i).getAttribute("class");
    if (cls && cls.includes("border-[var(--color-primario)]")) {
      activeLabel = await tabButtons.nth(i).textContent();
      break;
    }
  }
  console.log("Active tab AFTER save:", activeLabel);

  await browser.close();
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
