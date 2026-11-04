// 入口頁測試：縣市卡片、地圖小卡（「開始逛」）、右上角選單的連結都要開得到（兩個網站），
// 代表照片要載得到，地圖標籤的避讓結果（顯示／隱藏）印出來對照，並截圖（桌機、手機）。
// 用法（先在第一網站 repo 根目錄啟動 python3 tools/serve.py 8766 &）：
//   NODE_PATH=$(npm root -g) node tools/newcity/tests/portal.js
// 截圖存在 /tmp/newcity/shots/portal-*.png；最後一行印出 no errors 才算通過。
const { chromium } = require('playwright');
const fs = require('fs');
const HOST = 'http://localhost:' + (process.env.PORT || 8766);
const OUT = process.env.SHOTS || '/tmp/newcity/shots';  // 截圖目錄，可用環境變數 SHOTS 改
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const mobile of [false, true]) {
    const sfx = mobile ? '-m' : '';
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 760 } : { width: 1366, height: 860 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(HOST + (process.env.PORTAL_PATH || '/Cultural_Heritage/'), { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      cards: [...document.querySelectorAll('#cityList a.city')].map(a => [a.href, a.querySelector('img').src, a.querySelector('img').complete && a.querySelector('img').naturalWidth > 0]),
      menu: [...document.querySelectorAll('#portalNav .city-menu a')].map(a => a.href),
      labels: [...document.querySelectorAll('.leaflet-tooltip.city-tip:not(.soon)')].map(e => e.textContent + (e.classList.contains('tt-hide') ? '（隱藏）' : '')),
      open: SiteCities.open.map(c => [c.name, c.site])
    }));
    console.log((mobile ? '手機' : '桌機') + ' 標籤：' + info.labels.join('、'));
    if (!mobile) console.log('開放縣市：' + info.open.map(c => c[0] + (c[1] > 1 ? '（第' + c[1] + '網站）' : '')).join('、'));
    // 入口頁改版後地圖不在第一屏：捲到地圖再只截地圖本身
    await page.$eval('#twmap', e => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    await (await page.$('#twmap')).screenshot({ path: `${OUT}/portal-map${sfx}.png` });
    await page.$eval('#cities', e => e.scrollIntoView());
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/portal-cities${sfx}.png` });
    if (mobile) { await page.close(); continue; }
    // 地圖小卡：每個開放縣市點標籤 → 小卡 → 開始逛 的連結與照片
    const pops = [];
    const n = await page.$$eval('.leaflet-tooltip.city-tip:not(.soon)', a => a.length);
    for (let i = 0; i < n; i++) {
      const r = await page.evaluate(async i => {
        const el = document.querySelectorAll('.leaflet-tooltip.city-tip:not(.soon)')[i];
        el.click();
        await new Promise(r => setTimeout(r, 400));
        const pop = document.querySelector('.leaflet-popup-content .mp');
        if (!pop) return { label: el.textContent, err: '沒有小卡' };
        const img = pop.querySelector('img');
        await new Promise(r => img.complete ? r() : (img.onload = img.onerror = r));
        return { label: el.textContent, href: pop.querySelector('a.btn').href, img: img.src, ok: img.naturalWidth > 0 };
      }, i);
      if (r.err) errors.push(r.label + '：' + r.err); else pops.push(r);
      if (!r.ok && !r.err) errors.push('小卡照片沒有載入：' + r.label + ' ' + r.img);
      if (i === 0) await page.screenshot({ path: `${OUT}/portal-popup.png` });
    }
    console.log('小卡：' + pops.map(p => p.label + ' → ' + new URL(p.href).pathname).join('、'));
    for (const c of info.cards) {  // 卡片照片是 lazy loading，直接請求檢查
      const r = await page.request.get(c[1]);
      if (!r.ok()) errors.push('卡片照片沒有載入 ' + r.status() + '：' + c[1]);
    }
    const urls = new Set(info.cards.map(c => c[0]).concat(info.menu, pops.map(p => p.href)));
    for (const u of urls) {
      const r = await page.request.get(u);
      if (!r.ok()) errors.push('連結失效 ' + r.status() + '：' + u);
    }
    console.log('連結檢查：' + urls.size + ' 個（卡片 ' + info.cards.length + '、選單 ' + info.menu.length + '、小卡 ' + pops.length + '）');
    await page.close();
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
