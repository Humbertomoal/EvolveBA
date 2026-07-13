const { chromium } = require("playwright");
const OUT = "C:/Users/HUMBER~1/AppData/Local/Temp/claude/C--Users-Humberto-MA-OneDrive---Evolve-BA-Documentos-Software--Compras-App---Compras-cyrgo-compras/16e34ad3-d357-4954-ba11-8e5d7ed49980/scratchpad";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console error]", msg.text());
  });

  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);

  await page.goto("http://localhost:3000/comprador/licitaciones/nueva", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /Agregar producto/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Agregar producto/ }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);

  const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  console.log("documentElement.scrollWidth:", bodyScrollWidth, "viewport width:", viewportWidth);
  console.log("PAGE HAS HORIZONTAL OVERFLOW:", bodyScrollWidth > viewportWidth);

  const wrapperInfo = await page.locator("table").first().evaluate((tableEl) => {
    const wrapper = tableEl.parentElement;
    return {
      wrapperScrollWidth: wrapper.scrollWidth,
      wrapperClientWidth: wrapper.clientWidth,
      wrapperOverflowX: getComputedStyle(wrapper).overflowX,
      tableWidth: tableEl.getBoundingClientRect().width,
    };
  });
  console.log("table wrapper info:", JSON.stringify(wrapperInfo));
  console.log("TABLE WRAPPER SCROLLS INTERNALLY:", wrapperInfo.wrapperScrollWidth > wrapperInfo.wrapperClientWidth);

  await page.screenshot({ path: `${OUT}/overflow-nueva-viewport.png` });
  console.log("Saved overflow-nueva-viewport.png");

  // Scroll the table wrapper itself to confirm it actually scrolls internally.
  await page.locator("table").first().evaluate((tableEl) => {
    tableEl.parentElement.scrollLeft = 300;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/overflow-nueva-scrolled.png` });
  console.log("Saved overflow-nueva-scrolled.png");

  await browser.close();
})().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
