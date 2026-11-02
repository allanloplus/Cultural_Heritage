// 縣市頁冒煙測試：各分頁截圖、行政區篩選、行程規劃（開車三日、YouBike 一日）、時光排序與擲骰遊戲
// 用法（先在 repo 根目錄啟動：python3 tools/serve.py 8766 &）：
//   NODE_PATH=$(npm root -g) node tools/newcity/tests/city_smoke.js kaohsiung-city          # 桌機
//   NODE_PATH=$(npm root -g) node tools/newcity/tests/city_smoke.js kaohsiung-city mobile   # 手機
// 截圖存在 /tmp/newcity/shots/<slug>-*.png；最後一行印出 no errors 才算通過。
// 這個沙箱的代理不允許瀏覽器直接連路線服務（網址含分號），所以路線請求改用 curl 轉送。
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const slug = process.argv[2];
const mobile = process.argv[3] === 'mobile';
if (!slug) { console.log('usage: node city_smoke.js <slug> [mobile]'); process.exit(2); }
const OUT = '/tmp/newcity/shots';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 760 } : { width: 1366, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/routing|youbike|ORB|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  await page.route('**/routing.openstreetmap.de/**', async route => {
    let body; try { body = execFileSync('curl', ['-s', '--max-time', '20', route.request().url()]); } catch (e) { return route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' }); }
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body });
  });
  const sfx = mobile ? '-m' : '';
  const base = 'http://localhost:8766/' + slug + '/';
  await page.goto(base + '#home', { waitUntil: 'load' }); await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const towns = {}; CY.sites.forEach(s => { towns[s.town] = (towns[s.town] || 0) + 1; });
    const top = CY.sites.filter(s => s.images.length).sort((a, b) => CY.categories.indexOf(a.category) - CY.categories.indexOf(b.category))[0] || CY.sites[0];
    return { site: top.id, town: Object.entries(towns).sort((a, b) => b[1] - a[1])[0][0], n: CY.sites.length, ich: CY.ich.items.length, venues: CY.ich.venues.length, ubike: CY.ubike.stations.length };
  });
  console.log('data:', JSON.stringify(info));
  for (const [name, hash, wait] of [['home', '#home', 1500], ['map', '#map', 3000], ['site', '#map/' + info.site, 3000], ['time', '#time/japan', 4000], ['games', '#games', 1000], ['about', '#about', 800]]) {
    await page.goto(base + hash, { waitUntil: 'load' });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${slug}-${name}${sfx}.png` });
  }
  const badge = await page.goto(base + '#map/' + info.site, { waitUntil: 'load' }).then(() => page.waitForTimeout(1500)).then(() => page.$eval('#dPlayer .dlg-badge', e => e.textContent).catch(() => '(no player)'));
  console.log('site voice:', badge);
  if (!mobile) {
    await page.goto(base + '#map', { waitUntil: 'load' }); await page.waitForTimeout(1500);
    await page.selectOption('#townSel', info.town); await page.waitForTimeout(1200);
    console.log('town filter', info.town + ':', await page.$eval('#count', e => e.textContent));
  }
  await page.goto(base + '#plan', { waitUntil: 'load' }); await page.waitForTimeout(1500);
  await page.click('#pDays .chip[data-v="3"]'); await page.click('#pMode .chip[data-v="car"]'); await page.click('#pGo');
  await page.waitForTimeout(9000);
  console.log('CAR 3 days:', (await page.$eval('#planOut', e => e.innerText)).split('\n')[0]);
  await page.screenshot({ path: `${OUT}/${slug}-plan${sfx}.png` });
  if (info.ubike) {
    await page.click('#pDays .chip[data-v="1"]'); await page.click('#pMode .chip[data-v="ubike"]', { force: true }); await page.click('#pGo');
    await page.waitForTimeout(6000);
    const t = await page.$eval('#planOut', e => e.innerText);
    console.log('UBIKE 1 day:', t.split('\n')[0], '| borrow/return lines:', (t.match(/借/g) || []).length, '/', (t.match(/還/g) || []).length);
  }
  await page.goto(base + '#games', { waitUntil: 'load' }); await page.waitForTimeout(800);
  await page.click('.game-card[data-g="timeline"]'); await page.waitForTimeout(300);
  for (let i = 0; i < 5; i++) { await page.click('.tl-hand .tl-card'); await page.waitForTimeout(120); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${slug}-timeline${sfx}.png` });
  await page.click('.game-card[data-g="board"]'); await page.waitForTimeout(400); await page.click('#roll'); await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${slug}-board${sfx}.png` });
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
