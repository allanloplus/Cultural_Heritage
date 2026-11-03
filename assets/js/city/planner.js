/* 行程規劃：天數 × 交通方式 × 景點選擇，YouBike 顯示借車／還車站
 * 路線：FOSSGIS OSRM（routing.openstreetmap.de）；失敗時以直線距離估算 */
(function () {
  "use strict";
  var A = window.App, CY = A.CY, V = window.Voice, esc = V.esc, $ = A.$, $$ = A.$$;
  var X = CY.extra, PC = A.CFG.planner || {}, SP = PC.speeds || {}, HINT = PC.hints || {};

  var MODES = {
    car: { name: "開車", profile: "routed-car", kmh: SP.car || 22, detour: 1.35, extra: 8, osrmFactor: 1.35, gm: "driving",
      hint: HINT.car || "每站已預留約 8 分鐘停車時間。" },
    scooter: { name: "機車", profile: "routed-car", kmh: SP.scooter || 24, detour: 1.3, extra: 3, osrmFactor: 1.15, gm: "driving",
      hint: HINT.scooter || "請停放在機車停車格，留意單行道與兩段式左轉。" },
    bike: { name: "自行車", profile: "routed-bike", kmh: SP.bike || 13, detour: 1.3, extra: 2, osrmFactor: 1.1, gm: "bicycling",
      hint: HINT.bike || "請走自行車道或慢車道並注意安全。" },
    walk: { name: "走路", profile: "routed-foot", kmh: 4.5, detour: 1.25, extra: 0, osrmFactor: 1, gm: "walking",
      hint: HINT.walk || "步行單段超過 25 分鐘會提醒你改騎 YouBike 或搭計程車。" },
    ubike: { name: "YouBike", profile: "routed-bike", kmh: SP.ubike || 13, detour: 1.3, extra: 3, osrmFactor: 1.1, gm: "bicycling",
      hint: HINT.ubike || "每段會找離景點最近的借車站與還車站，可按「查詢即時車輛」看可借／可還數量。距離 700 公尺內建議直接步行。" }
  };
  /* 走路或騎車距離太遠（例如跨鄉鎮）時改以開車／計程車估算並提醒 */
  var FAR = { walk: PC.walkMaxKm || 3, bike: PC.bikeMaxKm || 12, ubike: PC.bikeMaxKm || 12 }, UB_MAX = PC.ubikeStationMaxKm || 1.2, TAXI_KMH = SP.car || 22;
  var WALK_KMH = 4.5, DAY_END = 18 * 60, LUNCH = { from: 11 * 60 + 40, len: 60 };
  var DAY_COLORS = ["#df6f57", "#1d6f73", "#6b5bb5", "#b8860b", "#3b7bbf", "#2f7d4f", "#b23a3a"];
  /* 離島：planner.islands = [{name, bbox:[南,西,北,東], port:[lat,lng], portName, mainPort:[lat,lng], seaMin, note}]
   * 不同區（本島／各離島）之間的路段不能開車或騎車，改顯示「搭船／搭機」 */
  var ISLANDS = PC.islands || [];
  function zoneOf(p) {
    for (var i = 0; i < ISLANDS.length; i++) { var b = ISLANDS[i].bbox; if (p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]) return i; }
    return -1;
  }
  var THEMES = {}; A.sites.forEach(function (s) { s.themes.forEach(function (t) { THEMES[t] = 1; }); });

  var st = { days: "1", mode: PC.defaultMode || "walk", pick: "rec", start: (X.starts[0] || {}).id || "station", pace: 1, time: "09:00", themes: {}, picks: {} };
  (A.store(A.KEY + "picks") || []).forEach(function (id) { st.picks[id] = true; });
  var pmap, layers, startLL = null, ubLayer, plan = null, inited = false;

  function minutes(hhmm) { var p = hhmm.split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function hm(m) { m = Math.round(m); return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }
  function dur(m) { m = Math.round(m); return m < 60 ? m + " 分" : Math.floor(m / 60) + " 小時" + (m % 60 ? " " + (m % 60) + " 分" : ""); }

  /* ---------- UI ---------- */
  function chips(el, items, key) {
    el.innerHTML = items.map(function (it) { return '<button type="button" class="chip" role="radio" aria-checked="' + (st[key] === it[0]) + '" data-v="' + it[0] + '">' + it[1] + '</button>'; }).join("");
    $$(".chip", el).forEach(function (b) { b.onclick = function () { st[key] = b.dataset.v; $$(".chip", el).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); }); onChange(key); }; });
  }
  function onChange(key) {
    if (key === "mode") { $("#modeHint").textContent = MODES[st.mode].hint; toggleUbikeLayer(); }
    if (key === "pick") renderPickBox();
  }

  function renderPickBox() {
    var box = $("#pickBox");
    if (st.pick === "rec") {
      box.hidden = false;
      var p = st.days === "all" ? null : X.plans[st.days];
      box.innerHTML = p ? '<p><b>' + esc(p.name) + '</b></p>' + p.days.map(function (d, i) { return '<p class="hint">第 ' + (i + 1) + ' 天：' + d.map(function (id) { return esc(A.byId[id].short); }).join("、") + '</p>'; }).join("")
        : '<p><b>文資全制霸</b></p><p class="hint">全部 ' + A.sites.length + ' 處文化資產，依交通方式與時間自動分成好幾天。</p>';
      return;
    }
    box.hidden = false;
    if (st.pick === "theme") {
      box.innerHTML = '<p class="hint">選一個或多個主題：</p><div class="chips">' + Object.keys(THEMES).map(function (t) { return '<button type="button" class="chip" aria-pressed="' + !!st.themes[t] + '" data-t="' + esc(t) + '">' + esc(t) + '</button>'; }).join("") + '</div><p class="hint" id="themeCount"></p>';
      var upd = function () { var n = A.sites.filter(function (s) { return s.themes.some(function (t) { return st.themes[t]; }); }).length; $("#themeCount").textContent = "共 " + n + " 處景點"; };
      $$(".chip", box).forEach(function (b) { b.onclick = function () { st.themes[b.dataset.t] = !st.themes[b.dataset.t]; b.setAttribute("aria-pressed", String(!!st.themes[b.dataset.t])); upd(); }; });
      upd();
      return;
    }
    // 自選
    var groups = {};
    A.sites.forEach(function (s) { (groups[s.category] = groups[s.category] || []).push(s); });
    box.innerHTML = '<div class="pick-tools"><button type="button" class="btn btn-sm" id="pkNone">全部取消</button><span class="hint" id="pkCount"></span></div>' +
      CY.categories.map(function (c) {
        return '<h4>' + c + '</h4>' + (groups[c] || []).map(function (s) { return '<label><input type="checkbox" value="' + s.id + '"' + (st.picks[s.id] ? " checked" : "") + '> ' + esc(s.name) + ' <span class="hint">約' + s.visitMin + '分</span></label>'; }).join("");
      }).join("");
    var cnt = function () { $("#pkCount").textContent = "已選 " + Object.keys(st.picks).filter(function (k) { return st.picks[k]; }).length + " 處（也可在文資地圖按「加入自選行程」）"; };
    $$("input[type=checkbox]", box).forEach(function (cb) { cb.onchange = function () { st.picks[cb.value] = cb.checked; savePicks(); cnt(); }; });
    $("#pkNone").onclick = function () { st.picks = {}; savePicks(); renderPickBox(); };
    cnt();
  }
  function savePicks() { A.store(A.KEY + "picks", Object.keys(st.picks).filter(function (k) { return st.picks[k]; })); }

  function initUI() {
    new V.Player($("#planIntro"), { track: "plan-intro", lines: X.planIntro, title: "行程小幫手", audioBase: "audio/", compact: true });
    chips($("#pDays"), [["1", "一日遊"], ["2", "二日遊"], ["3", "三日遊"], ["all", "不限天數"]], "days");
    var hasUB = (CY.ubike.stations || []).length > 0;
    chips($("#pMode"), [["car", "開車"], ["scooter", "機車"], ["bike", "自行車"], ["walk", "走路"], ["ubike", hasUB ? "YouBike" : "YouBike（無站點）"]], "mode");
    if (!hasUB) {
      var ubChip = $('#pMode .chip[data-v="ubike"]');
      ubChip.setAttribute("aria-disabled", "true"); ubChip.style.opacity = ".5";
      ubChip.onclick = function () { A.toast(A.CFG.name + "目前沒有 YouBike 2.0 站點，建議改開車、機車或自行車", "R", "sad"); };
    }
    chips($("#pPick"), [["rec", "推薦行程"], ["theme", "依主題"], ["custom", "自選景點"]], "pick");
    $$("#pDays .chip").forEach(function (b) { b.addEventListener("click", function () { if (st.pick === "rec") renderPickBox(); }); });
    $("#pStart").innerHTML = X.starts.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join("");
    $("#pStart").onchange = function () { st.start = this.value; setStart(); };
    $("#pPace").onchange = function () { st.pace = +this.value; };
    $("#pTime").onchange = function () { st.time = this.value || "09:00"; };
    $("#pGo").onclick = generate;
    $("#modeHint").textContent = MODES[st.mode].hint;
    renderPickBox();
  }

  function initMap() {
    pmap = L.map("pmap", { minZoom: A.CFG.minZoom, maxZoom: 19 }).setView(A.CENTER, A.CFG.zoom);
    var bl = A.baseLayers();
    bl["通用電子地圖（國土測繪中心）"].addTo(pmap);
    L.control.layers(bl, null, { position: "topright" }).addTo(pmap);
    L.control.scale({ imperial: false }).addTo(pmap);
    layers = L.layerGroup().addTo(pmap);
    ubLayer = L.layerGroup();
    (CY.ubike.stations || []).forEach(function (s) {
      L.marker([s.lat, s.lng], { icon: L.divIcon({ className: "", html: '<div class="ub-dot"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }), title: s.name })
        .bindPopup('<b>YouBike 2.0：' + esc(s.name) + '</b><br>' + esc(s.addr) + '<br>車柱 ' + s.spaces + ' 位').addTo(ubLayer);
    });
    pmap.on("click", function (e) { if (st.start === "pick") { startLL = [e.latlng.lat, e.latlng.lng]; drawStart(); A.toast("出發點已設定", "R", "thumb"); } });
    setStart();
    toggleUbikeLayer();
  }
  function toggleUbikeLayer() { if (!pmap) return; if (st.mode === "ubike") ubLayer.addTo(pmap); else pmap.removeLayer(ubLayer); }

  var startMarker;
  function drawStart() {
    if (startMarker) pmap.removeLayer(startMarker);
    if (!startLL) return;
    startMarker = L.marker(startLL, { icon: L.divIcon({ className: "", html: '<div class="pin pin-num" style="--c:#2b2521"><b>起</b></div>', iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 1000 }).bindTooltip("出發點", { className: "tip" }).addTo(pmap);
  }
  function setStart() {
    var s = X.starts.filter(function (x) { return x.id === st.start; })[0];
    if (s.id === "gps") {
      if (!navigator.geolocation) { A.toast("此裝置無法定位，改用" + X.starts[0].name, "A", "scratch"); startLL = [X.starts[0].lat, X.starts[0].lng]; drawStart(); return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        startLL = [p.coords.latitude, p.coords.longitude];
        if (A.dist(startLL[0], startLL[1], A.CENTER[0], A.CENTER[1]) > (PC.farKm || 15) * 1000) { A.toast("你目前不在" + A.CFG.name + "附近，先以" + X.starts[0].name + "當出發點", "A", "scratch"); startLL = [X.starts[0].lat, X.starts[0].lng]; }
        drawStart();
      }, function () { A.toast("無法取得位置，改用" + X.starts[0].name, "A", "scratch"); startLL = [X.starts[0].lat, X.starts[0].lng]; drawStart(); }, { timeout: 8000 });
      return;
    }
    if (s.id === "pick") { A.toast("請在右邊地圖上點一下，設定出發點", "R", "explain"); return; }
    startLL = [s.lat, s.lng];
    if (s.note) A.toast(s.note, "A", "point");
    drawStart();
  }

  /* ---------- 排序與估算 ---------- */
  function dkm(a, b) { return A.dist(a[0], a[1], b[0], b[1]) / 1000; }
  /* 排序用距離：跨海加上很大的懲罰，讓同一座島的景點排在一起 */
  function dz(a, b) { return dkm(a, b) + (ISLANDS.length && zoneOf(a) !== zoneOf(b) ? 1000 : 0); }
  function ll(s) { return [s.lat, s.lng]; }
  function order(sites, from) {
    var rest = sites.slice(), out = [], cur = from;
    while (rest.length) {
      var bi = 0, bd = 1e9;
      rest.forEach(function (s, i) { var d = dz(cur, ll(s)); if (d < bd) { bd = d; bi = i; } });
      cur = ll(rest[bi]); out.push(rest.splice(bi, 1)[0]);
    }
    // 2-opt（開放路徑）
    var pts = [from].concat(out.map(ll)), improved = true, n = pts.length, guard = 0;
    var seq = out.slice();
    while (improved && guard++ < 60) {
      improved = false;
      for (var i = 0; i < n - 2; i++) for (var k = i + 1; k < n - 1; k++) {
        var a = pts[i], b = pts[i + 1], c = pts[k], d = pts[k + 1];
        var before = dz(a, b) + (d ? dz(c, d) : 0), after = dz(a, c) + (d ? dz(b, d) : 0);
        if (after + 1e-6 < before) {
          pts = pts.slice(0, i + 1).concat(pts.slice(i + 1, k + 1).reverse(), pts.slice(k + 1));
          seq = seq.slice(0, i).concat(seq.slice(i, k).reverse(), seq.slice(k));
          improved = true;
        }
      }
    }
    return seq;
  }

  function legEstimate(from, to, mode) {
    var M = MODES[mode], d = dkm(from, to);
    if (ISLANDS.length) {
      var zf = zoneOf(from), zt = zoneOf(to);
      if (zf !== zt) {
        var toIsland = zt >= 0, I = ISLANDS[toIsland ? zt : zf];
        var land = toIsland ? (I.port ? legEstimate(I.port, to, mode) : null) : (I.mainPort ? legEstimate(I.mainPort, to, mode) : null);
        return { sea: true, isl: I, toIsland: toIsland, land: land, km: land ? land.km : 0, min: (I.seaMin || 120) + (land ? land.min : 0) };
      }
    }
    if (FAR[mode] && d > FAR[mode]) return { km: d * 1.35, min: d * 1.35 / TAXI_KMH * 60 + 5, far: true };
    if ((mode === "car" || mode === "scooter") && d > 0.03 && d < 0.6) return { km: d * 1.25, min: d * 1.25 / WALK_KMH * 60, walkOnly: true, park: true };
    if (mode === "ubike") {
      if (d < 0.7) return { km: d * 1.25, min: d * 1.25 / WALK_KMH * 60, walkOnly: true };
      var b = A.nearestUbike(from[0], from[1], 1)[0], r = A.nearestUbike(to[0], to[1], 1)[0];
      if (!b || !r || b.d / 1000 > UB_MAX || r.d / 1000 > UB_MAX) {
        if (d < 2.5) return { km: d * 1.25, min: d * 1.25 / WALK_KMH * 60, walkOnly: true, noUbike: true };
        return { km: d * 1.35, min: d * 1.35 / TAXI_KMH * 60 + 5, far: true, noUbike: true };
      }
      var w1 = b.d / 1000 * 1.25, w2 = r.d / 1000 * 1.25, bk = dkm([b.s.lat, b.s.lng], [r.s.lat, r.s.lng]) * M.detour;
      if (b.s.no === r.s.no) return { km: d * 1.25, min: d * 1.25 / WALK_KMH * 60, walkOnly: true };
      return { km: w1 + bk + w2, min: (w1 + w2) / WALK_KMH * 60 + bk / M.kmh * 60 + M.extra, borrow: b.s, ret: r.s, walk1: w1, walk2: w2, bikeKm: bk };
    }
    var km = d * M.detour;
    return { km: km, min: km / M.kmh * 60 + (d > 0.05 ? M.extra : 0) };
  }

  function buildDays(dayLists, mode, pace, startMin, autoSplit) {
    var days = [];
    var lists = autoSplit ? [dayLists[0]] : dayLists;
    var queue = lists.map(function (l) { return order(l, startLL); });
    if (autoSplit) queue = [order(dayLists[0], startLL)];
    var remaining = autoSplit ? queue[0].slice() : null;
    var di = 0;
    var prevZone = zoneOf(startLL);
    while (autoSplit ? remaining.length : di < queue.length) {
      var seq = autoSplit ? remaining : queue[di];
      var dayStart = startLL, overnight = null;
      /* 自動分天：前一天停在離島、今天第一站也在同一座島，就假設住在島上，從島上港口出發 */
      if (autoSplit && days.length && seq.length && prevZone >= 0 && zoneOf(ll(seq[0])) === prevZone && ISLANDS[prevZone].port) {
        overnight = ISLANDS[prevZone]; dayStart = overnight.port; seq = remaining = order(remaining.filter(function (s) { return zoneOf(ll(s)) === prevZone; }), dayStart).concat(remaining.filter(function (s) { return zoneOf(ll(s)) !== prevZone; }));
      }
      var t = startMin, cur = dayStart, lunch = false, stops = [], used = 0;
      for (var i = 0; i < seq.length; i++) {
        var s = seq[i], sz = zoneOf(ll(s));
        /* 自動分天時，一天之內不跨海兩次：已經在某一區玩過，要換區就留到下一天 */
        if (autoSplit && stops.length && sz !== zoneOf(cur)) break;
        var leg = legEstimate(cur, ll(s), mode), visit = Math.round(s.visitMin * pace);
        var arrive = t + leg.min, lunchHere = false;
        if (!lunch && arrive >= LUNCH.from) { lunchHere = true; lunch = true; arrive += LUNCH.len; }
        if (autoSplit && stops.length && arrive + visit > DAY_END) break;
        stops.push({ s: s, leg: leg, arrive: arrive, leave: arrive + visit, lunch: lunchHere });
        t = arrive + visit; cur = ll(s); used++;
      }
      prevZone = zoneOf(cur);
      if (autoSplit) { if (!used) { used = 1; } remaining = remaining.slice(used); if (remaining.length) remaining = order(remaining, startLL); }
      days.push({ stops: stops, end: t, start: dayStart, overnight: overnight });
      di++;
      if (days.length > 14) break;
    }
    return days;
  }

  function selection() {
    if (st.pick === "rec") {
      if (st.days === "all") return { lists: [A.sites.slice()], auto: true, name: "文資全制霸" };
      var p = X.plans[st.days];
      return { lists: p.days.map(function (d) { return d.map(function (id) { return A.byId[id]; }); }), auto: false, name: p.name };
    }
    var pool = st.pick === "theme" ? A.sites.filter(function (s) { return s.themes.some(function (t) { return st.themes[t]; }); })
      : A.sites.filter(function (s) { return st.picks[s.id]; });
    return { lists: [pool], auto: true, name: st.pick === "theme" ? "主題行程：" + Object.keys(st.themes).filter(function (k) { return st.themes[k]; }).join("、") : "自選行程" };
  }

  /* ---------- 產生 ---------- */
  function generate() {
    if (!startLL) { A.toast(st.start === "pick" ? "請先在地圖上點選出發點" : "正在取得出發點，請稍候再按一次", "R", "confused"); return; }
    var sel = selection();
    if (!sel.lists[0].length) { A.toast(st.pick === "theme" ? "請至少選一個主題" : "請先勾選想去的景點", "R", "confused"); return; }
    var days = buildDays(sel.lists, st.mode, st.pace, minutes(st.time), sel.auto);
    plan = { name: sel.name, mode: st.mode, days: days, limit: st.days };
    render();
    draw();
    A.stamp("plan");
    refineRoutes();
    if (window.innerWidth <= 900) $("#planOut").scrollIntoView({ behavior: "smooth" });
  }

  function legHtml(leg, mode) {
    var M = MODES[mode];
    if (leg.sea) {
      var I = leg.isl, ln = leg.land;
      return '<div class="leg leg-sea">' + (leg.toIsland ? "搭船／搭機前往" + esc(I.name) : "從" + esc(I.name) + "搭船／搭機返回" + (I.back || "本島")) + '，請先查詢船班與航班（這段無法開車或騎車）' +
        (ln && ln.km >= 0.03 ? '；' + (leg.toIsland ? "上岸後" : "回到本島後") + (ln.far ? "開車／計程車" : ln.walkOnly ? "步行" : M.name) + '約 ' + Math.round(ln.min) + ' 分・' + A.km(ln.km * 1000) : "") +
        '<span class="warn">' + esc(I.note || "") + '時間以約 ' + dur(leg.min) + ' 粗估，實際依船班、航班與天候而定。</span></div>';
    }
    if (leg.km < 0.03) return "";
    if (leg.far) return '<div class="leg">開車／計程車約 ' + Math.round(leg.min) + ' 分・' + A.km(leg.km * 1000) + '（直線估算）<span class="warn">' + (leg.noUbike ? "附近沒有 YouBike 站，" : "") + '這段距離比較遠，建議開車、搭計程車或公車。</span></div>';
    if (leg.walkOnly) return '<div class="leg">步行約 ' + Math.round(leg.min) + ' 分（' + A.km(leg.km * 1000) + (leg.noUbike ? "，附近沒有 YouBike 站" : leg.park ? "，距離近，車停著走過去就好" : "，距離近建議步行") + '）</div>';
    var h = '<div class="leg">' + M.name + ' 約 ' + Math.round(leg.min) + ' 分・' + A.km(leg.km * 1000) + (leg.osrm ? "（路線估算）" : "（直線估算）");
    if (leg.borrow) {
      h += '<span class="ub" data-b="' + leg.borrow.no + '" data-r="' + leg.ret.no + '"><i class="b">借</i>' + esc(leg.borrow.name) + '（步行 ' + A.km(leg.walk1 * 1000) + '）<span class="lb"></span></span>' +
        '<span class="ub"><i class="r">還</i>' + esc(leg.ret.name) + '（步行 ' + A.km(leg.walk2 * 1000) + '）<span class="lr"></span></span>';
    }
    if (mode === "walk" && leg.min > 25) h += '<span class="warn">這段走比較久，可以改騎 YouBike 或搭計程車。</span>';
    return h + '</div>';
  }

  function render() {
    var out = $("#planOut"), M = MODES[plan.mode];
    var totalStops = 0, totalKm = 0;
    plan.days.forEach(function (d) { totalStops += d.stops.length; d.stops.forEach(function (x) { totalKm += x.leg.km; }); });
    var over = plan.limit !== "all" && plan.days.length > +plan.limit;
    var late = plan.days.some(function (d) { return d.end > DAY_END + 30; });
    var seaLegs = 0; plan.days.forEach(function (d) { d.stops.forEach(function (x) { if (x.leg.sea) seaLegs++; }); });
    out.innerHTML = '<div class="plan-sum"><b>' + esc(plan.name) + '</b>｜' + M.name + '｜' + plan.days.length + ' 天・' + totalStops + ' 站・移動約 ' + totalKm.toFixed(1) + ' 公里' +
      (over ? '<br><span style="color:var(--bad)">選的景點比較多，需要 ' + plan.days.length + ' 天才走得完。</span>' : "") +
      (late ? '<br><span style="color:var(--bad)">有幾天會玩到 18:00 以後，可改成「快速」步調或換交通方式。</span>' : "") +
      (seaLegs ? '<br><span style="color:var(--bad)">行程含離島，有 ' + seaLegs + ' 段要搭船或搭飛機；船班、航班會因季節與天候停駛，請先查詢並預訂。移動公里數不含海上距離。</span>' : "") + '</div>' +
      '<div class="plan-actions">' + (plan.mode === "ubike" ? '<button class="btn btn-sm btn-teal" type="button" id="pLive">查詢 YouBike 即時車輛</button>' : "") +
      '<button class="btn btn-sm" type="button" id="pCopy">複製行程文字</button><button class="btn btn-sm" type="button" id="pPrint">列印</button></div>' +
      plan.days.map(function (d, di) {
        return '<div class="day-card" data-d="' + di + '" style="border-top:5px solid ' + DAY_COLORS[di % DAY_COLORS.length] + '"><h3>第 ' + (di + 1) + ' 天 <small>' + hm(minutes(st.time)) + '–' + hm(d.end) + '・' + d.stops.length + ' 站</small></h3>' +
          (d.overnight ? '<p class="hint">前一晚住在' + esc(d.overnight.name) + '，今天從' + esc(d.overnight.portName || d.overnight.name) + '出發。</p>' : "") + '<ol class="stops">' +
          d.stops.map(function (x, k) {
            return legHtml(x.leg, plan.mode) +
              (x.lunch ? '<div class="leg" style="border-color:var(--sun)">午餐時間（約 1 小時）：' + esc(PC.lunchNote || "附近找間在地小吃") + '</div>' : "") +
              '<li class="stop"><span class="t">' + hm(x.arrive) + '</span><div><h4 data-id="' + x.s.id + '">' + (k + 1) + '. ' + esc(x.s.name) + '</h4><p>停留約 ' + Math.round(x.s.visitMin * st.pace) + ' 分・' + esc(x.s.openNote) + ' <a href="#map/' + x.s.id + '">詳情與語音</a></p></div></li>';
          }).join("") + '</ol>' +
          (PC.eveningNote ? '<p class="hint" style="margin-top:6px">' + esc(PC.eveningNote) + '</p>' : "") +
          '<div class="plan-actions" style="margin-top:6px">' + gmLinks(d, plan.mode).map(function (u, k, arr) { return '<a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(u) + '">Google 地圖導航' + (arr.length > 1 ? "（第 " + (k + 1) + " 段）" : "") + '</a>'; }).join("") +
          '<button class="btn btn-sm" type="button" data-fit="' + di + '">在地圖上看這天</button></div></div>';
      }).join("") +
      '<p class="hint">時間為估算值；開放時間請以官方公告為準。路線資料：OpenStreetMap / FOSSGIS OSRM。</p>';
    $$(".stop h4", out).forEach(function (h) { h.onclick = function () { var s = A.byId[h.dataset.id]; pmap.setView([s.lat, s.lng], 17); }; });
    $$("[data-fit]", out).forEach(function (b) { b.onclick = function () { fitDay(+b.dataset.fit); if (window.innerWidth <= 900) $("#pmap").scrollIntoView(); }; });
    $("#pPrint").onclick = function () { window.print(); };
    $("#pCopy").onclick = function () {
      var txt = plan.name + "（" + M.name + "）\n" + plan.days.map(function (d, di) { return "第" + (di + 1) + "天\n" + d.stops.map(function (x, k) { return hm(x.arrive) + " " + (k + 1) + ". " + x.s.name + (x.leg.borrow ? "（借：" + x.leg.borrow.name + "／還：" + x.leg.ret.name + "）" : ""); }).join("\n"); }).join("\n\n") + "\n— Allan Lo 和你逛文化 " + location.href.split("#")[0] + "#plan";
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { A.toast("行程已複製", "R", "thumb"); }, function () { prompt("請複製行程：", txt); });
    };
    var lv = $("#pLive");
    if (lv) lv.onclick = function () {
      lv.disabled = true; lv.textContent = "查詢中…";
      A.ubikeLive().then(function (m) {
        $$(".ub[data-b]", out).forEach(function (u) {
          var b = m[u.dataset.b], r = m[u.dataset.r];
          $(".lb", u).textContent = b ? "：可借 " + b.bikes + " 輛" : "";
          var lr = u.nextElementSibling && $(".lr", u.nextElementSibling);
          if (lr) lr.textContent = r ? "：可還 " + r.empty + " 位" : "";
        });
        lv.textContent = "已更新即時車輛（" + new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) + "）";
        lv.disabled = false;
      }).catch(function () { lv.disabled = false; lv.textContent = "查詢失敗，請稍後再試"; });
    };
  }

  /* 一天的陸上路段：遇到跨海就切開，從港口重新開始 */
  function landRuns(d) {
    var runs = [[d.start || startLL]];
    d.stops.forEach(function (x) {
      var p = [x.s.lat, x.s.lng];
      if (x.leg.sea) { var I = x.leg.isl, q = x.leg.toIsland ? I.port : I.mainPort; runs.push(q ? [q, p] : [p]); }
      else runs[runs.length - 1].push(p);
    });
    return runs.filter(function (r) { return r.length > 1; });
  }
  function gmLinks(d, mode) {
    var out = [];
    landRuns(d).forEach(function (pts) {
      var i = 0;
      while (i < pts.length - 1) {
        var chunk = pts.slice(i, i + 10);
        var o = chunk[0], dst = chunk[chunk.length - 1], way = chunk.slice(1, -1);
        out.push("https://www.google.com/maps/dir/?api=1&origin=" + o.join(",") + "&destination=" + dst.join(",") + (way.length ? "&waypoints=" + way.map(function (p) { return p.join(","); }).join("|") : "") + "&travelmode=" + MODES[mode].gm);
        i += chunk.length - 1;
      }
    });
    return out;
  }

  var dayLines = [];
  function draw() {
    layers.clearLayers(); dayLines = [];
    plan.days.forEach(function (d, di) {
      var col = DAY_COLORS[di % DAY_COLORS.length];
      dayLines[di] = L.polyline(landRuns(d), { color: col, weight: 4, opacity: .75, dashArray: "6 8" }).addTo(layers);
      var prev = d.start || startLL;
      d.stops.forEach(function (x) {
        if (x.leg.sea) {
          var I = x.leg.isl, q = x.leg.toIsland ? I.port : I.mainPort;
          L.polyline([prev, q || [x.s.lat, x.s.lng]], { color: "#3b7bbf", weight: 3, opacity: .7, dashArray: "2 8" }).bindTooltip("搭船／搭機：" + esc(I.name) + "（請查詢班次）", { className: "tip", sticky: true }).addTo(layers);
        }
        prev = [x.s.lat, x.s.lng];
      });
      d.stops.forEach(function (x, k) {
        L.marker([x.s.lat, x.s.lng], { icon: L.divIcon({ className: "", html: '<div class="pin pin-num" style="--c:' + col + '"><b>' + (k + 1) + '</b></div>', iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 800 })
          .bindPopup('<b>第 ' + (di + 1) + ' 天・第 ' + (k + 1) + ' 站</b><br>' + esc(x.s.name) + '<br>' + hm(x.arrive) + ' 抵達<br><a href="#map/' + x.s.id + '">看介紹・聽導覽</a>').addTo(layers);
        if (x.leg.borrow) {
          L.marker([x.leg.borrow.lat, x.leg.borrow.lng], { icon: L.divIcon({ className: "", html: '<div class="ub-dot is-borrow"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 600 }).bindTooltip("借車：" + x.leg.borrow.name, { className: "tip" }).addTo(layers);
          L.marker([x.leg.ret.lat, x.leg.ret.lng], { icon: L.divIcon({ className: "", html: '<div class="ub-dot is-return"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 600 }).bindTooltip("還車：" + x.leg.ret.name, { className: "tip" }).addTo(layers);
        }
      });
    });
    drawStart();
    fitDay(-1);
  }
  function fitDay(di) {
    var b = L.latLngBounds([startLL]);
    plan.days.forEach(function (d, k) { if (di < 0 || di === k) { if (d.start) b.extend(d.start); } if (di < 0 || di === k) d.stops.forEach(function (x) { b.extend([x.s.lat, x.s.lng]); }); });
    pmap.fitBounds(b.pad(0.15));
  }

  /* 依實際道路路線更新距離與時間（每天一個請求；有跨海時每段陸路各一個請求） */
  function refineRoutes() {
    var M = MODES[plan.mode], myPlan = plan;
    plan.days.forEach(function (d, di) {
      var runs = [{ wps: [d.start || startLL], segs: [] }], cur = runs[0]; // segs[i] 連接 wps[i] → wps[i+1]
      d.stops.forEach(function (x) {
        if (x.leg.sea) {
          var I = x.leg.isl, q = x.leg.toIsland ? I.port : I.mainPort;
          cur = { wps: [q || [x.s.lat, x.s.lng]], segs: [] }; runs.push(cur);
          if (!q) return;
          var ln = x.leg.land || {};
          cur.wps.push([x.s.lat, x.s.lng]); cur.segs.push({ x: x, k: ln.far ? "far" : ln.walkOnly ? "walk" : "main" });
          return;
        }
        if (x.leg.borrow) { cur.wps.push([x.leg.borrow.lat, x.leg.borrow.lng]); cur.segs.push({ x: x, k: "w1" }); cur.wps.push([x.leg.ret.lat, x.leg.ret.lng]); cur.segs.push({ x: x, k: "bike" }); cur.wps.push([x.s.lat, x.s.lng]); cur.segs.push({ x: x, k: "w2" }); }
        else { cur.wps.push([x.s.lat, x.s.lng]); cur.segs.push({ x: x, k: x.leg.far ? "far" : x.leg.walkOnly ? "walk" : "main" }); }
      });
      runs = runs.filter(function (r) { return r.wps.length > 1; });
      if (!runs.length) return;
      setTimeout(function () {
        Promise.all(runs.map(function (run) {
          var url = "https://routing.openstreetmap.de/" + M.profile + "/route/v1/driving/" + run.wps.map(function (p) { return p[1].toFixed(6) + "," + p[0].toFixed(6); }).join(";") + "?overview=full&geometries=geojson";
          return fetch(url).then(function (r) { return r.json(); }).then(function (j) { return j.code === "Ok" ? j.routes[0] : null; }, function () { return null; });
        })).then(function (routes) {
          if (myPlan !== plan) return;
          var acc = {}, coords = [], ok = false;
          routes.forEach(function (r, ri) {
            if (!r) { coords.push(runs[ri].wps); return; }
            ok = true;
            r.legs.forEach(function (lg, i) {
              var sg = runs[ri].segs[i]; if (!sg || sg.k === "far") return;
              var a = acc[sg.x.s.id] = acc[sg.x.s.id] || { km: 0, min: 0 };
              a.km += lg.distance / 1000;
              if (sg.k === "w1" || sg.k === "w2" || sg.k === "walk") a.min += lg.distance / 1000 / WALK_KMH * 60;
              else a.min += lg.duration / 60 * M.osrmFactor;
            });
            coords.push(r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }));
          });
          if (!ok) return;
          var t = minutes(st.time), lunch = false;
          d.stops.forEach(function (x) {
            var a = acc[x.s.id];
            if (a && x.leg.sea && x.leg.land && !x.leg.land.far) {
              var ln = x.leg.land; ln.km = a.km; ln.min = a.min + (ln.walkOnly ? 0 : M.extra); ln.osrm = true;
              x.leg.km = ln.km; x.leg.min = (x.leg.isl.seaMin || 120) + ln.min;
            } else if (a && !x.leg.far && !x.leg.sea) { x.leg.km = a.km; x.leg.min = a.min + (x.leg.walkOnly ? 0 : M.extra); x.leg.osrm = true; }
            var arrive = t + x.leg.min; x.lunch = false;
            if (!lunch && arrive >= LUNCH.from) { lunch = true; x.lunch = true; arrive += LUNCH.len; }
            x.arrive = arrive; x.leave = arrive + Math.round(x.s.visitMin * st.pace); t = x.leave;
          });
          d.end = t;
          if (dayLines[di]) { dayLines[di].setLatLngs(coords); dayLines[di].setStyle({ dashArray: null, opacity: .85 }); }
          render();
        });
      }, di * 400);
    });
  }

  A.register("plan", { show: function () {
    if (!inited) { inited = true; initUI(); initMap(); }
    setTimeout(function () { pmap.invalidateSize(); }, 60);
  } });

  window.Planner = {
    /* 測試用：目前產生的行程 */
    current: function () { return plan; },
    addPick: function (id) {
      st.picks[id] = true; savePicks();
      st.pick = "custom";
      if (inited) { $$("#pPick .chip").forEach(function (x) { x.setAttribute("aria-checked", String(x.dataset.v === "custom")); }); renderPickBox(); }
    }
  };
})();
