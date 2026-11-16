/* 入口頁「搜尋全臺文化資產」：兩個網站 22 個縣市的有形文化資產、無形文化資產與古物
 * 索引由 tools/build_search.py 產生：
 *   assets/search/index.json  名稱、類別、縣市、鄉鎮、年代、摘要、關鍵字（第一次點搜尋框時載入）
 *   assets/search/intro.json  詳細介紹全文（送出搜尋後才在背景載入，補上「介紹中提到」的結果）
 * 網址 ?q=關鍵字 可以直接打開搜尋結果（分享用）。 */
(function () {
  "use strict";
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src || "";
    var i = s.indexOf("assets/js/search.js");
    return i >= 0 ? s.slice(0, i) : "";
  })();
  var PAGE = 40;
  var KINDS = ["有形文資", "無形文資", "古物"];
  var EXAMPLES = ["鹿港", "燈塔", "糖廠", "劉銘傳", "日式宿舍", "媽祖", "歌仔戲", "考古遺址"];

  var form = document.getElementById("searchForm"), input = document.getElementById("q");
  var box = document.getElementById("searchResults");
  if (!form || !input || !box) return;

  var IDX = null, INTRO = null, loading = null, introLoading = null, introFailed = false;
  var items = [];
  var state = { q: "", kind: -1, county: -1, town: "", shown: PAGE };
  var timer = 0;

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  /* 比對前統一寫法：大小寫、台／臺、砲／炮／礮、孔子廟／孔廟，去掉空白 */
  function norm(t) { return String(t || "").toLowerCase().replace(/台/g, "臺").replace(/[炮礮]/g, "砲").replace(/孔子廟/g, "孔廟").replace(/\s+/g, ""); }
  function terms(q) { return String(q).split(/[\s,，、　]+/).map(norm).filter(Boolean); }

  function catClass(it) {
    if (it.kind === 1) return "k-ich";
    if (it.kind === 2) return "k-anti";
    var c = it.cat;
    if (c.indexOf("國定") >= 0) return "k-national";
    if (c.indexOf("古蹟") >= 0) return "k-city";
    if (c.indexOf("聚落") >= 0) return "k-cluster";
    if (c.indexOf("景觀") >= 0 || c.indexOf("遺址") >= 0) return "k-landscape";
    return "k-building";
  }

  function loadIndex() {
    if (loading) return loading;
    setStatus("正在載入全臺文化資產清單…");
    loading = fetch(BASE + "assets/search/index.json").then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      IDX = d;
      items = d.items.map(function (a, i) {
        var c = d.counties[a[1]];
        return { i: i, kind: a[0], ci: a[1], id: a[2], name: a[3], cat: a[4], town: a[5], year: a[6], sum: a[7], thumb: a[8],
          county: c[1], base: c[2],
          nName: norm(a[3]), nPlace: norm(c[1] + a[5]), nCat: norm(a[4] + KINDS[a[0]]), nRest: norm(a[6] + a[7] + a[9]) };
      });
      setStatus("");
      return d;
    }).catch(function () {
      loading = null;
      setStatus("清單載入失敗，請檢查網路後再試一次。");
    });
    return loading;
  }

  function loadIntro() {
    if (introLoading || introFailed) return introLoading;
    introLoading = fetch(BASE + "assets/search/intro.json").then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      /* index.json 與 intro.json 必須是同一次建置的結果，否則順序對不上 */
      if (!IDX || d.hash !== IDX.meta.introHash || d.intro.length !== items.length) { introFailed = true; return; }
      INTRO = d.intro;
      items.forEach(function (it, i) { it.nIntro = norm(INTRO[i]); });
      run(false);
    }).catch(function () { introFailed = true; run(false); });
    return introLoading;
  }

  /* 計分：名稱完全相同 > 名稱開頭 > 名稱包含 > 縣市鄉鎮 > 類別 > 摘要與關鍵字 > 只在介紹中提到 */
  function score(it, ts) {
    var s = 0, introOnly = true;
    for (var k = 0; k < ts.length; k++) {
      var t = ts[k], v = 0;
      if (it.nName === t) v = 100;
      else if (it.nName.indexOf(t) === 0) v = 60;
      else if (it.nName.indexOf(t) >= 0) v = 40;
      else if (it.nPlace.indexOf(t) >= 0) v = 30;
      else if (it.nCat.indexOf(t) >= 0) v = 20;
      else if (it.nRest.indexOf(t) >= 0) v = 10;
      else if (it.nIntro && it.nIntro.indexOf(t) >= 0) v = 2;
      if (!v) return null;
      if (v > 2) introOnly = false;
      s += v;
    }
    if (it.cat.indexOf("國定") >= 0) s += 3;
    return { s: s, introOnly: introOnly };
  }

  function search() {
    var ts = terms(state.q);
    if (!ts.length) return [];
    var out = [];
    items.forEach(function (it) {
      var r = score(it, ts);
      if (r) out.push({ it: it, s: r.s, introOnly: r.introOnly });
    });
    out.sort(function (a, b) { return b.s - a.s || a.it.kind - b.it.kind || a.it.i - b.it.i; });
    return out;
  }

  function hl(text, ts) {
    var h = esc(text);
    ts.forEach(function (t) {
      /* 標示命中的字：把原文也做同樣的寫法統一後找位置 */
      var src = String(text), n = src.toLowerCase().replace(/台/g, "臺").replace(/[炮礮]/g, "砲");
      var p = n.indexOf(t);
      if (p < 0 || t.length < 1) return;
      var word = src.substr(p, t.length);
      h = h.split(esc(word)).join("<mark>" + esc(word) + "</mark>");
    });
    return h;
  }

  function snippet(it, ts) {
    var full = INTRO && INTRO[it.i] || "";
    var n = full.toLowerCase().replace(/台/g, "臺").replace(/[炮礮]/g, "砲");
    var p = n.indexOf(ts[0]);
    if (p < 0) return "";
    var a = Math.max(0, p - 30), b = Math.min(full.length, p + ts[0].length + 50);
    return (a > 0 ? "…" : "") + hl(full.slice(a, b), ts) + (b < full.length ? "…" : "");
  }

  function link(it) {
    if (it.kind !== 0 && !it.id) return it.base + "#map";
    return it.base + "#map/" + encodeURIComponent(it.id);
  }

  function thumb(it) {
    var cls = catClass(it);
    var glyph = it.kind === 1 ? "無形" : it.kind === 2 ? "古物" : it.name.charAt(0);
    var ph = '<span class="sr-ph ' + cls + '" aria-hidden="true">' + esc(glyph) + "</span>";
    if (!it.thumb) return ph;
    return '<span class="sr-ph ' + cls + '" aria-hidden="true">' + esc(glyph) + '<img src="' + esc(it.base + "img/" + it.id + "-0-s.webp") + '" alt="" loading="lazy" onerror="this.remove()"></span>';
  }

  function chip(label, n, pressed, attr) {
    return '<button type="button" class="chip" ' + attr + ' aria-pressed="' + (pressed ? "true" : "false") + '">' + esc(label) + (n != null ? " <small>" + n + "</small>" : "") + "</button>";
  }

  function render(all) {
    var ts = terms(state.q);
    if (!ts.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    var byKind = [0, 0, 0], byCounty = {}, byTown = {};
    var r1 = all.filter(function (x) { return state.county < 0 || x.it.ci === state.county; })
      .filter(function (x) { return !state.town || x.it.town === state.town; });
    r1.forEach(function (x) { byKind[x.it.kind]++; });
    var r2 = all.filter(function (x) { return state.kind < 0 || x.it.kind === state.kind; });
    r2.forEach(function (x) { byCounty[x.it.ci] = (byCounty[x.it.ci] || 0) + 1; });
    if (state.county >= 0) r2.filter(function (x) { return x.it.ci === state.county && x.it.town; })
      .forEach(function (x) { byTown[x.it.town] = (byTown[x.it.town] || 0) + 1; });
    var list = r2.filter(function (x) { return (state.county < 0 || x.it.ci === state.county) && (!state.town || x.it.town === state.town); });

    var html = '<div class="sr-head"><h2 class="t" id="searchTitle">搜尋「' + esc(state.q) + '」</h2>' +
      '<p class="sr-count">' + (list.length ? "找到 <b>" + list.length + "</b> 筆" : "沒有找到符合的文化資產") +
      (state.county >= 0 || state.kind >= 0 || state.town ? '・<button type="button" class="linkish" data-clear="1">清除篩選</button>' : "") + "</p></div>";

    if (all.length) {
      html += '<div class="sr-facets"><div class="chips" role="group" aria-label="依種類篩選">' +
        chip("全部", byKind[0] + byKind[1] + byKind[2], state.kind < 0, 'data-kind="-1"') +
        KINDS.map(function (k, i) { return byKind[i] ? chip(k, byKind[i], state.kind === i, 'data-kind="' + i + '"') : ""; }).join("") + "</div>";
      var cs = Object.keys(byCounty).map(Number).sort(function (a, b) { return byCounty[b] - byCounty[a] || a - b; });
      if (cs.length > 1 || state.county >= 0) {
        html += '<div class="chips" role="group" aria-label="依縣市篩選">' + chip("全部縣市", null, state.county < 0, 'data-county="-1"') +
          cs.map(function (c) { return chip(IDX.counties[c][1], byCounty[c], state.county === c, 'data-county="' + c + '"'); }).join("") + "</div>";
      }
      var tw = Object.keys(byTown).sort(function (a, b) { return byTown[b] - byTown[a] || (a < b ? -1 : 1); });
      if (state.county >= 0 && (tw.length > 1 || state.town)) {
        html += '<div class="chips sr-towns" role="group" aria-label="依鄉鎮市區篩選">' + chip("全部鄉鎮", null, !state.town, 'data-town=""') +
          tw.map(function (t) { return chip(t, byTown[t], state.town === t, 'data-town="' + esc(t) + '"'); }).join("") + "</div>";
      }
      html += "</div>";
    }

    if (!list.length) {
      html += '<div class="sr-empty"><p>換個說法試試：名稱的一部分、鄉鎮（例如「鹿港」）、類型（例如「燈塔」「宿舍」）或人物（例如「劉銘傳」）。多個關鍵字用空白分開，會找出同時符合的結果。</p>' +
        '<div class="chips">' + EXAMPLES.map(function (e) { return '<button type="button" class="chip" data-q="' + esc(e) + '">' + esc(e) + "</button>"; }).join("") + "</div></div>";
    } else {
      html += '<ol class="sr-list">' + list.slice(0, state.shown).map(function (x) {
        var it = x.it, place = it.county + (it.town ? it.town : "");
        var sub = x.introOnly ? '<span class="sr-intro"><b>介紹中提到</b>' + snippet(it, ts) + "</span>" : esc(it.sum);
        return '<li><a class="sr-item" href="' + esc(link(it)) + '">' + thumb(it) +
          '<span class="sr-body"><span class="sr-name">' + hl(it.name, ts) + "</span>" +
          '<span class="sr-meta"><span class="sr-cat ' + catClass(it) + '">' + esc(it.kind === 1 ? "無形・" + it.cat : it.cat) + "</span>" +
          "<span>" + hl(place, ts) + "</span>" + (it.year ? '<span class="sr-year">' + esc(it.kind ? it.year + " 年登錄" : it.year) + "</span>" : "") + "</span>" +
          '<span class="sr-sum">' + sub + "</span></span></a></li>";
      }).join("") + "</ol>";
      if (list.length > state.shown) html += '<p class="sr-more"><button type="button" class="btn" data-more="1">再顯示 ' + Math.min(PAGE, list.length - state.shown) + " 筆（還有 " + (list.length - state.shown) + " 筆）</button></p>";
    }
    var note = INTRO ? "已一併搜尋詳細介紹。" : introFailed ? "詳細介紹目前無法搜尋，只比對名稱、地點、類別與摘要。" : "正在搜尋詳細介紹…";
    html += '<p class="sr-note">' + note + " 點結果會開啟該縣市的文資地圖。</p>";
    box.innerHTML = html;
  }

  function setStatus(t) {
    var s = document.getElementById("searchStatus");
    if (s) s.textContent = t;
  }

  function syncUrl() {
    try {
      var u = new URL(location.href);
      if (state.q) u.searchParams.set("q", state.q); else u.searchParams.delete("q");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { /* 不支援時不更新網址 */ }
  }

  function run(resetFacets) {
    if (!IDX) return;
    if (resetFacets) { state.kind = -1; state.county = -1; state.town = ""; state.shown = PAGE; }
    render(search());
  }

  function go(q, scroll) {
    state.q = q.trim();
    input.value = state.q;
    syncUrl();
    loadIndex().then(function () {
      run(true);
      if (state.q) loadIntro();
      if (scroll && state.q) {
        /* 頂端選單在手機上會變成兩列，依實際高度留出空間，免得蓋住結果標題 */
        var bar = document.querySelector(".topbar"), off = (bar ? bar.getBoundingClientRect().height : 60) + 8;
        window.scrollTo({ top: box.getBoundingClientRect().top + window.pageYOffset - off, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    });
  }

  input.addEventListener("focus", loadIndex);
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { go(input.value, false); }, 220);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearTimeout(timer);
    input.blur();
    go(input.value, true);
  });
  document.querySelectorAll("[data-example]").forEach(function (b) {
    b.addEventListener("click", function () { go(b.getAttribute("data-example"), true); });
  });
  box.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-kind")) { state.kind = +b.getAttribute("data-kind"); state.shown = PAGE; }
    else if (b.hasAttribute("data-county")) { state.county = +b.getAttribute("data-county"); state.town = ""; state.shown = PAGE; }
    else if (b.hasAttribute("data-town")) { state.town = b.getAttribute("data-town"); state.shown = PAGE; }
    else if (b.hasAttribute("data-more")) { state.shown += PAGE; }
    else if (b.hasAttribute("data-clear")) { state.kind = -1; state.county = -1; state.town = ""; state.shown = PAGE; }
    else if (b.hasAttribute("data-q")) { go(b.getAttribute("data-q"), true); return; }
    else return;
    render(search());
  });

  /* 從網址帶入關鍵字（?q=），或從選單的「搜尋」連結進來（#search） */
  var q0 = "";
  try { q0 = new URL(location.href).searchParams.get("q") || ""; } catch (e) { q0 = ""; }
  if (q0) go(q0, true);
  if (location.hash === "#search") setTimeout(function () { input.focus(); }, 0);
  window.addEventListener("hashchange", function () { if (location.hash === "#search") input.focus(); });
})();
