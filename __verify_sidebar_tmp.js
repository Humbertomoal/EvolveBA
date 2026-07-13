const { chromium } = require("playwright");

const OUT = "C:\\Users\\HUMBER~1\\AppData\\Local\\Temp\\claude\\C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras\\16e34ad3-d357-4954-ba11-8e5d7ed49980\\scratchpad";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console error]", msg.text());
  });
  page.on("pageerror", (err) => console.log("[page error]", err.message));

  console.log("Navigating to login...");
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });

  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  console.log("Current URL after login:", page.url());

  await page.waitForSelector("aside", { timeout: 15000 });

  // Screenshot expanded state
  await page.screenshot({ path: `${OUT}\\sidebar-expanded.png` });
  console.log("Saved sidebar-expanded.png");

  // Check bottom of sidebar has no duplicate collapse button (only one toggle button total)
  const toggleButtons = await page.locator('aside button[title*="Colapsar"], aside button[title*="Expandir"]').count();
  console.log("Toggle button count (expanded state):", toggleButtons);

  // Click the toggle button
  const toggleBtn = page.locator('aside button[title*="Colapsar"], aside button[title*="Expandir"]').first();
  await toggleBtn.click();
  await page.waitForTimeout(400); // allow 200ms transition + buffer

  await page.screenshot({ path: `${OUT}\\sidebar-collapsed.png` });
  console.log("Saved sidebar-collapsed.png");

  const asideWidthCollapsed = await page.locator("aside").evaluate((el) => el.getBoundingClientRect().width);
  console.log("Aside width after collapse click:", asideWidthCollapsed);

  const toggleButtonsCollapsed = await page.locator('aside button[title*="Colapsar"], aside button[title*="Expandir"]').count();
  console.log("Toggle button count (collapsed state):", toggleButtonsCollapsed);

  // Click again to expand back
  await page.locator('aside button[title*="Colapsar"], aside button[title*="Expandir"]').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}\\sidebar-expanded-again.png` });
  console.log("Saved sidebar-expanded-again.png");

  const asideWidthExpanded = await page.locator("aside").evaluate((el) => el.getBoundingClientRect().width);
  console.log("Aside width after expand click:", asideWidthExpanded);

  // Check localStorage key
  const stored = await page.evaluate(() => window.localStorage.getItem("sidebar-collapsed"));
  console.log("localStorage sidebar-collapsed value:", stored);

  await browser.close();
})().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
