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
    { slug: "tainan-city", name: "臺南市", nick: "府城四百年：赤崁・安平・鹽水", lat: 23.00, lng: 120.20, on: true,
      img: "tainan-city/img/zhongxi-kongzimiao-0.webp", credit: "臺南孔子廟／王彥翔，CC BY-SA 3.0",
      desc: "246 處有形文化資產、99 項無形文化資產：赤崁樓、孔子廟、安平古堡、億載金城等 21 處國定古蹟，府城與安平可騎 YouBike 串遊。" },
    { slug: "kaohsiung-city", name: "高雄市", nick: "打狗到港都：哈瑪星・左營舊城・美濃", lat: 22.62, lng: 120.30, on: true,
      img: "kaohsiung-city/img/gushan-dagouyingguoling-0.webp", credit: "打狗英國領事館官邸／WEI, WAN-CHEN（魏琬臻），CC BY-SA 4.0",
      desc: "132 處有形文化資產、44 項無形文化資產：打狗英國領事館、旗後礮臺、鳳山縣舊城、鳳山龍山寺等 7 處國定古蹟，哈瑪星與鹽埕可騎 YouBike 串遊。" },
    { slug: "pingtung-county", name: "屏東縣", nick: "阿猴・六堆・恆春半島", lat: 22.55, lng: 120.55, on: true,
      img: "pingtung-county/img/hengchun-gucheng-0.webp", credit: "恆春古城／Orion tw，CC BY-SA 3.0",
      desc: "114 處有形文化資產、63 項無形文化資產：恆春古城、鵝鑾鼻燈塔、魯凱族好茶舊社、下淡水溪鐵橋 4 處國定古蹟，還有六堆客家庄與排灣族石板屋聚落。" },
    { slug: "taitung-county", name: "臺東縣", nick: "後山：史前遺址・縱谷・綠島蘭嶼", lat: 22.80, lng: 121.15, on: true,
      img: "taitung-county/img/taidong-jiuzhanjiguancheku-0.webp", credit: "臺東舊站機關車庫／Pbdragonwang，CC BY-SA 3.0",
      desc: "60 處有形文化資產、22 項無形文化資產：卑南、八仙洞、都蘭考古遺址，日治移民村、鐵道與糖廠，還有綠島人權文化園區與蘭嶼部落。" },
    { slug: "kinmen-county", name: "金門縣", nick: "浯島：閩南古厝・僑鄉洋樓・戰地史蹟", lat: 24.44, lng: 118.33, on: true,
      img: "kinmen-county/img/jincheng-wentaibaota-0.webp", credit: "文臺寶塔／寺人孟子，CC BY-SA 4.0",
      desc: "251 處有形文化資產：文臺寶塔、邱良功母節孝坊、瓊林蔡氏祠堂等 10 處國定古蹟，153 處閩南古厝與僑鄉洋樓，還有古寧頭、八二三砲戰的坑道與碉堡；可開上金門大橋到烈嶼。" },
    { slug: "yilan-county", name: "宜蘭縣", nick: "蘭陽：噶瑪蘭・泰雅・林業・日式宿舍", lat: 24.75, lng: 121.75, on: true,
      img: "yilan-county/img/yilan-shezhijinianguan-0.webp", credit: "宜蘭設治紀念館／大三可，CC BY-SA 4.0",
      desc: "144 處有形文化資產：宜蘭設治紀念館、頭城老街、舊草嶺隧道、羅東林場與太平山林業遺產、漢本與丸山考古遺址，宜蘭市區的日式宿舍與二戰飛機掩體；另有本地歌仔、北管、頭城搶孤等無形文化資產。" },
    { slug: "", name: "彰化縣", nick: "鹿港・八卦山", lat: 24.07, lng: 120.54 },
    { slug: "", name: "臺中市", nick: "舊城・霧峰林家", lat: 24.14, lng: 120.68 },
    { slug: "", name: "臺北市", nick: "大稻埕・艋舺", lat: 25.05, lng: 121.51 }
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
