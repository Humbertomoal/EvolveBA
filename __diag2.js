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
    const tables = Array.from(document.querySelectorAll("table"));
    const select = document.querySelector('table select');
    const selectCS = select ? getComputedStyle(select) : null;
    const th = document.querySelector('table th');
    const thCS = th ? getComputedStyle(th) : null;
    return {
      tableCount: tables.length,
      tableRects: tables.map(t => t.getBoundingClientRect()),
      wrapperRects: tables.map(t => t.parentElement.getBoundingClientRect()),
      selectWidth: selectCS ? selectCS.width : null,
      selectClass: select ? select.className : null,
      thWidth: thCS ? thCS.width : null,
      thClass: th ? th.className : null,
      tableLayout: tables[0] ? getComputedStyle(tables[0]).tableLayout : null,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
