// 全站語音核對：每個開放縣市的每一段對話，語音檔的每一句都要和文字一致（FNV 雜湊相符）
// 用法（先在第一網站 repo 根目錄啟動 python3 tools/serve.py 8766 &，它會同時提供 /Cultural_Heritage/ 與 /Cultural_Heritage2/）：
//   NODE_PATH=$(npm root -g) node tools/newcity/tests/cues_all.js
//   NODE_PATH=$(npm root -g) node tools/newcity/tests/cues_all.js /Cultural_Heritage2/taipei-city/   # 另外核對還沒開放的縣市頁
// 兩個網站的開放縣市都會核對（網址依 assets/js/cities.js 的 site 欄位）。
// 每個縣市印出 {"ok":N,"bad":[...]}；bad 不是空的，就要重跑 tools/gen_audio.py。
// 徽章顯示「預錄語音」才是播預先合成的檔案；顯示「使用瀏覽器內建語音」表示語音檔不符或缺少。
const { chromium } = require('playwright');
const HOST = 'http://localhost:' + (process.env.PORT || 8766);
const PORTAL = HOST + '/Cultural_Heritage/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(PORTAL, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  console.log('portal badge:', await page.$eval('.dlg-badge', e => e.textContent));
  const cities = await page.evaluate(() => SiteCities.open.map(c => [c.slug, c.site, SiteCities.href(c, '/Cultural_Heritage/')]));
  process.argv.slice(2).forEach(p => cities.push([p, 0, p]));
  let bad = 0;
  for (const [city, site, path] of cities) {
    const url = new URL(path, HOST).href;
    await page.goto(url, { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const out = { ok: 0, bad: [] };
      const chk = (t, lines) => { const c = (window.AUDIO_CUES || {})[t]; const ok = c && c.cues.length === lines.length && c.cues.every((q, k) => q[2] === Voice.fnv(lines[k].text)); ok ? out.ok++ : out.bad.push(t); };
      CY.sites.forEach(s => chk('site-' + s.id, s.dialogue));
      CY.eras.forEach(e => { if (e.dialogue && e.dialogue.length) chk('era-' + e.id, e.dialogue); });
      CY.ich.items.forEach(i => { if (i.dialogue && i.dialogue.length) chk(i.id, i.dialogue); });
      [['intro', CY.extra.intro], ['time-intro', CY.extra.timeIntro], ['plan-intro', CY.extra.planIntro], ['game-intro', CY.extra.gameIntro], ['reactions', CY.extra.reactions]].forEach(p => chk(p[0], p[1]));
      out.first = CY.sites[0].id;
      return out;
    });
    bad += r.bad.length;
    await page.goto(url + '#map/' + r.first, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const badge = await page.$eval('#dPlayer .dlg-badge', e => e.textContent).catch(() => '(no player)');
    console.log(city + (site > 1 ? '（第' + site + '網站）' : ''), JSON.stringify({ ok: r.ok, bad: r.bad }), '|', badge);
  }
  console.log(errors.length ? errors.join('\n') : 'no errors', '| mismatched tracks:', bad);
  await browser.close();
})();
