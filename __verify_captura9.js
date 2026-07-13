const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on("console", (msg) => console.log("[console]", msg.type(), msg.text().slice(0,200)));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', "admin@cyrgo.com");
  await page.fill('input[type="password"]', "Admin2026!");
  await Promise.all([
    page.waitForURL(/\/comprador/, { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);
  await page.goto("http://localhost:3000/comprador/licitaciones-proceso/cmrcj3fht000204jvm13ai72b/captura-manual", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const box = await page.locator('button', { hasText: 'Solar Center' }).boundingBox();
  const elInfo = await page.evaluate(({x,y}) => {
    const el = document.elementFromPoint(x, y);
    return el ? { tag: el.tagName, cls: el.className, text: el.textContent?.slice(0,50) } : null;
  }, { x: box.x + box.width/2, y: box.y + box.height/2 });
  console.log("elementFromPoint at click coords:", JSON.stringify(elInfo));

  // Check if React has hydrated by looking for a React internal marker
  const hydrated = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Solar Center'));
    if (!btn) return "no button found";
    const keys = Object.keys(btn).filter(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers') || k.startsWith('__reactFiber'));
    return { keys, hasOnClick: keys.length > 0 };
  });
  console.log("hydration check:", JSON.stringify(hydrated));

  await browser.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
