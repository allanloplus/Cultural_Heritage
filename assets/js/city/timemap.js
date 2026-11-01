/* 時光地圖：荷蘭 → 明鄭 → 清朝 → 日治 → 民國初年 → 民國60年 → 現在
 * 老地圖圖磚：中央研究院人社中心「臺灣百年歷史地圖」WMTS */
(function () {
  "use strict";
  var A = window.App, CY = A.CY, V = window.Voice, esc = V.esc, $ = A.$, $$ = A.$$;
  var ERAS = CY.eras || [];

  function sinica(id, ext, maxNative, opts) {
    return Object.assign({ url: "https://gis.sinica.edu.tw/tileserver/file-exists.php?img=" + id + "-" + ext + "-{z}-{x}-{y}", maxNative: maxNative, attr: '老地圖：<a href="https://gis.sinica.edu.tw/tileserver/" target="_blank" rel="noopener">中研院臺灣百年歷史地圖</a>' }, opts || {});
  }
  var L1904 = sinica("JM20K_1904", "jpg", 18, { name: "1904 臺灣堡圖（明治版）" });
  var L1921 = sinica("JM25K_1921", "png", 18, { name: "1921 日治二萬五千分之一地形圖" });
  var L1916 = sinica("JM50K_1916", "jpg", 16, { name: "1916 日治蕃地地形圖（山區）" });
  var L1944 = sinica("JM25K_1944", "png", 16, { name: "1944 日治地形圖（航照修正版）" });
  var L1945 = sinica("AMCityPlan_1945", "png", 18, { name: "1945 美軍繪製城市地圖（KAGI）" });
  var L1950 = sinica("TM25K_1950", "png", 17, { name: "1950 臺灣地形圖" });
  var L1966 = sinica("TM25K_1966", "png", 15, { name: "1957–1969 臺灣二萬五千分一地形圖" });
  var LCOR = sinica("Taiwan_Corona_1966", "png", 16, { name: "1966 Corona 衛星影像" });
  var L1989 = sinica("TM25K_1989", "jpg", 16, { name: "1989 經建一版地形圖（對照用）" });
  var LPHOTO = { name: "現今正射影像（國土測繪中心）", url: "https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}", maxNative: 19, attr: "&copy; 內政部國土測繪中心" };

  var LAYERS = { "1904": L1904, "1916": L1916, "1921": L1921, "1944": L1944, "1945": L1945, "1950": L1950, "1966": L1966, corona: LCOR, "1989": L1989, photo: LPHOTO };
  /* 各時期要疊的老地圖、時間範圍與說明在 config.json → eras */
  var CONF = {};
  Object.keys(A.CFG.eras || {}).forEach(function (k) {
    var e = A.CFG.eras[k];
    CONF[k] = Object.assign({}, e, { layers: (e.layers || []).map(function (id) { return LAYERS[id]; }).filter(Boolean) });
  });


  var tmap, overlay = null, eraIdx = -1, swipeOn = false, swipeX = 0.5, lmLayer, siteLayer, wallLayer, ghostWall, panelPlayer = null, introDone = false;

  function initMap() {
    tmap = L.map("tmap", { minZoom: A.CFG.minZoom, maxZoom: 19 }).setView(A.CENTER, A.CFG.timeZoom || 15);
    var bl = A.baseLayers();
    bl["通用電子地圖（國土測繪中心）"].addTo(tmap);
    L.control.layers(bl, null, { position: "topright" }).addTo(tmap);
    L.control.scale({ imperial: false }).addTo(tmap);
    tmap.createPane("old"); tmap.getPane("old").style.zIndex = 250;
    siteLayer = L.layerGroup().addTo(tmap);
    lmLayer = L.layerGroup().addTo(tmap);
    wallLayer = L.layerGroup().addTo(tmap);
    tmap.on("move zoom resize zoomend moveend", clip);
    initSwipe();
  }

  function wallLatLngs() {
    var q = CY.qingCity;
    if (!q) return null;
    var pts = q.outline || q.wall || q.points || q.polygon;
    return pts && pts.length > 2 ? pts : null;
  }
  function gates() { var q = CY.qingCity; return (q && (q.gates || [])) || []; }

  function drawWall(strong) {
    wallLayer.clearLayers();
    var pts = wallLatLngs();
    if (!pts) return;
    L.polygon(pts, strong ? { color: "#b23a3a", weight: 4, dashArray: "8 6", fillColor: "#b23a3a", fillOpacity: .06 } : { color: "#b23a3a", weight: 2, dashArray: "4 8", fill: false, opacity: .7 })
      .bindTooltip((CY.qingCity.name || "清代城牆") + "（推定範圍）", { sticky: true, className: "tip" }).addTo(wallLayer);
    if (strong) gates().forEach(function (g) {
      if (g.lat == null) return;
      L.marker([g.lat, g.lng], { icon: L.divIcon({ className: "", html: '<div class="pin" style="--c:#7a2b2b"><b>門</b></div>', iconSize: [30, 30], iconAnchor: [4, 30] }) })
        .bindPopup("<b>" + esc(g.name) + (g.gateName ? "（" + esc(g.gateName) + "）" : "") + "</b>" + (g.laterGateName ? "<br>後改稱：" + esc(g.laterGateName) : "") + "<br>" + esc(g.modernSpot || g.note || "")).addTo(wallLayer);
    });
    if (strong) ((CY.qingCity && CY.qingCity.batteries) || []).forEach(function (b) {
      if (b.lat == null) return;
      L.circleMarker([b.lat, b.lng], { radius: 7, color: "#7a2b2b", weight: 2, fillColor: "#f2b632", fillOpacity: .9 })
        .bindTooltip("砲臺：" + b.spot, { className: "tip" }).addTo(wallLayer);
    });
  }

  function setOverlay(def, opacity) {
    if (overlay) { tmap.removeLayer(overlay); overlay = null; }
    if (!def) { clip(); return; }
    overlay = L.tileLayer(def.url, { pane: "old", maxZoom: 19, maxNativeZoom: def.maxNative, opacity: opacity, attribution: def.attr, crossOrigin: false });
    overlay.addTo(tmap);
    overlay.on("load tileload", clip);
    $("#tmLabel").textContent = def.name;
    clip();
  }

  function clip() {
    if (!overlay) return;
    var c = overlay.getContainer(); if (!c) return;
    if (!swipeOn) { c.style.clip = ""; return; }
    var size = tmap.getSize();
    var nw = tmap.containerPointToLayerPoint([0, 0]), se = tmap.containerPointToLayerPoint(size);
    var x = tmap.containerPointToLayerPoint([size.x * swipeX, 0]).x;
    c.style.clip = "rect(" + nw.y + "px," + x + "px," + se.y + "px," + nw.x + "px)";
  }

  function initSwipe() {
    var sw = $("#swipe"), knob = $(".swipe-knob", sw), wrap = $("#view-time .mapwrap"), drag = false;
    function set(px) { var r = wrap.getBoundingClientRect(); swipeX = Math.min(.98, Math.max(.02, (px - r.left) / r.width)); sw.style.setProperty("--x", (swipeX * 100) + "%"); clip(); }
    knob.addEventListener("pointerdown", function (e) { drag = true; knob.setPointerCapture(e.pointerId); e.preventDefault(); });
    knob.addEventListener("pointermove", function (e) { if (drag) set(e.clientX); });
    knob.addEventListener("pointerup", function () { drag = false; });
    knob.addEventListener("keydown", function (e) { var r = wrap.getBoundingClientRect(); if (e.key === "ArrowLeft") set(r.left + r.width * (swipeX - .05)); if (e.key === "ArrowRight") set(r.left + r.width * (swipeX + .05)); });
  }

  function renderBar() {
    $("#eraBar").innerHTML = ERAS.map(function (e, i) {
      return '<button class="era-btn" type="button" role="tab" aria-selected="false" data-i="' + i + '"><b>' + esc(e.name) + '</b><span>' + esc(e.range) + '</span></button>';
    }).join("");
    $$("#eraBar .era-btn").forEach(function (b) { b.onclick = function () { location.hash = "#time/" + ERAS[+b.dataset.i].id; }; });
  }

  function renderTools(conf) {
    var t = $("#tmTools");
    var opts = conf.layers.map(function (l, i) { return '<option value="' + i + '">' + esc(l.name) + '</option>'; }).join("");
    var op = conf.opacity != null ? conf.opacity : 0.85;
    t.innerHTML = (conf.layers.length ? '<label>老地圖 <select id="tmLayer">' + opts + (conf.opacity === 0 ? '<option value="-1" selected>不疊圖</option>' : "") + '</select></label>' +
      '<label>透明度 <input id="tmOp" type="range" min="0" max="1" step="0.05" value="' + op + '" aria-label="老地圖透明度"></label>' +
      '<label><input id="tmSwipe" type="checkbox"' + (swipeOn ? " checked" : "") + '> 左右對照（左：老地圖／右：現在）</label>' : '<p style="max-width:240px">' + esc(conf.note) + '</p>') +
      (wallLatLngs() && !conf.wall ? '<label><input id="tmWall" type="checkbox"> 顯示清代城牆位置</label>' : "");
    var sel = $("#tmLayer"), opEl = $("#tmOp"), swEl = $("#tmSwipe"), wEl = $("#tmWall");
    var apply = function () {
      var i = sel ? +sel.value : -1, o = opEl ? +opEl.value : 0.85;
      if (i >= 0 && o === 0) { o = 0.85; opEl.value = o; }
      setOverlay(i >= 0 ? conf.layers[i] : null, o);
      if (i < 0) $("#tmLabel").textContent = "現在的" + A.CFG.name;
    };
    if (sel) { sel.onchange = apply; opEl.oninput = function () { if (overlay) overlay.setOpacity(+this.value); }; }
    if (swEl) swEl.onchange = function () { swipeOn = this.checked; $("#swipe").hidden = !swipeOn; if (swipeOn && opEl && +opEl.value < 1) { opEl.value = 1; if (overlay) overlay.setOpacity(1); } clip(); };
    if (wEl) wEl.onchange = function () { if (this.checked) drawWall(false); else wallLayer.clearLayers(); };
    if (conf.layers.length) apply(); else { setOverlay(null); $("#tmLabel").textContent = "示意：" + (ERAS[eraIdx] ? ERAS[eraIdx].name : ""); }
  }

  function showEra(i) {
    if (i < 0 || i >= ERAS.length) i = 0;
    eraIdx = i;
    var e = ERAS[i], conf = CONF[e.id] || { layers: [], end: 2026 };
    A.track("eras", e.id);
    $$("#eraBar .era-btn").forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); if (k === i) b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); });
    tmap.getContainer().classList.toggle("old-paper", !!conf.paper);
    if (!conf.layers.length) { swipeOn = false; $("#swipe").hidden = true; }
    renderTools(conf);
    if (conf.wall) drawWall(true); else wallLayer.clearLayers();

    // 地標
    lmLayer.clearLayers();
    (e.landmarks || []).forEach(function (m) {
      if (m.lat == null) return;
      L.marker([m.lat, m.lng], { icon: L.divIcon({ className: "", html: '<div class="pin" style="--c:#7a5236"><b>' + (m.approx ? "≈" : "★") + '</b></div>', iconSize: [30, 30], iconAnchor: [4, 30], popupAnchor: [12, -28] }), zIndexOffset: 500 })
        .bindPopup("<b>" + esc(m.name) + "</b>" + (m.approx ? "（推定位置）" : "") + "<br>" + esc(m.note || "")).addTo(lmLayer);
    });
    // 當時已存在、今天仍保存的文化資產
    siteLayer.clearLayers();
    var exist = A.sites.filter(function (s) { return s.year <= conf.end; });
    exist.forEach(function (s) {
      L.circleMarker([s.lat, s.lng], { radius: 6, color: "#fff", weight: 2, fillColor: A.CAT[s.category].hex, fillOpacity: .9 })
        .bindTooltip(s.short + "（" + A.yearLabel(s) + "）", { className: "tip" }).on("click", function () { location.hash = "#map/" + s.id; }).addTo(siteLayer);
    });

    // 面板
    if (panelPlayer) { panelPlayer.destroy(); panelPlayer = null; }
    var p = $("#eraPanel");
    p.scrollTop = 0;
    p.innerHTML =
      (!introDone ? '<details class="card" style="padding:8px 12px"><summary style="cursor:pointer;font-weight:700">怎麼用時光地圖？（語音說明）</summary><div id="tIntro" style="margin-top:8px"></div></details>' : "") +
      '<div><p class="range">' + esc(e.range) + '・' + esc(e.cityName || "") + '</p><h2>' + esc(e.name) + '：' + esc(e.title || "") + '</h2></div>' +
      '<div id="ePlayer"></div>' +
      '<p>' + esc(e.summary) + '</p>' +
      (e.population ? '<p class="funfact"><b>人口｜</b>' + esc(e.population) + '</p>' : "") +
      '<p class="hint">' + esc(conf.note || "") + '</p>' +
      (conf.wall && CY.qingCity ? '<details class="card" style="padding:8px 12px"><summary style="cursor:pointer;font-weight:700">紅色虛線：' + esc(CY.qingCity.name || "清代嘉義城") + '（推定範圍）</summary><p style="margin-top:6px;font-size:.9rem">' + esc(CY.qingCity.represents || "") + '</p><p class="hint" style="margin-top:6px">怎麼畫的：' + esc(CY.qingCity.method || "") + '</p><p class="hint" style="margin-top:6px">可信度：' + esc(CY.qingCity.confidence || "") + '</p>' +
        ((CY.qingCity.sources || []).length ? '<p class="sources" style="margin-top:6px">' + CY.qingCity.sources.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>'; }).join("、") + '</p>' : "") + '</details>' : "") +
      '<div><h3 style="margin-bottom:6px">大事記</h3><ul class="events">' + (e.events || []).map(function (ev) { return '<li><b>' + esc(ev.year) + '</b>' + esc(ev.text) + '</li>'; }).join("") + '</ul></div>' +
      ((e.landmarks || []).length ? '<div><h3 style="margin-bottom:6px">這個時期的地標</h3><ul class="lm-list">' + e.landmarks.map(function (m, k) { return '<li data-k="' + k + '"><b>' + esc(m.name) + (m.approx ? '（推定）' : "") + '</b>' + esc(m.note || "") + '</li>'; }).join("") + '</ul></div>' : "") +
      '<div><h3 style="margin-bottom:6px">這時已經出現、今天仍保存的文化資產：' + exist.length + ' / ' + A.sites.length + ' 處</h3><div class="grow-bar"><i style="width:' + (exist.length / A.sites.length * 100).toFixed(1) + '%"></i></div>' +
      '<div class="chips" style="margin-top:8px">' + exist.slice().sort(function (a, b) { return a.year - b.year; }).map(function (s) { return '<a class="chip" href="#map/' + s.id + '">' + esc(s.short) + '・' + A.yearLabel(s) + '</a>'; }).join("") + '</div></div>' +
      ((e.quiz || []).length ? '<div><h3 style="margin-bottom:6px">時光小測驗</h3><div id="eQuiz0"></div><div id="eQuiz1" style="margin-top:8px"></div></div>' : "") +
      '<div style="display:flex;gap:8px;justify-content:space-between">' + (i > 0 ? '<a class="btn btn-sm" href="#time/' + ERAS[i - 1].id + '">‹ ' + esc(ERAS[i - 1].name) + '</a>' : "<span></span>") + (i < ERAS.length - 1 ? '<a class="btn btn-sm btn-primary" href="#time/' + ERAS[i + 1].id + '">' + esc(ERAS[i + 1].name) + ' ›</a>' : "") + '</div>' +
      ((e.sources || []).length ? '<p class="sources">參考資料：' + e.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>'; }).join("、") + '</p>' : "");
    if (!introDone) { introDone = true; new V.Player($("#tIntro", p), { track: "time-intro", lines: CY.extra.timeIntro, title: "時光地圖說明", audioBase: "audio/", compact: true }); }
    if (e.dialogue && e.dialogue.length) panelPlayer = new V.Player($("#ePlayer", p), { track: "era-" + e.id, lines: e.dialogue, title: e.name, audioBase: "audio/" });
    (e.quiz || []).slice(0, 2).forEach(function (q, k) { A.renderQuiz($("#eQuiz" + k, p), q); });
    $$(".lm-list li", p).forEach(function (li) { li.onclick = function () { var m = e.landmarks[+li.dataset.k]; if (m.lat != null) tmap.setView([m.lat, m.lng], 17); }; });

    // 視野
    var pts = (e.landmarks || []).filter(function (m) { return m.lat != null; }).map(function (m) { return [m.lat, m.lng]; });
    if (conf.wall && wallLatLngs()) tmap.fitBounds(L.latLngBounds(wallLatLngs()).pad(0.6), { maxZoom: 17 });
    else if (e.view && e.view.lat != null) tmap.setView([e.view.lat, e.view.lng], e.view.zoom || A.CFG.timeZoom || 15);
    else if (pts.length >= 2) tmap.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 16 });
    else tmap.setView(A.CENTER, A.CFG.timeZoom || 15);
  }

  A.register("time", { show: function (args) {
    if (!ERAS.length) { $("#eraPanel").innerHTML = "<p>時光地圖資料準備中。</p>"; }
    if (!tmap) { initMap(); renderBar(); }
    setTimeout(function () { tmap.invalidateSize(); clip(); }, 60);
    if (!ERAS.length) return;
    var id = args[0], i = -1;
    ERAS.forEach(function (e, k) { if (e.id === id) i = k; });
    if (i < 0) i = eraIdx >= 0 ? eraIdx : 0;
    if (i !== eraIdx || !args[0]) showEra(i);
  } });
})();
