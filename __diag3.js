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
  await page.goto("http://localhost:3000/comprador/licitaciones/nueva", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Agregar producto/ }).click();
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    const main = document.querySelector("main");
    const table = document.querySelector("table");
    let chain = [];
    let el = table;
    while (el) {
      const cs = getComputedStyle(el);
      chain.push({
        tag: el.tagName,
        cls: el.className && el.className.slice ? el.className.slice(0, 60) : el.className,
        display: cs.display,
        minWidth: cs.minWidth,
        width: cs.width,
        overflowX: cs.overflowX,
        rectWidth: el.getBoundingClientRect().width,
      });
      el = el.parentElement;
    }
    return { mainOuterHTML: main ? main.outerHTML.slice(0, 200) : null, chain };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
