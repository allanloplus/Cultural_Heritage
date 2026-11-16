/* 產生分享連結時的預覽圖（1200×630）：入口頁 assets/og.jpg 與每個縣市的 <縣市>/og.jpg
 * 需要 Node 與 Playwright；字型要連網。第二網站的縣市會寫進 Cultural_Heritage2 的資料夾（環境變數 CH2_DIR，沒設就找本 repo 旁邊）。
 *
 *   node tools/og.js               全部
 *   node tools/og.js tainan-city   只做指定的縣市
 *
 * 版面在 tools/og.html。新增縣市或換代表照片後重跑，兩個 repo 都要提交。 */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.dirname(__dirname);
const CH2 = process.env.CH2_DIR || path.join(path.dirname(ROOT), "Cultural_Heritage2");
const MIME = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png" };

(async () => {
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split("?")[0]), dir = ROOT;
    if (u.startsWith("/__ch2/")) { dir = CH2; u = u.slice(6); }
    const p = path.join(dir, u);
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = "http://127.0.0.1:" + server.address().port;
  const want = process.argv.slice(2);
  const cities = [];
  for (const [dir, prefix] of [[ROOT, "/"], [CH2, "/__ch2/"]]) {
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir)) if (fs.existsSync(path.join(dir, d, "data", "config.json")) && (!want.length || want.includes(d))) cities.push([d, dir, prefix]);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  async function shot(url, out) {
    await page.goto(base + url);
    await page.waitForSelector("body[data-ready]", { timeout: 60000 });
    await page.screenshot({ path: out, type: "jpeg", quality: 86 });
    console.log(out);
  }
  if (!want.length) await shot("/tools/og.html?mode=portal", path.join(ROOT, "assets", "og.jpg"));
  for (const [slug, dir, prefix] of cities) await shot("/tools/og.html?slug=" + slug + "&base=" + prefix + slug + "/", path.join(dir, slug, "og.jpg"));
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
