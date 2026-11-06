/* 城市導覽引擎（各縣市共用）：路由、首頁、文資地圖、景點詳情、關於
 * 各縣市差異都在 <city>/data/config.json → window.CY.config */
(function () {
  "use strict";
  var CY = window.CY, CFG = CY.config, V = window.Voice, C = window.Characters, esc = V.esc;
  /* 共用資源的根目錄：由載入本檔的路徑推得（第一網站縣市頁 "../"；第二網站縣市頁為第一網站的網址 "https://cultural.123hi.org/"），見 tools/city_template.html 的 {{root}} */
  var ROOT = (function () {
    var el = document.currentScript, src = el && el.getAttribute("src") || "";
    var i = src.indexOf("assets/js/city/app.js");
    return i >= 0 ? src.slice(0, i) : "../";
  })();
  var FALLBACK = ROOT + "assets/img-fallback.svg";
  /* 姊妹站「文資達人訪查」（allanloplus/Cultural_Heritage_Master）：每處文資的實地現況、心得、照片與推薦指數。
   * 景點詳情的「達人實地訪查」按鈕連到 VISIT_BASE + "#site/<縣市>/<景點 id>"；改用自訂網域時只要改這一行 */
  var VISIT_BASE = "https://cultural-visit.123hi.org/";
  var SITES = CY.sites, byId = {};
  SITES.forEach(function (s) { byId[s.id] = s; });

  var CAT = {
    "國定古蹟": { c: "var(--c-national)", hex: "#b23a3a", k: "國" },
    "市定古蹟": { c: "var(--c-city)", hex: "#e07a3f", k: "市" },
    "縣定古蹟": { c: "var(--c-city)", hex: "#e07a3f", k: "縣" },
    "歷史建築": { c: "var(--c-building)", hex: "#2f7d6d", k: "歷" },
    "紀念建築": { c: "#a0527e", hex: "#a0527e", k: "紀" },
    "聚落建築群": { c: "var(--c-cluster)", hex: "#6b5bb5", k: "聚" },
    "考古遺址": { c: "#8a6d3b", hex: "#8a6d3b", k: "遺" },
    "文化景觀": { c: "var(--c-landscape)", hex: "#3b7bbf", k: "景" },
    "無形文資": { c: "var(--c-ich)", hex: "#b8860b", k: "藝" }
  };
  var ERA = { unknown: "年代不詳", prehistoric: "史前時代", dutch: "荷蘭時期", zheng: "明鄭時期", qing: "清朝", japan: "日治時期", postwar: "戰後（1945–1980）", modern: "1981 年以後" };
  /* 時期名稱可依縣市覆寫（config.json 的 eraLabels，例如金門沒有日治、荷蘭時期），未設定的沿用預設 */
  Object.keys(CFG.eraLabels || {}).forEach(function (k) { if (ERA[k] != null) ERA[k] = CFG.eraLabels[k]; });
  var CENTER = CFG.center;

  /* ---------- utils ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function dist(a, b, c, d) { // 公尺
    var r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r;
    return Math.sqrt(x * x + y * y) * 6371000;
  }
  function yearLabel(s) { return s.yearUnknown ? "年代不詳" : s.year < 0 ? "史前" : String(s.year); }
  function km(m) { return m < 1000 ? Math.round(m) + " 公尺" : (m / 1000).toFixed(1) + " 公里"; }
  function img(url, w) { return url && /\/\d+px-/.test(url) ? url.replace(/\/\d+px-/, "/" + w + "px-") : url; }
  /* 照片：優先使用站內副本（chiayi-city/img），沒有才直接連結 Wikimedia Commons */
  function pic(im, small) { return small ? (im.small || img(im.thumb, 250)) : (im.local || img(im.thumb, 960)); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  var toastTimer;
  function toast(msg, who, mood) {
    var t = $("#toast");
    t.innerHTML = '<img src="' + C.face(who || "R", mood || (who === "A" ? "wink" : "thumb")) + '" alt="">' + '<span>' + esc(msg) + '</span>';
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ---------- 護照 ---------- */
  var STAMPS = [
    { k: "game-quiz", n: "問答王" }, { k: "game-timeline", n: "時光排序" }, { k: "game-guess", n: "猜猜我是誰" },
    { k: "game-memory", n: "翻翻樂" }, { k: "game-board", n: "擲骰冒險" }, { k: "time-all", n: "時光旅人" },
    { k: "listen-10", n: "導覽達人" }, { k: "visit-5", n: "實地踏查" }, { k: "plan", n: "行程達人" }
  ];
  /* 每個縣市各自的護照與紀錄（嘉義市沿用最早的鍵名，舊紀錄不會遺失） */
  var KEY = CFG.slug === "chiayi-city" ? "cy." : "cy." + CFG.slug + ".";
  function passport() { return store(KEY + "passport") || { stamps: {}, listened: {}, visited: {}, eras: {} }; }
  function stamp(k) {
    var p = passport();
    if (p.stamps[k]) return false;
    p.stamps[k] = new Date().toISOString().slice(0, 10);
    store(KEY + "passport", p);
    var s = STAMPS.filter(function (x) { return x.k === k; })[0];
    toast("蓋章成功：「" + (s ? s.n : k) + "」", "A", "wink");
    renderPassport();
    return true;
  }
  function track(kind, id) {
    var p = passport(); p[kind] = p[kind] || {}; p[kind][id] = 1; store(KEY + "passport", p);
    if (kind === "listened" && Object.keys(p.listened).length >= 10) stamp("listen-10");
    if (kind === "visited" && Object.keys(p.visited).length >= 5) stamp("visit-5");
    if (kind === "eras" && CY.eras.length && Object.keys(p.eras).length >= CY.eras.length) stamp("time-all");
  }
  function renderPassport() {
    var el = $("#passport"); if (!el) return;
    var p = passport();
    el.innerHTML = STAMPS.map(function (s) {
      var got = p.stamps[s.k];
      return '<div class="stamp' + (got ? " got" : "") + '" title="' + esc(got ? "取得日期 " + got : "尚未取得") + '">' + esc(s.n) + (got ? "<br>" + esc(got.slice(5)) : "") + '</div>';
    }).join("") + '<p class="muted" style="grid-column:1/-1;font-size:.85rem">已聽導覽 ' + Object.keys(p.listened || {}).length + ' 處・實地打卡 ' + Object.keys(p.visited || {}).length + ' 處・逛過時期 ' + Object.keys(p.eras || {}).length + '／' + CY.eras.length + '。紀錄只存在你的瀏覽器裡。</p>';
  }

  /* ---------- 測驗元件 ---------- */
  function renderQuiz(el, q, onDone) {
    el.innerHTML = '<div class="quiz"><h4>' + esc(q.q) + '</h4><div class="quiz-opts">' +
      q.options.map(function (o, i) { return '<button type="button" data-i="' + i + '">' + "ABCD"[i] + ". " + esc(o) + '</button>'; }).join("") +
      '</div><p class="quiz-exp" hidden></p></div>';
    var done = false;
    $$(".quiz-opts button", el).forEach(function (b) {
      b.onclick = function () {
        if (done) return; done = true;
        var i = +b.dataset.i, ok = i === q.answer;
        b.classList.add(ok ? "ok" : "no");
        $$(".quiz-opts button", el)[q.answer].classList.add("ok");
        var ex = $(".quiz-exp", el); ex.hidden = false; ex.textContent = (ok ? "答對了！" : "正確答案是 " + "ABCD"[q.answer] + "。") + q.explain;
        var R = CY.extra.reactions;
        V.say("reactions", R, ok ? (Math.random() < .5 ? 0 : 1) : (Math.random() < .5 ? 2 : 3), "audio/");
        if (onDone) onDone(ok);
      };
    });
  }

  /* ---------- 底圖 ---------- */
  /* config.noPhotoBase：國土測繪中心正射影像沒有涵蓋的縣市（例如馬祖），底圖選單不列正射影像 */
  function baseLayers() {
    var bl = {
      "通用電子地圖（國土測繪中心）": L.tileLayer("https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, className: "base-layer", attribution: '&copy; <a href="https://maps.nlsc.gov.tw/" target="_blank" rel="noopener">內政部國土測繪中心</a>' }),
      "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, className: "base-layer", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }),
      "正射影像（國土測繪中心）": L.tileLayer("https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, className: "base-layer", attribution: '&copy; 內政部國土測繪中心' })
    };
    if (CFG.noPhotoBase) delete bl["正射影像（國土測繪中心）"];
    return bl;
  }
  function pinIcon(cat, on, label) {
    var c = CAT[cat] || CAT["歷史建築"];
    return L.divIcon({ className: "pin-wrap", html: '<div class="pin' + (on ? " is-on" : "") + '" style="--c:' + c.hex + '"><b>' + esc(label || c.k) + '</b></div>', iconSize: [30, 30], iconAnchor: [4, 30], tooltipAnchor: [14, -18], popupAnchor: [12, -28] });
  }

  /* ---------- YouBike ---------- */
  var UB = (CY.ubike && CY.ubike.stations) || [];
  function nearestUbike(lat, lng, n) {
    return UB.map(function (s) { return { s: s, d: dist(lat, lng, s.lat, s.lng) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, n || 1);
  }
  var liveCache = null, liveAt = 0;
  function ubikeLive() {
    if (liveCache && Date.now() - liveAt < 60000) return Promise.resolve(liveCache);
    return fetch("https://apis.youbike.com.tw/json/station-yb2.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (all) {
      var m = {};
      all.forEach(function (x) { if (CFG.ubikeAreas.indexOf(x.area_code) >= 0) m[x.station_no] = { bikes: x.available_spaces, empty: x.empty_spaces, at: x.updated_at }; });
      liveCache = m; liveAt = Date.now(); return m;
    });
  }

  /* ---------- Router ---------- */
  var views = {}, currentView = null;
  function register(name, mod) { views[name] = mod; }
  function route() {
    var h = (location.hash || "#home").slice(1).split("/");
    var name = h[0] || "home";
    if (!document.getElementById("view-" + name)) name = "home";
    if (name !== currentView) {
      V.stopAll();
      $$(".view").forEach(function (v) { v.hidden = v.dataset.view !== name; });
      $$(".nav a").forEach(function (a) { if (a.dataset.view === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
      currentView = name;
      document.body.dataset.view = name;
    }
    window.scrollTo(0, 0);
    var m = views[name];
    if (m && m.show) m.show(h.slice(1));
  }
  window.addEventListener("hashchange", route);

  /* ---------- Home ---------- */
  var homeInit = false;
  register("home", { show: function () {
    if (homeInit) return; homeInit = true;
    new V.Player($("#introPlayer"), { track: "intro", lines: CY.extra.intro, title: CFG.introTitle, audioBase: "audio/" });
    var counts = {};
    SITES.forEach(function (s) { counts[s.category] = (counts[s.category] || 0) + 1; });
    var ichN = (CY.ich.items || []).length, antiN = (CY.ich.venues || []).reduce(function (n, v) { return n + (v.antiquities || []).length; }, 0);
    var tiles = CY.categories.map(function (c) { return '<a class="stat" href="#map" style="--c:' + CAT[c].hex + '"><b>' + (counts[c] || 0) + '</b><span>' + c + '</span></a>'; });
    if (ichN) tiles.push('<a class="stat" href="#map" style="--c:' + CAT["無形文資"].hex + '"><b>' + ichN + '</b><span>無形文化資產</span></a>');
    if (antiN) tiles.push('<a class="stat" href="#map" style="--c:#8a6d3b"><b>' + antiN + '</b><span>古物（件組）</span></a>');
    if (UB.length) tiles.push('<a class="stat" href="#plan" style="--c:#f5b800"><b>' + UB.length + '</b><span>YouBike 2.0 站點</span></a>');
    $("#stats").innerHTML = tiles.join("");
    var pool = SITES.filter(function (s) { return s.images.length; });
    var s = pool[Math.floor(Math.random() * pool.length)];
    var im = s.images[0];
    $("#todayPick").innerHTML = '<img src="' + esc(pic(im)) + '" alt="' + esc(s.name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'">' +
      '<div><p class="eyebrow">' + esc(s.category) + '・' + esc(s.yearText) + '</p><h3>' + esc(s.name) + '</h3><p class="d-sum">' + esc(s.summary) + '</p><p style="margin:8px 0 12px">' + esc(s.intro.slice(0, 120)) + '…</p>' +
      '<a class="btn btn-teal" href="#map/' + s.id + '">去地圖看看・聽導覽</a>' +
      '<p class="muted" style="font-size:.75rem;margin-top:8px">照片：' + esc(im.artist) + '，' + esc(im.license) + '，<a href="' + esc(im.page) + '" target="_blank" rel="noopener">Wikimedia Commons</a></p></div>';
  } });

  /* ---------- 文資地圖 ---------- */
  var map, markers = {}, venueLayer, filt = { cats: {}, q: "", era: "", theme: "", town: "" }, openId = null, drawerPlayer = null;
  CY.categories.forEach(function (c) { filt.cats[c] = true; });
  filt.cats["無形文資"] = true;

  function initMap() {
    map = L.map("smap", { zoomControl: true, minZoom: CFG.minZoom, maxZoom: 20 }).setView(CENTER, CFG.zoom);
    var bl = baseLayers();
    bl["通用電子地圖（國土測繪中心）"].addTo(map);
    L.control.layers(bl, null, { position: "topright" }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    SITES.forEach(function (s) {
      var m = L.marker([s.lat, s.lng], { icon: pinIcon(s.category), title: s.name, riseOnHover: true, keyboard: true })
        .bindTooltip(s.short, { className: "tip", direction: "top" })
        .on("click", function () { location.hash = "#map/" + s.id; });
      m.addTo(map); markers[s.id] = m;
    });
    /* config.fitSites：景點分散在多座島（例如馬祖四鄉五島），初始畫面縮放到看得到全部景點 */
    if (CFG.fitSites && SITES.length) map.fitBounds(L.latLngBounds(SITES.map(function (s) { return [s.lat, s.lng]; })), { padding: [24, 24] });
    // 無形文化資產與古物展示地點
    venueLayer = L.layerGroup().addTo(map);
    (CY.ich.venues || []).forEach(function (v) {
      if (v.lat == null || v.lng == null) return;
      var m = L.marker([v.lat, v.lng], { icon: pinIcon("無形文資"), title: v.name, zIndexOffset: -100 })
        .bindTooltip(v.name, { className: "tip", direction: "top" })
        .on("click", function () { location.hash = "#map/" + v.id; });
      m.addTo(venueLayer);
    });
    var lc = L.control({ position: "bottomleft" });
    lc.onAdd = function () {
      var d = L.DomUtil.create("div", "card map-legend"); d.style.padding = "6px 10px"; d.style.fontSize = "12px"; d.style.lineHeight = "1.7";
      d.innerHTML = CY.categories.concat(["無形文資"]).map(function (k) { return '<div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + CAT[k].hex + ';margin-right:6px"></span>' + (k === "無形文資" ? "無形文資・古物" : k) + '</div>'; }).join("");
      return d;
    };
    lc.addTo(map);
  }

  function initSide() {
    var cats = CY.categories.concat(["無形文資"]);
    $("#catChips").innerHTML = cats.map(function (c) {
      return '<button type="button" class="chip" aria-pressed="true" data-c="' + c + '"><span class="dot" style="background:' + CAT[c].hex + '"></span>' + (c === "無形文資" ? "無形文資・古物" : c) + '</button>';
    }).join("");
    $$("#catChips .chip").forEach(function (b) {
      b.onclick = function () { var c = b.dataset.c; filt.cats[c] = !filt.cats[c]; b.setAttribute("aria-pressed", String(filt.cats[c])); applyFilter(); };
    });
    var eras = {}; SITES.forEach(function (s) { eras[s.era] = 1; });
    $("#eraSel").innerHTML += Object.keys(ERA).filter(function (k) { return eras[k]; }).map(function (k) { return '<option value="' + k + '">' + ERA[k] + '</option>'; }).join("");
    var th = {}; SITES.forEach(function (s) { s.themes.forEach(function (t) { th[t] = (th[t] || 0) + 1; }); });
    $("#themeSel").innerHTML += Object.keys(th).sort(function (a, b) { return th[b] - th[a]; }).map(function (t) { return '<option>' + esc(t) + '</option>'; }).join("");
    var towns = {}; SITES.forEach(function (s) { if (s.town) towns[s.town] = (towns[s.town] || 0) + 1; });
    if (Object.keys(towns).length > 1) {
      $("#townWrap").hidden = false;
      $("#townSel").innerHTML += (CFG.towns || Object.keys(towns)).filter(function (t) { return towns[t]; }).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '（' + towns[t] + '）</option>'; }).join("");
      $("#townSel").onchange = function () { filt.town = this.value; applyFilter(); var pts = SITES.filter(match).map(function (x) { return [x.lat, x.lng]; }); if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 }); };
    }
    $("#eraSel").onchange = function () { filt.era = this.value; applyFilter(); };
    $("#themeSel").onchange = function () { filt.theme = this.value; applyFilter(); };
    $("#q").oninput = function () { filt.q = this.value.trim(); applyFilter(); };
    $("#sideToggle").onclick = function () { var s = $("#mapSide"), min = s.classList.toggle("is-min"); $("#view-map").classList.toggle("sheet-min", min); if (min) $("#mapSide .side-scroll").scrollTop = 0; this.setAttribute("aria-expanded", String(!min)); setTimeout(function () { map.invalidateSize(); }, 300); };
    applyFilter();
  }

  function match(s) {
    if (!filt.cats[s.category]) return false;
    if (filt.era && s.era !== filt.era) return false;
    if (filt.town && s.town !== filt.town) return false;
    if (filt.theme && s.themes.indexOf(filt.theme) < 0) return false;
    if (filt.q) { var t = (s.name + s.short + s.address + s.summary + s.intro + s.themes.join("")).toLowerCase(); if (t.indexOf(filt.q.toLowerCase()) < 0) return false; }
    return true;
  }
  function applyFilter() {
    var list = SITES.filter(match);
    SITES.forEach(function (s) { var m = markers[s.id]; if (!m) return; if (match(s)) { if (!map.hasLayer(m)) m.addTo(map); } else if (map.hasLayer(m)) map.removeLayer(m); });
    if (venueLayer) { if (filt.cats["無形文資"] && !filt.era && !filt.theme && !filt.town) { if (!map.hasLayer(venueLayer)) venueLayer.addTo(map); } else if (map.hasLayer(venueLayer)) map.removeLayer(venueLayer); }
    var venues = (filt.cats["無形文資"] && !filt.era && !filt.theme && !filt.town) ? (CY.ich.venues || []).filter(function (v) { return !filt.q || (v.name + JSON.stringify(v.antiquities || [])).indexOf(filt.q) >= 0; }) : [];
    $("#count").textContent = "顯示 " + list.length + " 處文化資產" + (venues.length ? "、" + venues.length + " 處無形文資／古物展示點" : "");
    $("#siteList").innerHTML = list.map(function (s) {
      var c = CAT[s.category], th = s.images[0] ? '<img class="thumb" src="' + esc(pic(s.images[0], true)) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'">' : '<span class="thumb" style="background:' + c.hex + '">' + c.k + '</span>';
      return '<li class="site-item' + (s.id === openId ? " is-on" : "") + '" data-id="' + s.id + '" tabindex="0">' + th + '<div><h3>' + esc(s.name) + '</h3><p>' + esc(s.summary) + '</p><div class="meta"><span class="tag" style="color:' + c.hex + '">' + s.category + '</span><span class="tag">' + esc(yearLabel(s)) + '</span>' + (s.town ? '<span class="tag">' + esc(s.town) + '</span>' : "") + '</div></div></li>';
    }).join("") + venues.map(function (v) {
      return '<li class="site-item' + (v.id === openId ? " is-on" : "") + '" data-id="' + v.id + '" tabindex="0"><span class="thumb" style="background:' + CAT["無形文資"].hex + '">藝</span><div><h3>' + esc(v.name) + '</h3><p>' + esc(venueSummary(v)) + '</p></div></li>';
    }).join("");
    $$("#siteList .site-item").forEach(function (li) {
      li.onclick = function () { location.hash = "#map/" + li.dataset.id; };
      li.onkeydown = function (e) { if (e.key === "Enter") li.onclick(); };
    });
  }
  function venueSummary(v) {
    var a = (v.antiquities || []).length, n = (v.ichIds || []).length;
    return [a ? "古物 " + a + " 件組" : "", n ? "無形文資 " + n + " 項" : ""].filter(Boolean).join("・") || "展示地點";
  }

  function gallery(s) {
    if (!s.images.length) {
      return '<div class="noimg"><div><p>這處文化資產目前沒有可自由授權的照片，<br>請點連結到官方網站或搜尋觀看。</p><div class="chips">' +
        '<a class="chip" href="' + esc(s.url) + '" target="_blank" rel="noopener">文資局官方頁面</a>' +
        (s.officialImg ? '<a class="chip" href="' + esc(s.officialImg) + '" target="_blank" rel="noopener">官方代表圖（連結）</a>' : "") +
        '<a class="chip" href="https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(s.name + " " + CFG.short) + '" target="_blank" rel="noopener">Google 圖片</a></div></div></div>';
    }
    var ims = s.images;
    return '<figure class="gallery" data-i="0"><img src="' + esc(pic(ims[0])) + '" alt="' + esc(s.name) + '" width="960" height="720" onerror="this.onerror=null;this.src=\'' + FALLBACK + '\'">' +
      (ims.length > 1 ? '<button class="gal-nav gal-prev" type="button" aria-label="上一張">‹</button><button class="gal-nav gal-next" type="button" aria-label="下一張">›</button><span class="gal-count">1 / ' + ims.length + '</span>' : "") +
      '<figcaption></figcaption></figure>';
  }
  function setGal(el, s, i) {
    var im = s.images[i];
    var gi = $("img", el); gi.onerror = function () { gi.onerror = null; gi.src = FALLBACK; }; gi.src = pic(im);
    $("figcaption", el).innerHTML = '照片：' + esc(im.artist || "佚名") + '・' + (im.licenseUrl ? '<a href="' + esc(im.licenseUrl) + '" target="_blank" rel="noopener">' + esc(im.license) + '</a>' : esc(im.license)) + '・<a href="' + esc(im.page) + '" target="_blank" rel="noopener">Wikimedia Commons</a>' +
      (s.officialImg ? '・<a href="' + esc(s.officialImg) + '" target="_blank" rel="noopener">文資局代表圖</a>' : "");
    var c = $(".gal-count", el); if (c) c.textContent = (i + 1) + " / " + s.images.length;
    el.dataset.i = i;
  }

  function openSite(id) {
    var s = byId[id];
    var v = !s && (CY.ich.venues || []).filter(function (x) { return x.id === id; })[0];
    if (!s && !v) return closeDrawer();
    if (drawerPlayer) { drawerPlayer.destroy(); drawerPlayer = null; }
    var prev = openId; openId = id;
    if (prev && markers[prev]) markers[prev].setIcon(pinIcon(byId[prev].category));
    $$("#siteList .site-item").forEach(function (li) { li.classList.toggle("is-on", li.dataset.id === id); });
    var d = $("#drawer");
    d.hidden = false;
    d.scrollTop = 0;
    if (v) return openVenue(v, d);
    markers[id].setIcon(pinIcon(s.category, true));
    var c = CAT[s.category];
    var ub = nearestUbike(s.lat, s.lng, 2);
    var near = SITES.filter(function (x) { return x.id !== s.id; }).map(function (x) { return { x: x, d: dist(s.lat, s.lng, x.lat, x.lng) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 4);
    d.innerHTML = '<button class="drawer-close" type="button" aria-label="關閉">×</button>' + gallery(s) +
      '<div class="d-body">' +
      '<div class="d-title"><h2>' + esc(s.name) + '</h2><p class="sub">' + esc(s.yearText) + '</p>' +
      '<div class="d-badges"><span class="tag badge-cat" style="--c:' + c.hex + '">' + s.category + (s.level && s.level.indexOf("重要") === 0 ? "・" + esc(s.level) : "") + '</span>' + (s.town ? '<span class="tag">' + esc(s.town) + '</span>' : "") + '<span class="tag">' + esc(ERA[s.era] || "") + '</span>' + s.themes.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div></div>' +
      '<p class="d-sum">' + esc(s.summary) + '</p>' +
      '<div id="dPlayer"></div>' +
      '<div class="d-sec"><h3>認識這裡</h3><p>' + esc(s.intro) + '</p></div>' +
      '<div class="d-sec"><h3>到現場必看</h3><ul>' + s.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join("") + '</ul></div>' +
      '<p class="funfact"><b>冷知識｜</b>' + esc(s.funFact) + '</p>' +
      '<p class="funfact" style="border-color:var(--teal);background:color-mix(in srgb,var(--teal) 10%,var(--card))"><b>拍照點｜</b>' + esc(s.photoSpot) + '</p>' +
      '<div class="d-sec"><h3>參觀資訊</h3><table class="info-table"><tbody>' +
      '<tr><th>地址</th><td>' + esc(s.address) + (s.privateHome ? '<br><small class="muted">私人宅第，門牌不公開，導航請用地圖位置；請在外觀參觀，勿擅入或打擾住戶。</small>' : "") + '</td></tr>' +
      '<tr><th>開放</th><td>' + esc(s.openNote) + '</td></tr>' +
      '<tr><th>建議停留</th><td>約 ' + s.visitMin + ' 分鐘</td></tr>' +
      '<tr><th>類別</th><td>' + esc(s.category) + (s.types.length ? "（" + esc(s.types.join("、")) + "）" : "") + '</td></tr>' +
      (s.announced ? '<tr><th>公告</th><td>' + esc(s.announced) + '</td></tr>' : "") +
      '</tbody></table><p class="hint" style="margin-top:6px">開放時間可能調整，出發前請以官方公告為準。</p></div>' +
      '<div class="d-actions">' +
      '<a class="btn btn-sm btn-teal" href="https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lng + '" target="_blank" rel="noopener">導航前往</a>' +
      '<button class="btn btn-sm" type="button" id="dAdd">加入自選行程</button>' +
      '<button class="btn btn-sm" type="button" id="dVisit">我到過這裡</button>' +
      '<a class="btn btn-sm btn-teal" href="' + VISIT_BASE + '#site/' + encodeURIComponent(CFG.slug) + '/' + encodeURIComponent(s.id) + '" target="_blank" rel="noopener">達人實地訪查・現況與推薦</a>' +
      '<a class="btn btn-sm" href="' + esc(s.url) + '" target="_blank" rel="noopener">文資局官方資料</a>' +
      (s.extraLinks || []).map(function (x) { return '<a class="btn btn-sm" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>'; }).join("") +
      '</div>' +
      (ub.length && ub[0].d < 3000 ? '<div class="d-sec near-ub"><h3>附近的 YouBike 2.0</h3><ul>' + ub.map(function (u) { return '<li data-no="' + u.s.no + '"><b>' + esc(u.s.name) + '</b>（' + km(u.d) + '）<span class="live"></span></li>'; }).join("") + '</ul>' +
      '<button class="btn btn-sm" type="button" id="dLive">查詢即時車輛</button></div>' : "") +
      '<div class="d-sec"><h3>小測驗</h3><div id="dQuiz0"></div><div id="dQuiz1" style="margin-top:8px"></div></div>' +
      '<div class="d-sec"><h3>附近還有</h3><div class="chips">' + near.map(function (n) { return '<a class="chip" href="#map/' + n.x.id + '">' + esc(n.x.short) + '・' + km(n.d) + '</a>'; }).join("") + '</div></div>' +
      '</div>';
    $(".drawer-close", d).onclick = function () { location.hash = "#map"; };
    var g = $(".gallery", d);
    if (g) {
      setGal(g, s, 0);
      var pv = $(".gal-prev", g), nx = $(".gal-next", g);
      if (pv) pv.onclick = function () { setGal(g, s, (+g.dataset.i - 1 + s.images.length) % s.images.length); };
      if (nx) nx.onclick = function () { setGal(g, s, (+g.dataset.i + 1) % s.images.length); };
    }
    drawerPlayer = new V.Player($("#dPlayer", d), { track: "site-" + s.id, lines: s.dialogue, title: s.short, audioBase: "audio/", onEnd: function () { track("listened", s.id); } });
    s.quiz.forEach(function (q, i) { renderQuiz($("#dQuiz" + i, d), q); });
    $("#dAdd", d).onclick = function () { if (window.Planner) { window.Planner.addPick(s.id); toast("已加入自選行程：" + s.short + "（到行程規劃查看）", "R", "thumb"); } };
    $("#dVisit", d).onclick = function () { checkIn(s); };
    if ($("#dLive", d)) $("#dLive", d).onclick = function () {
      var b = this; b.disabled = true; b.textContent = "查詢中…";
      ubikeLive().then(function (m) {
        $$(".near-ub li", d).forEach(function (li) { var x = m[li.dataset.no]; $(".live", li).textContent = x ? "：可借 " + x.bikes + " 輛・可還 " + x.empty + " 位" : "：查無即時資料"; });
        b.textContent = "已更新（YouBike 官方即時資料）";
      }).catch(function () { b.disabled = false; b.textContent = "查詢失敗，請稍後再試"; });
    };
    map.setView([s.lat, s.lng], Math.max(map.getZoom(), CFG.detailZoom || 16), { animate: true });
    if (window.innerWidth > 900) map.panBy([200, 0], { animate: false });
  }

  function checkIn(s) {
    var done = function (msg) { track("visited", s.id); toast(msg, "R", "thumb"); };
    if (!navigator.geolocation) return done("已記錄造訪：" + s.short);
    navigator.geolocation.getCurrentPosition(function (p) {
      var m = dist(p.coords.latitude, p.coords.longitude, s.lat, s.lng);
      done(m < 300 ? "實地打卡成功！你就在" + s.short + "附近" : "已記錄造訪：" + s.short + "（距離約 " + km(m) + "）");
    }, function () { done("已記錄造訪：" + s.short); }, { timeout: 8000, maximumAge: 60000 });
  }

  function openVenue(v, d) {
    var items = (CY.ich.items || []).filter(function (i) { return (v.ichIds || []).indexOf(i.id) >= 0; });
    var rel = v.relatedSiteId && byId[v.relatedSiteId];
    d.innerHTML = '<button class="drawer-close" type="button" aria-label="關閉">×</button>' +
      '<div class="d-body" style="padding-top:20px"><div class="d-title"><h2>' + esc(v.name) + '</h2><p class="sub">' + esc(v.address || "") + '</p>' +
      '<div class="d-badges"><span class="tag badge-cat" style="--c:' + CAT["無形文資"].hex + '">無形文資・古物展示點</span></div></div>' +
      (rel ? '<p><a class="btn btn-sm btn-teal" href="#map/' + rel.id + '">這裡也是「' + esc(rel.name) + '」，看建築介紹</a></p>' : "") +
      items.map(function (it, k) {
        return '<div class="d-sec card" style="padding:12px"><h3>' + esc(it.name) + ' <span class="tag">' + esc(it.type) + '</span></h3><p class="hint">' + esc(it.holder || "") + (it.registered ? "・登錄 " + esc(it.registered) : "") + '</p>' +
          '<p style="margin:6px 0">' + esc(it.intro) + '</p>' + (it.whereToSee ? '<p class="funfact"><b>哪裡看｜</b>' + esc(it.whereToSee) + '</p>' : "") +
          (it.dialogue && it.dialogue.length ? '<div class="ich-player" data-k="' + k + '" style="margin-top:8px"></div>' : "") +
          (it.url ? '<p style="margin-top:6px"><a href="' + esc(it.url) + '" target="_blank" rel="noopener">文資局官方資料</a></p>' : "") + '</div>';
      }).join("") +
      ((v.antiquities || []).length ? '<div class="d-sec"><h3>收藏的古物</h3><ul>' + v.antiquities.map(function (a) { return '<li><b>' + esc(a.name) + '</b>' + (a.level ? '（' + esc(a.level) + '）' : "") + (a.note ? '：' + esc(a.note) : "") + '</li>'; }).join("") + '</ul></div>' : "") +
      '<div class="d-actions">' + (v.lat != null ? '<a class="btn btn-sm btn-teal" href="https://www.google.com/maps/dir/?api=1&destination=' + v.lat + ',' + v.lng + '" target="_blank" rel="noopener">導航前往</a>' : '<span class="hint">此地點座標未能核對，請依地址前往。</span>') + '</div></div>';
    $(".drawer-close", d).onclick = function () { location.hash = "#map"; };
    $$(".ich-player", d).forEach(function (el) {
      var it = items[+el.dataset.k];
      new V.Player(el, { track: it.id, lines: it.dialogue, title: it.name, audioBase: "audio/", compact: true });
    });
    if (v.lat != null && v.lng != null) map.setView([v.lat, v.lng], Math.max(map.getZoom(), 16));
  }

  function closeDrawer() {
    if (drawerPlayer) { drawerPlayer.destroy(); drawerPlayer = null; }
    V.stopAll();
    $("#drawer").hidden = true;
    if (openId && markers[openId]) markers[openId].setIcon(pinIcon(byId[openId].category));
    openId = null;
    $$("#siteList .site-item").forEach(function (li) { li.classList.remove("is-on"); });
  }

  register("map", { show: function (args) {
    var first = !map;
    if (!map) { initMap(); initSide(); }
    setTimeout(function () {
      map.invalidateSize();
      /* config.fitSites：初始畫面改成涵蓋全部景點（例如臺東要同時看到綠島、蘭嶼）；要等地圖顯示、尺寸確定後再算 */
      if (first && CFG.fitSites && SITES.length && !openId) {
        /* 手機版清單面板會蓋住地圖下半部，把被蓋住的高度當成留白 */
        var mr = $("#smap").getBoundingClientRect(), sr = $("#mapSide").getBoundingClientRect();
        var cover = sr.top > mr.top && sr.left < mr.right - 10 ? Math.max(0, mr.bottom - sr.top) : 0;
        map.fitBounds(L.latLngBounds(SITES.map(function (s) { return [s.lat, s.lng]; })), { maxZoom: CFG.zoom, paddingTopLeft: [20, 20], paddingBottomRight: [20, 20 + cover] });
      }
    }, 50);
    if (args[0]) openSite(decodeURIComponent(args[0])); else closeDrawer();
  } });

  /* ---------- 關於 ---------- */
  var aboutInit = false;
  register("about", { show: function () {
    if (aboutInit) return; aboutInit = true;
    var imgs = [];
    SITES.forEach(function (s) { s.images.forEach(function (im) { imgs.push([s.short, im]); }); });
    $("#aboutBody").innerHTML =
      '<h2 class="sec-title">關於「Allan Lo 和你逛文化」</h2>' +
      '<div class="credit"><img src="' + ROOT + 'assets/characters/allan-stand.webp" alt="Allan Lo" width="90" height="110"><div><p><b>規劃設計：Allan Lo，<a href="https://www.123hi.org" target="_blank" rel="noopener">https://www.123hi.org</a>，2026年11月</b></p><p><b>使用 AI 工具：Claude Opus 5.5</b></p><p class="muted">導覽角色：Allan Lo（文化導覽員，台灣男聲 zh-TW-YunJheNeural）與 AI 小助手阿拉蕾（台灣小女生 zh-TW-HsiaoYuNeural）。語音由 Microsoft Edge 神經網路語音預先合成。</p></div><img src="' + ROOT + 'assets/characters/arale-stand.webp" alt="阿拉蕾" width="90" height="110"></div>' +
      '<h2>資料來源</h2><ul>' +
      '<li>文化資產名稱、類別、座標、地址與官方說明：<a href="https://data.boch.gov.tw/" target="_blank" rel="noopener">文化部文化資產局 文化資產開放資料</a>、<a href="https://nchdb.boch.gov.tw/" target="_blank" rel="noopener">國家文化資產網</a>（政府資料開放授權條款）。各景點皆附官方頁面連結。</li>' +
      '<li>清單比對：<a href="' + esc(CFG.wiki.url) + '" target="_blank" rel="noopener">' + esc(CFG.wiki.title) + '</a>。</li>' +
      (Object.keys(CFG.eras || {}).some(function (k) { return (CFG.eras[k].layers || []).some(function (l) { return l !== "photo"; }); }) ?  // 沒有用到中研院圖層的縣市（例如金門）不列
      '<li>時光地圖老地圖圖磚：<a href="https://gis.sinica.edu.tw/tileserver/" target="_blank" rel="noopener">中央研究院人社中心 臺灣百年歷史地圖</a>（1904 臺灣堡圖、1921 地形圖、1945 美軍城市圖、1950／1957–1969 地形圖、1966 Corona 衛星影像）。</li>' : "") +
      '<li>底圖：<a href="https://maps.nlsc.gov.tw/" target="_blank" rel="noopener">內政部國土測繪中心</a> 通用電子地圖' + (CFG.noPhotoBase ? "" : "與正射影像") + '、<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>。</li>' +
      '<li>路線規劃：<a href="https://routing.openstreetmap.de/" target="_blank" rel="noopener">FOSSGIS OSRM 路線服務</a>（OpenStreetMap 資料）；連線失敗時改以直線距離估算。</li>' +
      (CFG.ubikeUrl ? '<li>YouBike 2.0 ' + esc(CFG.name) + '站點：<a href="' + esc(CFG.ubikeUrl) + '" target="_blank" rel="noopener">YouBike 微笑單車</a> 官方站點資料（站點快照 ' + esc((CY.ubike && CY.ubike.meta.snapshot) || "") + '；即時車輛於網頁上查詢）。</li>' : "") +
      (CY.eras.length ? '<li>時光地圖各時期內容參考：' + uniqueSources().map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>'; }).join("、") + '。</li>' : "") +
      '</ul>' +
      '<h2>圖片授權</h2><p>景點照片皆來自 Wikimedia Commons 的自由授權圖片，於網頁中直接連結原始檔並標示作者與授權；沒有自由授權照片的景點，改以連結方式提供官方代表圖或搜尋。</p>' +
      '<details class="lic"><summary>全部 ' + imgs.length + ' 張圖片的作者與授權</summary><table class="lic-table"><thead><tr><th>景點</th><th>檔案</th><th>作者</th><th>授權</th></tr></thead><tbody>' +
      imgs.map(function (r) { var im = r[1]; return '<tr><td>' + esc(r[0]) + '</td><td><a href="' + esc(im.page) + '" target="_blank" rel="noopener">' + esc(im.file) + '</a></td><td>' + esc(im.artist) + '</td><td>' + esc(im.license) + '</td></tr>'; }).join("") +
      '</tbody></table></details>' +
      '<h2>使用提醒</h2><ul><li>開放時間、票價、導覽場次常有調整，出發前請以各管理單位公告為準。</li><li>私人宅第、宿舍與仍在使用的宗教場所，請在公共空間欣賞外觀，勿擅自進入或打擾住戶。</li><li>護照印章、造訪紀錄只存在你自己的瀏覽器（localStorage），不會上傳；打卡功能只在你按下時讀取一次位置，用來判斷是否在景點附近，不會儲存或傳送座標。</li></ul>';
  } });
  function uniqueSources() {
    var seen = {}, out = [];
    CY.eras.forEach(function (e) { (e.sources || []).forEach(function (s) { if (s.url && !seen[s.url]) { seen[s.url] = 1; out.push(s); } }); });
    return out.slice(0, 30);
  }

  /* ---------- export ---------- */
  window.App = { ROOT: ROOT, FALLBACK: FALLBACK, CY: CY, CFG: CFG, sites: SITES, byId: byId, CAT: CAT, ERA: ERA, CENTER: CENTER, $: $, $$: $$, dist: dist, yearLabel: yearLabel, km: km, img: img, shuffle: shuffle, store: store,
    pic: pic, KEY: KEY, passport: passport, toast: toast, stamp: stamp, track: track, renderPassport: renderPassport, renderQuiz: renderQuiz, baseLayers: baseLayers, pinIcon: pinIcon,
    nearestUbike: nearestUbike, ubikeLive: ubikeLive, register: register, route: route };

  document.addEventListener("DOMContentLoaded", function () { setTimeout(route, 0); });
})();
