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
  // 沙箱連不到 unpkg 時，可設 LEAFLET_DIR 指向本機的 leaflet/dist（例如 npm pack leaflet@1.9.4 解開後的 package/dist）
  if (process.env.LEAFLET_DIR) await page.route('**/unpkg.com/leaflet@1.9.4/dist/**', route => {
    const f = require('path').join(process.env.LEAFLET_DIR, new URL(route.request().url()).pathname.split('/dist/')[1]);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, headers: { 'content-type': f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'application/javascript' : 'image/png' }, body: fs.readFileSync(f) });
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
  if (!mobile && info.town) {
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
  // 離島：自選本島＋離島景點，檢查跨海路段都改成「搭船／搭機」，不會開車或騎車過海
  const isl = await page.evaluate(() => (CY.config.planner || {}).islands || []);
  if (isl.length) {
    for (const mode of ['car', 'scooter', 'bike']) {
      const r = await page.evaluate(async (mode) => {
        const I = CY.config.planner.islands;
        const zone = p => I.findIndex(i => p[0] >= i.bbox[0] && p[0] <= i.bbox[2] && p[1] >= i.bbox[1] && p[1] <= i.bbox[3]);
        const main = CY.sites.filter(s => zone([s.lat, s.lng]) < 0).slice(0, 4), off = CY.sites.filter(s => zone([s.lat, s.lng]) >= 0);
        main.concat(off).forEach(s => Planner.addPick(s.id));
        document.querySelector('#pPick .chip[data-v="custom"]').click();
        document.querySelector('#pMode .chip[data-v="' + mode + '"]').click();
        document.querySelector('#pGo').click();
        await new Promise(r => setTimeout(r, 1500));
        const plan = Planner.current(), bad = []; let sea = 0;
        plan.days.forEach((d, di) => {
          let prev = d.start;
          d.stops.forEach(x => {
            const cross = zone(prev) !== zone([x.s.lat, x.s.lng]);
            if (cross && !x.leg.sea) bad.push('第' + (di + 1) + '天 ' + x.s.name + ' 跨海卻不是搭船');
            if (!cross && x.leg.sea) bad.push('第' + (di + 1) + '天 ' + x.s.name + ' 沒跨海卻標搭船');
            if (x.leg.sea) sea++;
            prev = [x.s.lat, x.s.lng];
          });
          const zs = new Set(d.stops.map(x => zone([x.s.lat, x.s.lng])));
          if (zs.size > 1) bad.push('第' + (di + 1) + '天 同一天跨了 ' + zs.size + ' 區');
        });
        const gm = [...document.querySelectorAll('#planOut a[href*="google.com/maps/dir"]')].map(a => new URL(a.href));
        gm.forEach(u => {
          const pts = [u.searchParams.get('origin')].concat((u.searchParams.get('waypoints') || '').split('|').filter(Boolean), [u.searchParams.get('destination')]).map(t => t.split(',').map(Number));
          if (new Set(pts.map(zone)).size > 1) bad.push('Google 導航連結跨海：' + u.href.slice(0, 80));
        });
        const txt = document.querySelector('#planOut').innerText;
        return { days: plan.days.length, picks: main.length + off.length, sea, seaText: (txt.match(/搭船／搭機/g) || []).length, bad };
      }, mode);
      console.log('ISLAND ' + mode + ':', JSON.stringify(r));
      if (r.bad.length || !r.sea) errors.push('island planner (' + mode + '): ' + (r.bad.join('；') || '沒有任何跨海路段'));
    }
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/${slug}-plan-island${sfx}.png` });
    await page.evaluate(() => { localStorage.clear(); });
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
