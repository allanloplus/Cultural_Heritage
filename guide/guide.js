/* 文資旅行地圖（guide/）：Allan 與阿拉蕾帶你逛全系列網站
 * 底圖圖形在 geo.js（tools/guide_geo.py 產生）；縣市清單與網址取自 ../assets/js/cities.js。
 * 網址 #knowledge、#visit、#rail、#town、#ascent、#atlas、#all 直接打開地圖上的那一站。 */
(function () {
  "use strict";
  var G = window.GUIDE_GEO, SC = window.SiteCities;
  var CH = "../assets/characters/";
  var NS = "http://www.w3.org/2000/svg";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- 六個網站 ---------- */
  var SITES = {
    knowledge: { name: "文資知識網", url: "https://cultural.123hi.org/", host: "cultural.123hi.org・cultural2.123hi.org", stamp: "起點<br>核心", color: "var(--k-knowledge)",
      feat: ["22 縣市文資地圖", "雙人語音導覽", "時光地圖：七個時期老地圖", "行程規劃・YouBike 即時", "知識遊戲・文資護照", "全站搜尋 4,215 筆"],
      talk: [["A", "talk", "這裡是整個系列的家：文資知識網。22 個縣市的每一處文資，都有介紹、照片和我們倆的語音導覽。"],
             ["R", "present", "還有時光地圖可以疊上老地圖，行程規劃連 YouBike 都幫你排好，玩完遊戲還能蓋文資護照！"],
             ["A", "point", "不知道在哪個縣市？首頁的全站搜尋一次找 4,215 筆，打「鹿港」或「劉銘傳」都行。地圖上的紅點也可以直接點。"]] },
    visit: { name: "文資達人訪查", url: "https://cultural-visit.123hi.org/", host: "cultural-visit.123hi.org", stamp: "實地<br>現況", color: "var(--k-visit)",
      feat: ["現況・開放情形", "推薦星等與五項評分", "實地照片與心得", "附近美食・住宿・交通", "查核覆蓋率", "訪查行程・紀錄搜尋"],
      talk: [["R", "explain", "書上寫的是歷史，可是它「現在」長什麼樣子？這就要看文資達人訪查啦！"],
             ["A", "smile", "核准的文資達人親自到現場，記下現況、開放情形、推薦星等和照片，連附近好吃好住的都寫。第一趟就是金門。"],
             ["R", "thumb", "知識網的景點頁有「達人實地訪查」按鈕，一按就跳過來看最新現況！"]] },
    rail: { name: "搭火車逛文資", url: "https://cultural-rail.123hi.org/", host: "cultural-rail.123hi.org", stamp: "免開車", color: "var(--k-rail)",
      feat: ["臺鐵 16 條路線", "242 個車站", "步行 15 分鐘內的文資", "下車就有文資排行榜", "勾選車站排行程"],
      talk: [["A", "wave", "不想開車？那就搭火車！臺鐵 16 條路線、242 個車站，每一站走路 15 分鐘內有哪些文資，一目了然。"],
             ["R", "laugh", "還有排行榜：哪一站一下車文資最多、哪一站走最短的路就看到國定古蹟！看，地圖上的小火車正在環島喔～"],
             ["A", "wink", "在路線圖上勾幾個車站，就是一趟小旅行，網址傳給朋友就能一起出發。"]] },
    town: { name: "鄉鎮文資性格卡", url: "https://cultural-town.123hi.org/", host: "cultural-town.123hi.org", stamp: "368<br>張卡", color: "var(--k-town)",
      feat: ["368 個鄉鎮市區", "19 種性格類型", "意外的事實與排名", "全臺跟你最像的鄉鎮", "下載卡片分享"],
      talk: [["R", "present", "猜猜你的家鄉是什麼性格？全臺 368 個鄉鎮市區，每一個都有一張用文資算出來的性格卡。"],
             ["A", "laugh", "一共 19 種性格，從清代信仰重鎮到戰後產業型都有；連一處文資都沒有的鄉鎮，也有專屬的卡。"],
             ["R", "wave", "它還會告訴你全臺跟你最像的是哪個鄉鎮。下載卡片貼給朋友，比比誰的家鄉比較特別！"]] },
    ascent: { name: "從海口到山頂", url: "https://cultural-ascent.123hi.org/", host: "cultural-ascent.123hi.org", stamp: "海拔", color: "var(--k-ascent)",
      feat: ["文資住在多高", "溯河而上：淡水河、濁水溪", "越嶺古道 5 條", "高度剖面", "不作登山導航"],
      talk: [["A", "think", "你知道嗎？全臺 3,032 處有形文資，有一半住在海拔 20 公尺以下，500 公尺以上只有 51 處。"],
             ["R", "surprised", "那山上那幾處是怎麼上去的？"],
             ["A", "point", "「從海口到山頂」幫你找答案：看文資住在多高，沿淡水河和濁水溪溯河而上，再翻過五條越嶺古道。地圖上的藍線和褐色虛線就是它們。"],
             ["R", "explain", "提醒一下：古道頁是用來認識歷史的，不能拿來當登山導航喔！"]] },
    atlas: { name: "文資地圖集", url: "https://cultural-atlas.123hi.org/", host: "cultural-atlas.123hi.org", stamp: "3D<br>全景", color: "var(--k-atlas)",
      feat: ["3D 文資島・8 站導覽", "島怎麼長出來", "它挺過了什麼：地震與颱風", "文資風險地圖"],
      talk: [["R", "surprised", "哇，太平洋上浮起一座島！"],
             ["A", "talk", "那是文資地圖集的 3D 文資島：三千多處文資變成一根根柱子，還能看整座島從 1550 年怎麼一路長出來。"],
             ["R", "think", "它也推估每處文資挺過哪些大地震和颱風，再疊上淹水、斷層這些災害潛勢。"],
             ["A", "smile", "最重要的是，它整理的全臺文資主檔，鐵道、性格卡、海口到山頂都在用，是大家的共同底子。"]] },
    all: { name: "全部串起來", url: "https://cultural.123hi.org/", host: "六個網站，一趟旅程", stamp: "環島<br>完成", color: "var(--ink)",
      feat: [],
      talk: [["A", "wave", "看出來了嗎？知識網是核心：資料從這裡流出去，各站整理出新的看法，最後每一處文資都連回知識網。"],
             ["R", "laugh", "就像環島鐵路一樣，一圈串起來！藍色線是資料怎麼流，紅色線是連結怎麼走。"],
             ["A", "smile", "往下捲，選一種你喜歡的玩法出發吧！"]] }
  };
  var ORDER = ["knowledge", "visit", "rail", "town", "ascent", "atlas", "all"];
  var SHORT = { knowledge: "知識網", visit: "達人訪查", rail: "搭火車", town: "性格卡", ascent: "海口到山頂", atlas: "地圖集" };

  /* 網站之間的關係：data＝資料怎麼流，link＝連結怎麼走 */
  var EDGES = [
    { a: "knowledge", b: "visit", k: "data", t: "訪查站的全臺文資清單（有形、無形、古物）由兩個知識網站產生。" },
    { a: "knowledge", b: "atlas", k: "data", t: "地圖集把兩個知識網站的資料整理成全臺文資主檔（3,032 處）。" },
    { a: "atlas", b: "rail", k: "data", t: "鐵道版用地圖集的文資主檔，算出每個車站走路可到的文資。" },
    { a: "atlas", b: "town", k: "data", t: "性格卡用同一份主檔，算出 368 個鄉鎮市區的性格。" },
    { a: "atlas", b: "ascent", k: "data", t: "海口到山頂用同一份主檔與地形資料，算出每處文資的海拔。" },
    { a: "visit", b: "knowledge", k: "link", t: "知識網的景點頁有「達人實地訪查」按鈕；訪查紀錄也連回文資知識頁。" },
    { a: "rail", b: "knowledge", k: "link", t: "鐵道版的每張文資卡片，都連回知識網的同一處。" },
    { a: "town", b: "knowledge", k: "link", t: "性格卡上的代表文資與清單，都連回知識網。" },
    { a: "ascent", b: "knowledge", k: "link", t: "海拔、河流、古道上的文資，都連回知識網。" },
    { a: "atlas", b: "knowledge", k: "link", t: "地圖集上點任何一處，都連回知識網的那一處。" },
    { a: "town", b: "rail", k: "link", t: "鄉鎮頁列出區內的臺鐵車站，連到鐵道版的車站頁。" },
    { a: "ascent", b: "rail", k: "link", t: "走路可到車站的文資，連到鐵道版的車站頁。" }
  ];

  /* ---------- 地圖 ---------- */
  var svg = $("#mapSvg");
  var W = G.w, H = G.h, S = G.spots;
  /* 地標：icon＝圖示位置，sign＝路牌中心（連線的端點），lead＝拉一條虛線指到的地方 */
  var LM = {
    knowledge: { icon: [160, 598], sign: [150, 648], lead: [217.5, 605] },
    visit: { icon: [131, 212], sign: [104, 296] },
    rail: { icon: [336, 152], sign: [300, 192], lead: [393.7, 155] },
    town: { icon: [176, 330], sign: [168, 376], lead: S.lukang },
    ascent: { icon: S.yushan, sign: [470, 525] },
    atlas: { icon: [570, 592], sign: [560, 654] },
    all: { sign: [330, 450] }
  };

  function el(tag, attrs, html) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html) e.innerHTML = html;
    return e;
  }

  function icon(key) {
    var p = LM[key].icon, x = p[0], y = p[1];
    switch (key) {
      case "knowledge": /* 城門：府城大南門的樣子 */
        return '<g class="bob"><path class="lm-paper" d="M' + (x - 22) + "," + (y + 14) + "h44v-22h-44z" + '"/>' +
          '<path class="lm-fill" d="M' + (x - 7) + "," + (y + 14) + "v-10a7,7 0 0 1 14,0v10z" + '" opacity=".85"/>' +
          '<path class="lm-paper" d="M' + (x - 16) + "," + (y - 8) + "h32v-9h-32z" + '"/>' +
          '<path class="lm-fill" d="M' + (x - 26) + "," + (y - 15) + "q26,-6 52,0l-6,-9q-20,-5 -40,0z" + '"/>' +
          '<path class="lm-fill" d="M' + (x - 19) + "," + (y - 27) + "q19,-5 38,0l-5,-7q-14,-4 -28,0z" + '"/></g>';
      case "visit": /* 放大鏡＋筆記本 */
        return '<g class="bob"><rect class="lm-paper" x="' + (x - 18) + '" y="' + (y - 6) + '" width="22" height="27" rx="2" transform="rotate(-8 ' + x + " " + y + ')"/>' +
          '<path class="lm-ink" d="M' + (x - 14) + "," + (y + 2) + "h13M" + (x - 14) + "," + (y + 8) + "h13M" + (x - 14) + "," + (y + 14) + "h9" + '" transform="rotate(-8 ' + x + " " + y + ')"/>' +
          '<circle class="lm-paper" cx="' + (x + 10) + '" cy="' + (y - 4) + '" r="10" stroke-width="3" style="stroke:var(--lmc)"/>' +
          '<path d="M' + (x + 17) + "," + (y + 3) + "l9,9" + '" stroke-width="4" stroke-linecap="round" style="stroke:var(--lmc)"/></g>';
      case "rail": /* 老車站站房 */
        return '<g class="bob"><path class="lm-paper" d="M' + (x - 16) + "," + (y + 12) + "v-14h32v14z" + '"/>' +
          '<path class="lm-fill" d="M' + (x - 21) + "," + (y - 2) + "l21,-13l21,13z" + '"/>' +
          '<rect class="lm-fill" x="' + (x - 4) + '" y="' + (y + 3) + '" width="8" height="9" opacity=".8"/>' +
          '<circle class="lm-paper" cx="' + x + '" cy="' + (y - 5) + '" r="3"/></g>';
      case "town": /* 三張扇形排開的性格卡 */
        return '<g class="bob">' + [-16, 0, 16].map(function (r, i) {
          return '<g transform="rotate(' + r + " " + x + " " + (y + 22) + ')"><rect class="lm-paper" x="' + (x - 11) + '" y="' + (y - 16) + '" width="22" height="30" rx="3"/>' +
            '<rect class="lm-fill" x="' + (x - 8) + '" y="' + (y - 13) + '" width="16" height="10" rx="1.5" opacity="' + (0.5 + i * 0.25) + '"/>' +
            '<path class="lm-ink" d="M' + (x - 7) + "," + (y + 2) + "h14M" + (x - 7) + "," + (y + 7) + "h9" + '" stroke-width="1"/></g>';
        }).join("") + "</g>";
      case "ascent": /* 玉山頂上的小旗 */
        return '<path class="lm-ink" d="M' + x + "," + y + "v-30" + '" stroke-width="1.8"/><path class="flag lm-fill" d="M' + x + "," + (y - 30) + "h17l-4,6l4,6h-17z" + '"/>' +
          '<circle cx="' + x + '" cy="' + y + '" r="3" class="lm-fill"/>' +
          '<text class="mp-small" x="' + (x + 6) + '" y="' + (y + 12) + '">玉山 3,952 m</text>';
      case "atlas": /* 浮在海上的 3D 文資島：一排長高的柱子＋羅盤 */
        var bars = [14, 26, 18, 34, 22, 12, 28], s = "";
        bars.forEach(function (h, i) {
          var bx = x - 28 + i * 8, by = y + 14 - (i % 2) * 3;
          s += '<rect x="' + bx + '" y="' + (by - h) + '" width="6" height="' + h + '" rx="1" style="animation-delay:' + (i * 0.25) + 's;fill:' + ["var(--k-knowledge)", "var(--k-rail)", "var(--k-visit)", "var(--k-atlas)"][i % 4] + '"/>';
        });
        return '<ellipse class="lm-paper" cx="' + x + '" cy="' + (y + 16) + '" rx="40" ry="9"/><g class="bars">' + s + "</g>";
    }
    return "";
  }

  function sign(key, n) {
    var p = LM[key].sign, name = SITES[key].name, w = name.length * 14 + 34;
    return '<g class="lm-sign" data-x="' + p[0] + '" data-y="' + p[1] + '"><rect x="' + (-w / 2) + '" y="-13" width="' + w + '" height="26" rx="13"/>' +
      '<circle class="lm-dot" cx="' + (-w / 2 + 13) + '" cy="0" r="8.5"/><text class="lm-no" x="' + (-w / 2 + 13) + '" y="3" text-anchor="middle">' + n + "</text>" +
      '<text x="' + (-w / 2 + 26) + '" y="4.5">' + esc(name) + "</text></g>";
  }

  function arcD(a, b, bend) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    var cx = mx - dy * bend, cy = my + dx * bend;
    return "M" + a[0] + "," + a[1] + "Q" + cx.toFixed(1) + "," + cy.toFixed(1) + " " + b[0] + "," + b[1];
  }

  function buildMap() {
    var h = '<defs><pattern id="waves" width="34" height="18" patternUnits="userSpaceOnUse"><path d="M2,12q6,-6 12,0t12,0" fill="none" stroke="var(--sea-line)" stroke-width="1" opacity=".7"/></pattern>' +
      '<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .35  0 0 0 0 .2  0 0 0 .06 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>';
    h += '<rect width="' + W + '" height="' + H + '" fill="url(#waves)"/>';
    h += '<text class="mp-sea" x="96" y="560" writing-mode="vertical-rl">臺灣海峽</text><text class="mp-sea" x="610" y="250" writing-mode="vertical-rl">太平洋</text>';
    /* 金門、馬祖小框 */
    for (var k in G.insets) {
      var b = G.insets[k].box;
      h += '<rect class="mp-inset" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="6"/>';
      G.insets[k].land.forEach(function (d, i) { if (d) h += '<path class="' + (i ? "mp-band mp-l" + i : "mp-coast") + '" d="' + d + '"/>'; });
      h += '<text class="mp-label" x="' + (b[0] + b[2] - 6) + '" y="' + (b[1] + b[3] - 7) + '" text-anchor="end">' + (k === "kinmen" ? "金門" : "馬祖") + "</text>";
    }
    /* 本島與澎湖：海岸線與四層山 */
    G.main.forEach(function (d, i) { h += '<path class="' + (i ? "mp-band mp-l" + i : "mp-coast") + '" fill-rule="evenodd" d="' + d + '"/>'; });
    h += '<text class="mp-label" x="430" y="300" opacity=".75" letter-spacing="6" writing-mode="vertical-rl">中央山脈</text>';
    /* 河、古道、鐵道 */
    for (var r in G.rivers) h += '<path class="mp-river" d="' + G.rivers[r] + '"/><path class="mp-river-flow" d="' + G.rivers[r] + '"/>';
    for (var t in G.trails) h += '<path class="mp-trail" d="' + G.trails[t] + '"/>';
    G.railBranches.forEach(function (d) { h += '<path class="mp-branch" d="' + d + '"/>'; });
    h += '<path class="mp-rail" d="' + G.railCoast + '"/><path class="mp-rail-tie" d="' + G.railCoast + '"/>';
    h += '<path class="mp-rail" id="railLoop" d="' + G.rail + '"/><path class="mp-rail-tie" d="' + G.rail + '"/>';
    h += '<g id="arcs"></g><g class="train" id="train"></g>';
    /* 22 個縣市（知識網） */
    var byslug = {};
    (SC ? SC.list : []).forEach(function (c) { byslug[c.slug] = c; });
    h += '<g id="pins">' + G.pins.map(function (p) {
      var c = byslug[p[0]]; if (!c || !c.on) return "";
      var label = c.mapLabel || c.name, right = p[1] < 330;
      return '<a class="mp-pin" href="' + esc(SC.href(c, "../")) + '" aria-label="' + esc((c.label || c.name) + "：開啟知識網的縣市地圖") + '">' +
        '<circle cx="' + p[1] + '" cy="' + p[2] + '" r="5"/><text x="' + (p[1] + (right ? -8 : 8)) + '" y="' + (p[2] + 3.5) + '" text-anchor="' + (right ? "end" : "start") + '">' + esc(label) + "</text></a>";
    }).join("") + "</g>";
    /* 地標 */
    ORDER.slice(0, 6).forEach(function (key, i) {
      var L = LM[key];
      h += '<g class="lm lm-' + key + '" data-key="' + key + '" tabindex="0" role="button" aria-label="第 ' + (i + 1) + " 站：" + SITES[key].name + '">' +
        (L.lead ? '<path class="lm-lead" d="M' + L.icon[0] + "," + L.icon[1] + "L" + L.lead[0] + "," + L.lead[1] + '"/>' : "") +
        icon(key) + sign(key, i + 1) + "</g>";
    });
    /* 圖框：標題、圖例、比例尺、羅盤 */
    var km50 = 50 / 111.2 * 250;
    h += '<g transform="translate(16 772)"><rect class="lm-paper" width="232" height="106" rx="8" filter="url(#paper)" style="stroke-width:1.5"/>' +
      '<text class="mp-label" x="14" y="26" font-size="17" font-weight="700">臺灣文資旅行圖</text>' +
      '<text class="mp-small" x="14" y="42">Allan Lo 和你逛文化・全系列</text>' +
      '<circle cx="20" cy="58" r="4.5" style="fill:var(--peach);stroke:#fff;stroke-width:1.2"/><text class="mp-small" x="30" y="61">知識網縣市</text>' +
      '<path class="mp-rail" d="M104,58h22" style="stroke-width:2.6"/><path class="mp-rail-tie" d="M104,58h22"/><text class="mp-small" x="131" y="61">臺鐵</text>' +
      '<path class="mp-river" d="M14,76h14"/><text class="mp-small" x="32" y="79">溯河而上</text>' +
      '<path class="mp-trail" d="M104,76h22"/><text class="mp-small" x="131" y="79">越嶺古道</text>' +
      '<path d="M14,94h' + km50.toFixed(1) + '" stroke="var(--map-ink)" stroke-width="3"/><path d="M14,90v8M' + (14 + km50 / 2).toFixed(1) + ",92v4M" + (14 + km50).toFixed(1) + ',90v8" stroke="var(--map-ink)" stroke-width="1.2"/>' +
      '<text class="mp-small" x="' + (20 + km50).toFixed(1) + '" y="97">50 公里</text></g>';
    h += '<g transform="translate(606 836)"><circle r="24" class="lm-paper"/><path d="M0,-21l6,21l-6,21l-6,-21z" style="fill:var(--k-knowledge)"/><path d="M0,0l6,0l-6,21z" style="fill:var(--map-ink)"/><path d="M-21,0l21,-5l21,5l-21,5z" style="fill:var(--map-ink);opacity:.35"/>' +
      '<text class="mp-label" y="-28" text-anchor="middle" font-weight="700">北</text></g>';
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.classList.add("mapsvg");
    svg.innerHTML = h;
    placeSigns();
    $$(".lm", svg).forEach(function (g) {
      g.addEventListener("click", function () { userPick(g.dataset.key); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); userPick(g.dataset.key); } });
    });
    /* 連線（網站之間） */
    var arcs = $("#arcs", svg);
    EDGES.forEach(function (e, i) {
      var p = el("path", { "class": "arc " + e.k, d: arcD(LM[e.a].sign, LM[e.b].sign, e.k === "data" ? 0.18 : -0.18), "data-a": e.a, "data-b": e.b });
      arcs.appendChild(p);
    });
  }

  /* 路牌在手機上會縮得太小：依地圖實際寬度放大，維持大約同樣的字級 */
  function placeSigns() {
    var w = svg.getBoundingClientRect().width || W, k = Math.min(1.7, Math.max(1.25, (W / w) * 1.1));
    $$(".lm-sign", svg).forEach(function (s) { s.setAttribute("transform", "translate(" + s.dataset.x + " " + s.dataset.y + ") scale(" + k.toFixed(2) + ")"); });
  }

  /* 環島小火車：三節車廂沿著鐵道跑一圈約 45 秒 */
  function runTrain() {
    var path = $("#railLoop", svg), g = $("#train", svg);
    if (!path || !path.getTotalLength) return;
    var L = path.getTotalLength(), cars = [];
    for (var i = 0; i < 3; i++) {
      var c = el("g", {}, '<rect x="-8" y="-4.5" width="16" height="9" rx="2.5" style="fill:' + (i ? "var(--k-rail)" : "var(--k-knowledge)") + ';stroke:var(--map-ink);stroke-width:1.1"/>' +
        (i ? '<rect x="-5" y="-2" width="4" height="3" fill="#fff" opacity=".85"/><rect x="1" y="-2" width="4" height="3" fill="#fff" opacity=".85"/>' : '<circle cx="4" cy="0" r="2" fill="#fff"/>'));
      g.appendChild(c); cars.push(c);
    }
    function put(d) {
      cars.forEach(function (c, i) {
        var s = ((d - i * 18) % L + L) % L, a = path.getPointAtLength(s), b = path.getPointAtLength(Math.min(L, s + 1));
        var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        c.setAttribute("transform", "translate(" + a.x.toFixed(1) + " " + a.y.toFixed(1) + ") rotate(" + ang.toFixed(0) + ")");
      });
    }
    if (reduce) { put(L * 0.36); return; }
    var t0 = performance.now();
    (function tick(now) { put(((now - t0) / 45000) * L); requestAnimationFrame(tick); })(t0);
  }

  /* ---------- 導覽面板 ---------- */
  var panel = $("#panel"), cur = null, auto = null, AUTO_MS = 11000;
  function face(who, mood) { return CH + (who === "A" ? "allan-" : "arale-") + mood + ".webp"; }
  function say(line, i) {
    var r = line[0] === "R";
    return '<div class="say' + (r ? " r" : "") + ' in" style="animation-delay:' + (i * 0.35) + 's"><img src="' + face(line[0], line[1]) + '" alt="' + (r ? "阿拉蕾" : "Allan") + '" loading="lazy">' +
      "<p><b class=\"who\">" + (r ? "阿拉蕾" : "Allan") + "</b>" + esc(line[2]) + "</p></div>";
  }
  function relList(key) {
    var list = EDGES.filter(function (e) { return key === "all" || e.a === key || e.b === key; });
    return list.map(function (e) {
      var other = key === "all" ? e.b : (e.a === key ? e.b : e.a);
      var label = key === "all" ? SHORT[e.a] + " → " + SHORT[e.b] : (e.a === key ? "→ " : "← ") + SITES[other].name;
      return '<li><button type="button" data-go="' + other + '"><span class="kd' + (e.k === "link" ? " link" : "") + '">' + (e.k === "data" ? "資料" : "連結") + "</span><span><b>" + esc(label) + "</b>　" + esc(e.t) + "</span></button></li>";
    }).join("");
  }
  function show(key, opts) {
    opts = opts || {};
    var s = SITES[key]; if (!s) return;
    cur = key;
    var i = ORDER.indexOf(key);
    panel.style.setProperty("--pc", s.color);
    panel.innerHTML = '<div class="pn-ticket"><span class="pn-step">第 ' + (i + 1) + " / " + ORDER.length + " 站" + (key === "all" ? "・終點" : "") + '</span>' +
      '<span class="pn-name">' + esc(s.name) + '</span><span class="pn-url">' + esc(s.host) + '</span><span class="pn-stamp">' + s.stamp + "</span></div>" +
      '<div class="pn-prog"><i id="prog"></i></div>' +
      '<div class="pn-body"><div class="g-duo">' + s.talk.map(say).join("") + "</div>" +
      (s.feat.length ? '<div><p class="pn-h">在這裡可以</p><ul class="pn-feat">' + s.feat.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<div><p class="pn-h">' + (key === "all" ? "所有的線" : "和其他網站的關係") + '</p><ul class="pn-rel">' + relList(key) + "</ul></div>" +
      '<div class="pn-act">' + (key !== "all" ? '<a class="btn pn-go" href="' + s.url + '" target="_blank" rel="noopener">前往' + esc(s.name) + " ↗</a>" : '<a class="btn pn-go" href="#routes">選一種玩法</a>') +
      '<span class="pn-nav"><button class="btn btn-sm" type="button" data-step="-1" aria-label="上一站"' + (i === 0 ? " disabled" : "") + '>‹ 上一站</button><button class="btn btn-sm" type="button" data-step="1" aria-label="下一站"' + (i === ORDER.length - 1 ? " disabled" : "") + ">下一站 ›</button></span></div></div>" +
      '<div class="pn-dots" role="group" aria-label="導覽站">' + ORDER.map(function (k, j) {
        return '<button type="button" data-go="' + k + '" aria-label="第 ' + (j + 1) + " 站：" + SITES[k].name + '"' + (k === key ? ' aria-current="step"' : "") + "></button>";
      }).join("") + '<button type="button" class="btn btn-sm pn-auto" id="autoBtn" aria-pressed="' + (auto ? "true" : "false") + '">' + (auto ? "❚❚ 暫停導覽" : "▶ 自動導覽") + "</button></div>";
    /* 地圖：亮起這一站、畫出相關的線 */
    svg.classList.toggle("has-on", key !== "all");
    svg.classList.toggle("on-all", key === "all");
    svg.classList.toggle("on-knowledge", key === "knowledge");
    $$(".lm", svg).forEach(function (g) { g.classList.toggle("is-on", g.dataset.key === key); });
    $$(".arc", svg).forEach(function (p) { p.classList.toggle("show", key === "all" || p.dataset.a === key || p.dataset.b === key); });
    if (opts.hash) { try { history.replaceState(null, "", "#" + key); } catch (e) { /* 不支援時不更新網址 */ } }
    if (auto) startProgress();
  }
  function startProgress() {
    var p = $("#prog"); if (!p || reduce) return;
    p.style.transition = "none"; p.style.width = "0";
    void p.offsetWidth;
    p.style.transition = "width " + AUTO_MS + "ms linear"; p.style.width = "100%";
  }
  function step(d) { var i = ORDER.indexOf(cur) + d; if (i >= 0 && i < ORDER.length) show(ORDER[i], { hash: true }); }
  function setAuto(on) {
    clearInterval(auto); auto = null;
    if (on) {
      auto = setInterval(function () {
        if (ORDER.indexOf(cur) >= ORDER.length - 1) { setAuto(false); return; }
        step(1);
      }, AUTO_MS);
    }
    show(cur);
  }
  function userPick(key) { if (auto) { clearInterval(auto); auto = null; } show(key, { hash: true }); revealPanel(); }
  /* 手機上面板在地圖下方：選了地標後，面板不在畫面裡就捲過去 */
  function revealPanel() {
    var r = panel.getBoundingClientRect();
    if (r.top > innerHeight - 120) panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  panel.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.id === "autoBtn") { setAuto(!auto); return; }
    if (b.dataset.step) { if (auto) { clearInterval(auto); auto = null; } step(+b.dataset.step); return; }
    if (b.dataset.go) { userPick(b.dataset.go); }
  });

  /* ---------- 開場對話 ---------- */
  var HERO = [["A", "嗨！我是導覽員 Allan，這張地圖帶你逛遍我們所有的文資網站。"],
    ["R", "我是 AI 小助手阿拉蕾！六個網站、一趟旅程，準備好了嗎？"],
    ["A", "知識網是起點：22 個縣市、四千多筆文資，都有介紹和語音導覽。"],
    ["R", "接著搭火車、看現況、領性格卡、爬到山頂，最後飛上 3D 文資島！"]];
  function heroTalk() {
    var b = $("#heroBubble"), i = 0, al = $(".g-allan"), ar = $(".g-arale");
    function put() {
      var l = HERO[i % HERO.length], r = l[0] === "R";
      b.className = "g-bubble" + (r ? " r" : "");
      b.innerHTML = "<b>" + (r ? "阿拉蕾" : "Allan") + "</b>" + esc(l[1]);
      if (!reduce) [al, ar].forEach(function (img, j) {
        img.animate([{ transform: "translateY(0)" }, { transform: "translateY(-8px)" }, { transform: "translateY(0)" }], { duration: 520, easing: "ease-out" });
        img.style.opacity = (j === 1) === r ? "1" : ".92";
      });
      i++;
    }
    put();
    if (!reduce) setInterval(put, 4800);
  }

  /* ---------- 關係圖 ---------- */
  var NODE = { knowledge: [260, 220], atlas: [92, 220], visit: [260, 56], rail: [428, 112], town: [428, 330], ascent: [260, 388] };
  function buildLinks() {
    var s = $("#linkSvg");
    var h = '<defs>' + ["data", "link"].map(function (k) {
      return '<marker id="ah-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style="fill:var(' + (k === "data" ? "--k-atlas" : "--k-knowledge") + ')"/></marker>';
    }).join("") + "</defs>";
    EDGES.forEach(function (e, i) {
      var a = NODE[e.a], b = NODE[e.b], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      var ra = e.a === "knowledge" ? 50 : 38, rb = e.b === "knowledge" ? 50 : 38;
      var A = [a[0] + dx / L * ra, a[1] + dy / L * ra], B = [b[0] - dx / L * (rb + 4), b[1] - dy / L * (rb + 4)];
      h += '<path class="ln-edge ' + e.k + '" data-i="' + i + '" data-a="' + e.a + '" data-b="' + e.b + '" d="' + arcD(A, B, e.k === "data" ? 0.16 : -0.16) + '" marker-end="url(#ah-' + e.k + ')"/>';
    });
    Object.keys(NODE).forEach(function (k) {
      var p = NODE[k], core = k === "knowledge", r = core ? 50 : 38, nm = SHORT[k];
      var lines = nm.length > 4 ? [nm.slice(0, 3), nm.slice(3)] : [nm];
      h += '<g class="ln-node' + (core ? " core" : "") + '" data-key="' + k + '" tabindex="0" role="button" aria-label="' + SITES[k].name + '" style="--nc:' + SITES[k].color + '">' +
        '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '"/>' +
        lines.map(function (t, j) { return '<text x="' + p[0] + '" y="' + (p[1] + 5 + (j - (lines.length - 1) / 2) * 16) + '"' + (core ? ' font-size="17"' : "") + ">" + esc(t) + "</text>"; }).join("") + "</g>";
    });
    h += '<g class="ln-legend" transform="translate(12 420)"><path d="M0,0h26" stroke="var(--k-atlas)" stroke-width="2.4"/><text x="32" y="4">資料怎麼流</text>' +
      '<path d="M120,0h26" stroke="var(--k-knowledge)" stroke-width="2.4" stroke-dasharray="6 4"/><text x="152" y="4">連結怎麼走</text></g>';
    s.innerHTML = h;
    $("#linkList").innerHTML = EDGES.map(function (e, i) {
      return '<li data-i="' + i + '" data-k="' + e.k + '" data-a="' + e.a + '" data-b="' + e.b + '"><span class="kd' + (e.k === "link" ? " link" : "") + '">' + (e.k === "data" ? "資料" : "連結") + "</span><span><b>" + SHORT[e.a] + " → " + SHORT[e.b] + "</b>　" + esc(e.t) + "</span></li>";
    }).join("");
    var mode = "all", focus = null;
    var TALK = {
      all: [["A", "point", "藍色實線是「資料」：知識網整理好的文資，流到地圖集，再分給鐵道、性格卡和海口到山頂。"], ["R", "laugh", "紅色虛線是「連結」：不管從哪一站進來，點文資都會回到知識網！"]],
      data: [["A", "talk", "資料只有一個源頭：兩個知識網站。地圖集把它整理成全臺主檔，其他網站都用同一份，所以數字對得起來。"], ["R", "thumb", "改一次知識網，大家跟著更新，好省力！"]],
      link: [["R", "present", "連結都往知識網走：看完現況、坐完火車、領完性格卡，想知道歷史就點回來。"], ["A", "smile", "性格卡和海口到山頂還會連到鐵道版的車站頁，順便告訴你怎麼搭車去。"]]
    };
    function paint() {
      $$(".ln-edge", s).forEach(function (p) {
        var m = mode === "all" || p.classList.contains(mode), f = !focus || p.dataset.a === focus || p.dataset.b === focus;
        p.classList.toggle("dim", !(m && f)); p.classList.toggle("hot", !!focus && m && f);
      });
      $$(".ln-node", s).forEach(function (n) { n.classList.toggle("hot", n.dataset.key === focus); });
      $$("#linkList li").forEach(function (li) {
        var m = mode === "all" || li.dataset.k === mode, f = !focus || li.dataset.a === focus || li.dataset.b === focus;
        li.classList.toggle("dim", !(m && f));
      });
      $("#linkTalk").innerHTML = TALK[mode].map(say).join("");
    }
    $$("#linkMode .chip").forEach(function (b) {
      b.onclick = function () { mode = b.dataset.mode; $$("#linkMode .chip").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); paint(); };
    });
    $$(".ln-node", s).forEach(function (n) {
      function tog() { focus = focus === n.dataset.key ? null : n.dataset.key; paint(); }
      n.addEventListener("click", tog);
      n.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog(); } });
      n.addEventListener("mouseenter", function () { if (!focus) { focus = n.dataset.key; paint(); focus = null; } });
      n.addEventListener("mouseleave", function () { if (!focus) paint(); });
    });
    paint();
  }

  /* ---------- 旅人路線 ---------- */
  var ROUTES = [
    { id: "weekend", label: "週末想出門", steps: [
      ["rail", "選一條線，看哪一站走路就有文資", "https://cultural-rail.123hi.org/#/rank"],
      ["knowledge", "做功課：看介紹、聽語音導覽、排行程", "https://cultural.123hi.org/"],
      ["visit", "出發前看現況：開了沒、好不好逛", "https://cultural-visit.123hi.org/#latest"]],
      talk: [["A", "wink", "搭火車最輕鬆：先在鐵道版挑車站，再到知識網排好路線。"], ["R", "thumb", "出門前記得看達人訪查，免得白跑一趟！"]] },
    { id: "home", label: "帶孩子認識家鄉", steps: [
      ["town", "查家鄉的性格卡，看它是哪一型", "https://cultural-town.123hi.org/"],
      ["knowledge", "打開縣市的時光地圖，疊上老地圖", "https://cultural.123hi.org/#cities"],
      ["knowledge", "玩知識遊戲，蓋文資護照", "https://cultural.123hi.org/#cities"]],
      talk: [["R", "laugh", "先比比看誰的家鄉性格比較酷！"], ["A", "smile", "再用時光地圖看家門口一百年前長什麼樣子，最後用遊戲複習。"]] },
    { id: "data", label: "愛看大局的資料控", steps: [
      ["atlas", "3D 文資島：看整座島怎麼長出來", "https://cultural-atlas.123hi.org/"],
      ["ascent", "文資住在多高、沿河往上游", "https://cultural-ascent.123hi.org/"],
      ["town", "19 種性格的鄉鎮分布", "https://cultural-town.123hi.org/#/types"]],
      talk: [["A", "think", "從全島看起：時間、地震、海拔，每一張圖都是三千多處文資一起算出來的。"], ["R", "explain", "最後看性格類型總覽，哪一型的鄉鎮最多？"]] },
    { id: "expert", label: "想當文資達人", steps: [
      ["visit", "查核資訊：找還沒人去過的文資", "https://cultural-visit.123hi.org/#coverage"],
      ["knowledge", "行前做功課：歷史、看點、交通", "https://cultural.123hi.org/"],
      ["visit", "到現場記錄現況、拍照、寫心得", "https://cultural-visit.123hi.org/#apply"]],
      talk: [["R", "fight", "達人出動！先找覆蓋率最低的縣市。"], ["A", "talk", "要新增紀錄得先申請、通過審查；回報的現況會讓下一位旅人少走冤枉路。"]] }
  ];
  function buildRoutes() {
    var pick = $("#routePick"), box = $("#routeBox");
    pick.innerHTML = ROUTES.map(function (r, i) { return '<button type="button" class="chip" data-r="' + r.id + '" aria-pressed="' + (i ? "false" : "true") + '">' + esc(r.label) + "</button>"; }).join("");
    function draw(id) {
      var r = ROUTES.filter(function (x) { return x.id === id; })[0];
      box.innerHTML = '<ol class="rt-line">' + r.steps.map(function (s, i) {
        var site = SITES[s[0]];
        return '<li class="rt-stop in" style="--sc:' + site.color + ';animation-delay:' + i * 0.12 + 's"><span class="rt-dot" style="animation-delay:' + i * 0.15 + 's">' + (i + 1) + '</span><span class="rt-name">' + esc(site.name) + '</span><span class="rt-do">' + esc(s[1]) + '</span><a href="' + s[2] + '" target="_blank" rel="noopener">開啟 ↗</a></li>';
      }).join("") + '</ol><div class="rt-cast g-duo">' + r.talk.map(say).join("") + "</div>";
    }
    pick.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $$("button", pick).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      draw(b.dataset.r);
    });
    draw(ROUTES[0].id);
  }

  /* ---------- 啟動 ---------- */
  buildMap();
  runTrain();
  buildLinks();
  buildRoutes();
  heroTalk();
  var h0 = location.hash.slice(1);
  show(SITES[h0] ? h0 : "knowledge");
  if (SITES[h0]) setTimeout(function () { $("#map").scrollIntoView(); }, 0);
  $$('[data-tour="start"]').forEach(function (b) {
    b.addEventListener("click", function () {
      show("knowledge", { hash: true });
      setAuto(true);
      $("#map").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });
  $$(".ticket[data-stop]").forEach(function (t) {
    t.setAttribute("target", "_blank"); t.setAttribute("rel", "noopener");
  });
  var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(placeSigns, 150); });
  addEventListener("hashchange", function () { var k = location.hash.slice(1); if (SITES[k] && k !== cur) show(k); });
})();
