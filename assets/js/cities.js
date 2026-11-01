/* 全站縣市清單（入口頁的卡片與地圖、入口頁功能表、各縣市頁的「切換縣市」選單共用）
 * 新增縣市：在這裡加一筆並設 on: true，建立同名資料夾即可。img 為相對於網站根目錄的路徑。 */
(function (root) {
  "use strict";
  var CITIES = [
    { slug: "chiayi-city", name: "嘉義市", nick: "桃城・木都・畫都", lat: 23.4805, lng: 120.4525, on: true,
      img: "chiayi-city/img/beimen-0.webp", credit: "北門驛／勤岸，CC BY-SA 3.0",
      desc: "54 處有形文化資產、16 項無形文化資產，阿里山林業鐵道從這裡出發。" },
    { slug: "chiayi-county", name: "嘉義縣", nick: "山海之間：新港・朴子・阿里山", lat: 23.50, lng: 120.40, on: true,
      img: "chiayi-county/img/fengtian-temple-0.webp", credit: "新港奉天宮／Peellden，CC BY-SA 3.0",
      desc: "60 處有形文化資產、23 項無形文化資產，從布袋海岸到阿里山森林鐵道。" },
    { slug: "yunlin-county", name: "雲林縣", nick: "媽祖・糖廠・布袋戲：北港・虎尾・西螺", lat: 23.70, lng: 120.43, on: true,
      img: "yunlin-county/img/beigang-chaotiangong-0.webp", credit: "北港朝天宮／K44965，CC BY-SA 3.0",
      desc: "124 處有形文化資產：北港朝天宮、西螺大橋、虎尾糖廠與上百處日式建築；目前沒有 YouBike。" },
    { slug: "", name: "臺南市", nick: "府城四百年", lat: 22.99, lng: 120.20 },
    { slug: "", name: "彰化縣", nick: "鹿港・八卦山", lat: 24.07, lng: 120.54 },
    { slug: "", name: "臺中市", nick: "舊城・霧峰林家", lat: 24.14, lng: 120.68 },
    { slug: "", name: "臺北市", nick: "大稻埕・艋舺", lat: 25.05, lng: 121.51 },
    { slug: "", name: "高雄市", nick: "打狗・哈瑪星", lat: 22.62, lng: 120.28 },
    { slug: "", name: "宜蘭縣", nick: "噶瑪蘭・頭城", lat: 24.75, lng: 121.75 }
  ];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var open = CITIES.filter(function (c) { return c.on; });
  var soon = CITIES.filter(function (c) { return !c.on; });

  /* 縣市頁：切換縣市選單（base 為回到網站根目錄的相對路徑，例如 "../"） */
  function cityMenu(el, current, base) {
    if (!el) return;
    el.innerHTML = '<p class="cm-title">切換縣市</p>' + open.map(function (c) {
      var on = c.slug === current;
      return '<a href="' + base + c.slug + '/"' + (on ? ' aria-current="page"' : "") + '><b>' + esc(c.name) + '</b><span>' + (on ? "目前所在" : esc(c.nick.split("：")[0])) + '</span></a>';
    }).join("") +
      (soon.length ? '<p class="cm-soon">籌備中：' + soon.map(function (c) { return esc(c.name); }).join("、") + '</p>' : "") +
      '<a class="cm-home" href="' + base + '">回全站首頁（全部縣市）</a>';
  }

  /* 入口頁：右上角功能表 */
  function portalNav(el) {
    if (!el) return;
    el.innerHTML = '<a href="#cities">縣市地圖</a>' + open.map(function (c) { return '<a href="' + c.slug + '/">' + esc(c.name) + '</a>'; }).join("");
  }

  /* 點選單外面時收起 */
  if (root.document) root.document.addEventListener("click", function (e) {
    var d = root.document.querySelector("details.city-switch[open]");
    if (d && !d.contains(e.target)) d.removeAttribute("open");
  });

  root.SiteCities = { list: CITIES, open: open, soon: soon, cityMenu: cityMenu, portalNav: portalNav, esc: esc };
})(this);
