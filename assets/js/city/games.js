/* 知識遊戲：問答王、時光排序、猜猜我是誰、翻翻樂、擲骰大冒險（對戰阿拉蕾）＋文資護照（各縣市共用） */
(function () {
  "use strict";
  var A = window.App, CY = A.CY, V = window.Voice, C = window.Characters, esc = V.esc, $ = A.$, $$ = A.$$;
  var R = CY.extra.reactions;
  function react(i) { V.say("reactions", R, i, "audio/"); }
  var DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  var GAMES = [
    { id: "quiz", ico: "🏆", name: "文資問答王", desc: "10 題隨機四選一，答對 7 題以上就能蓋章。題目來自每個景點與時光地圖。", run: quiz },
    { id: "timeline", ico: "⏳", name: "時光排序", desc: "抽 5 張文資卡，依興建年代由古到今點選排好。考驗你的歷史感！", run: timeline },
    { id: "guess", ico: "🕵️", name: "猜猜我是誰", desc: "線索一條一條打開，越早猜中分數越高。5 回合拿 9 分以上蓋章。", run: guess },
    { id: "memory", ico: "🃏", name: "文資翻翻樂", desc: "翻開照片和名字，把同一個景點配成一對。", run: memory },
    { id: "board", ico: "🎲", name: (A.CFG.board && A.CFG.board.name) || "擲骰大冒險", desc: "你和 Allan 一隊，對戰阿拉蕾！擲骰繞城，答對題目佔領景點，佔得多的贏。", run: board }
  ];

  var stage, cleanup = null;
  function open(g) {
    if (cleanup) { cleanup(); cleanup = null; }
    V.stopAll();
    stage.hidden = false;
    stage.innerHTML = '<div class="gs-head"><h3>' + g.ico + ' ' + esc(g.name) + '</h3><button class="btn btn-sm" type="button" id="gsClose">離開遊戲</button></div><div id="gsBody"></div>';
    $("#gsClose").onclick = function () { if (cleanup) { cleanup(); cleanup = null; } stage.hidden = true; V.stopAll(); };
    g.run($("#gsBody"));
    stage.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function host(who, mood, text) {
    return '<div class="gs-host"><img src="' + C.face(who, mood) + '" alt="' + esc(C.CHAR[who].short) + '"><p>' + esc(text) + '</p></div>';
  }

  function allQuestions() {
    var qs = [];
    A.sites.forEach(function (s) { s.quiz.forEach(function (q) { qs.push({ q: q, src: s.short }); }); });
    (CY.eras || []).forEach(function (e) { (e.quiz || []).forEach(function (q) { qs.push({ q: q, src: e.name }); }); });
    ((CY.ich && CY.ich.items) || []).forEach(function (i) { (i.quiz || []).forEach(function (q) { qs.push({ q: q, src: i.name }); }); });
    return qs;
  }

  /* ---------- 1. 問答王 ---------- */
  function quiz(el) {
    var qs = A.shuffle(allQuestions()).slice(0, 10), i = 0, score = 0;
    function next() {
      if (i >= qs.length) {
        var pass = score >= 7;
        el.innerHTML = host(pass ? "A" : "R", pass ? "laugh" : "sad", pass ? "太厲害了！你答對 " + score + " 題，是" + (A.CFG.quizTitle || "文資通") + "！" : "答對 " + score + " 題，再挑戰一次一定可以！") +
          '<p class="score">得分：' + score + ' / ' + qs.length + '</p><button class="btn btn-primary" type="button" id="qAgain">再玩一次</button>';
        if (pass) A.stamp("game-quiz");
        react(pass ? 5 : 3);
        $("#qAgain").onclick = function () { quiz(el); };
        return;
      }
      var item = qs[i];
      el.innerHTML = host(i % 2 ? "R" : "A", i % 2 ? "think" : "point", "第 " + (i + 1) + " 題，出自「" + item.src + "」") +
        '<p class="score">目前得分 ' + score + '</p><div id="qBox"></div><p style="margin-top:10px"><button class="btn" type="button" id="qNext" hidden>下一題</button></p>';
      A.renderQuiz($("#qBox"), item.q, function (ok) { if (ok) score++; var b = $("#qNext"); b.hidden = false; b.focus(); });
      $("#qNext").onclick = function () { i++; next(); };
    }
    next();
  }

  /* ---------- 2. 時光排序 ---------- */
  function timeline(el) {
    var pool = A.shuffle(A.sites.filter(function (s) { return !s.yearUnknown; })), pick = [], years = {};
    for (var k = 0; k < pool.length && pick.length < 5; k++) { if (!years[pool[k].year]) { years[pool[k].year] = 1; pick.push(pool[k]); } }
    var placed = [];
    function card(s, showYear) {
      var im = s.images[0];
      return (im ? '<img src="' + esc(A.pic(im, true)) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'../assets/img-fallback.svg\'">' : '<div style="aspect-ratio:4/3;border-radius:8px;display:grid;place-items:center;background:' + A.CAT[s.category].hex + ';color:#fff;font-size:1.4rem">' + A.CAT[s.category].k + '</div>') +
        '<div>' + esc(s.short) + '</div>' + (showYear ? '<div class="yr">' + esc(A.yearLabel(s)) + '</div>' : "");
    }
    function draw(check) {
      el.innerHTML = host("R", check ? "surprised" : "think", check ? "來對答案囉！綠色是放對的位置。" : "從最古老的開始，依序點選卡片排進時間軸！") +
        '<div class="tl-slots">' + [0, 1, 2, 3, 4].map(function (i) {
          var s = placed[i];
          if (!s) return '<div class="tl-slot">' + (i === 0 ? "最古老" : i === 4 ? "最新" : "第 " + (i + 1)) + '</div>';
          var ok = check && sorted[i].id === s.id;
          return '<div class="tl-slot" style="' + (check ? "border-color:" + (ok ? "var(--good)" : "var(--bad)") + ";border-style:solid" : "") + '"><div class="tl-card">' + card(s, check) + '</div></div>';
        }).join("") + '</div>' +
        '<div class="tl-hand">' + pick.map(function (s) { return placed.indexOf(s) >= 0 ? "<div></div>" : '<button class="tl-card" type="button" data-id="' + s.id + '">' + card(s, false) + '</button>'; }).join("") + '</div>' +
        '<p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="tlReset">重排</button>' + (check ? '<button class="btn btn-primary" type="button" id="tlNew">再抽 5 張</button>' : "") + '</p>' +
        (check ? '<p class="hint">正確順序：' + sorted.map(function (s) { return esc(s.short) + "（" + A.yearLabel(s) + "）"; }).join(" → ") + '</p>' : "");
      $$(".tl-hand .tl-card", el).forEach(function (b) { b.onclick = function () { placed.push(A.byId[b.dataset.id]); if (placed.length === 5) finish(); else draw(false); }; });
      $("#tlReset").onclick = function () { placed = []; draw(false); };
      var nb = $("#tlNew"); if (nb) nb.onclick = function () { timeline(el); };
    }
    var sorted = pick.slice().sort(function (a, b) { return a.year - b.year; });
    function finish() {
      draw(true);
      var ok = placed.every(function (s, i) { return sorted[i].id === s.id; });
      if (ok) { A.stamp("game-timeline"); react(8); } else react(2);
    }
    draw(false);
  }

  /* ---------- 3. 猜猜我是誰 ---------- */
  function guess(el) {
    var rounds = A.shuffle(A.sites).slice(0, 5), r = 0, total = 0;
    function play() {
      if (r >= rounds.length) {
        var pass = total >= 9;
        el.innerHTML = host(pass ? "A" : "R", pass ? "wink" : "sad", pass ? "總分 " + total + "，名偵探就是你！" : "總分 " + total + "，多聽幾段導覽再來挑戰！") +
          '<button class="btn btn-primary" type="button" id="gAgain">再玩一次</button>';
        if (pass) A.stamp("game-guess");
        react(pass ? 5 : 3);
        $("#gAgain").onclick = function () { guess(el); };
        return;
      }
      var s = rounds[r], shown = 1, done = false;
      var opts = A.shuffle([s].concat(A.shuffle(A.sites.filter(function (x) { return x.id !== s.id; })).slice(0, 3)));
      function draw(msg) {
        el.innerHTML = host("R", done ? "laugh" : "think", msg || "第 " + (r + 1) + " 回合：猜猜我是誰？目前可得 " + (4 - shown) + " 分") +
          '<p class="score">總分 ' + total + '</p><ol class="clue-list">' + s.clues.map(function (c, i) { return '<li class="' + (i < shown ? "" : "locked") + '">' + (i < shown ? esc(c) : "線索 " + (i + 1) + "：尚未打開") + '</li>'; }).join("") + '</ol>' +
          '<div class="quiz-opts">' + opts.map(function (o) { return '<button type="button" data-id="' + o.id + '">' + esc(o.name) + '</button>'; }).join("") + '</div>' +
          '<p style="margin-top:10px;display:flex;gap:8px">' + (!done && shown < s.clues.length ? '<button class="btn" type="button" id="gMore">再給一條線索</button>' : "") + (done ? '<button class="btn btn-primary" type="button" id="gNext">下一回合</button> <a class="btn" href="#map/' + s.id + '">看介紹</a>' : "") + '</p>';
        $$(".quiz-opts button", el).forEach(function (b) {
          b.onclick = function () {
            if (done) return;
            if (b.dataset.id === s.id) { done = true; var pts = 4 - shown; total += pts; react(0); draw("答對了！是「" + s.name + "」，得 " + pts + " 分！"); markOpts(b.dataset.id); }
            else { b.classList.add("no"); b.disabled = true; if (shown < s.clues.length) { shown++; draw("不是喔！再看一條線索。"); } else { done = true; react(2); draw("答案是「" + s.name + "」，這回合 0 分。"); markOpts(null); } }
          };
        });
        var m = $("#gMore"); if (m) m.onclick = function () { shown++; draw(); };
        var n = $("#gNext"); if (n) n.onclick = function () { r++; play(); };
      }
      function markOpts() { $$(".quiz-opts button", el).forEach(function (b) { if (b.dataset.id === s.id) b.classList.add("ok"); }); }
      draw();
    }
    play();
  }

  /* ---------- 4. 翻翻樂 ---------- */
  function memory(el) {
    var n = window.innerWidth < 520 ? 6 : 8;
    var picks = A.shuffle(A.sites.filter(function (s) { return s.images.length; })).slice(0, n);
    var cards = A.shuffle(picks.map(function (s) { return { id: s.id, t: "img", s: s }; }).concat(picks.map(function (s) { return { id: s.id, t: "name", s: s }; })));
    var open = [], moves = 0, matched = 0, lock = false, t0 = Date.now();
    el.innerHTML = host("A", "smile", "把照片和名字配成一對！翻兩張，一樣的景點就配對成功。") + '<p class="score" id="mStat">步數 0</p><div class="mem-grid">' +
      cards.map(function (c, i) {
        return '<button class="mem" type="button" data-i="' + i + '" aria-label="翻牌"><div class="mem-in"><div class="mem-f">文</div><div class="mem-b">' +
          (c.t === "img" ? '<img src="' + esc(A.pic(c.s.images[0], true)) + '" alt="' + esc(c.s.short) + '" loading="lazy" onerror="this.onerror=null;this.src=\'../assets/img-fallback.svg\'">' : esc(c.s.short)) + '</div></div></button>';
      }).join("") + '</div>';
    $$(".mem", el).forEach(function (b) {
      b.onclick = function () {
        if (lock || b.classList.contains("flip") || b.classList.contains("done")) return;
        b.classList.add("flip"); open.push(b);
        if (open.length === 2) {
          moves++; lock = true;
          var a = cards[+open[0].dataset.i], c = cards[+open[1].dataset.i];
          if (a.id === c.id) {
            open.forEach(function (x) { x.classList.add("done"); x.setAttribute("aria-label", a.s.short); }); open = []; lock = false; matched++;
            if (matched === picks.length) {
              var sec = Math.round((Date.now() - t0) / 1000);
              $("#mStat").textContent = "完成！" + moves + " 步・" + sec + " 秒";
              A.stamp("game-memory"); react(10);
              var again = document.createElement("button"); again.className = "btn btn-primary"; again.textContent = "再玩一次"; again.style.marginTop = "12px";
              again.onclick = function () { memory(el); }; el.appendChild(again);
            }
          } else setTimeout(function () { open.forEach(function (x) { x.classList.remove("flip"); }); open = []; lock = false; }, 900);
          if (matched < picks.length) $("#mStat").textContent = "步數 " + moves + "・配對 " + matched + " / " + picks.length;
        }
      };
    });
  }

  /* ---------- 5. 桃城擲骰大冒險 ---------- */
  function board(el) {
    var POS = []; // 6x5 外圈，順時針
    for (var c = 1; c <= 6; c++) POS.push([1, c]);
    for (var r = 2; r <= 4; r++) POS.push([r, 6]);
    for (c = 6; c >= 1; c--) POS.push([5, c]);
    for (r = 4; r >= 2; r--) POS.push([r, 1]);
    var SPECIAL = {
      0: { n: (A.CFG.board && A.CFG.board.start) || "出發", t: "start" },
      4: { n: "阿里山小火車", t: "train", d: "搭上小火車，前進 3 格！" },
      9: { n: "雞肉飯補給站", t: "rice", d: "吃飽了有力氣，再擲一次！" },
      13: { n: "時光機", t: "time", d: "答對一題時光題，直接得 1 分！" },
      15: { n: "YouBike 加速", t: "bike", d: "騎上 YouBike，前進 2 格！" }
    };
    var siteCells = A.shuffle(A.sites.filter(function (s) { return s.quiz.length; })).slice(0, POS.length - Object.keys(SPECIAL).length);
    var cells = POS.map(function (p, i) { return SPECIAL[i] ? Object.assign({ i: i, sp: true }, SPECIAL[i]) : { i: i, s: siteCells.shift(), owner: null }; });
    var pos = { P: 0, R: 0 }, score = { P: 0, R: 0 }, turn = "P", round = 1, MAX = 8, busy = false, log = [], alive = true;
    var eraQs = []; (CY.eras || []).forEach(function (e) { (e.quiz || []).forEach(function (q) { eraQs.push(q); }); });
    if (!eraQs.length) eraQs = A.sites[0].quiz;

    function addLog(t) { log.unshift(t); log = log.slice(0, 30); }
    function drawBoard() {
      el.innerHTML = '<div class="board-wrap"><div class="board">' + cells.map(function (c) {
        var p = POS[c.i], cls = "cell" + (c.sp ? (c.t === "start" ? " start" : " special") : "") + (c.owner ? " owned-" + c.owner : "");
        return '<div class="' + cls + '" style="grid-row:' + p[0] + ';grid-column:' + p[1] + '"><span class="nm">' + esc(c.sp ? c.n : c.s.short) + '</span>' +
          (c.owner ? '<span>' + (c.owner === "P" ? "你的" : "阿拉蕾的") + '</span>' : "") +
          (pos.P === c.i ? '<img class="token P" src="' + C.face("A", "smile") + '" alt="你和 Allan">' : "") + (pos.R === c.i ? '<img class="token R" src="' + C.face("R", "laugh") + '" alt="阿拉蕾">' : "") + '</div>';
      }).join("") + '<div class="board-center" id="bCenter"></div></div>' +
        '<div class="bg-side"><p class="score">回合 ' + Math.min(round, MAX) + ' / ' + MAX + '</p><p><b style="color:var(--peach)">你＋Allan：' + score.P + '</b>　<b style="color:var(--teal)">阿拉蕾：' + score.R + '</b></p>' +
        '<div class="bg-log">' + (log.length ? log.map(function (l) { return "<div>" + esc(l) + "</div>"; }).join("") : "輪到你先擲骰！") + '</div>' +
        '<p class="hint">規則：擲骰前進，停在景點答對題目就能佔領（得 1 分）；停在對手地盤什麼都不會發生。黃色格子有特殊事件。' + MAX + ' 回合後分數高的贏。</p></div></div>';
    }
    function center(html) { var c = el.querySelector("#bCenter"); if (c) c.innerHTML = html; }
    function idle() {
      if (!alive) return;
      drawBoard();
      if (round > MAX) return end();
      if (turn === "P") {
        center('<div><div class="dice" id="dice">🎲</div><p>輪到你了！</p><button class="btn btn-primary" type="button" id="roll">擲骰子</button></div>');
        $("#roll").onclick = function () { if (!busy) roll("P"); };
      } else {
        center('<div><div class="dice" id="dice">🎲</div><p>阿拉蕾準備擲骰…</p></div>');
        setTimeout(function () { if (alive) { react(4); roll("R"); } }, 900);
      }
    }
    function roll(who) {
      if (!alive) return;
      busy = true;
      var n = 1 + Math.floor(Math.random() * 6), d = $("#dice");
      d.textContent = DICE[n - 1]; d.classList.add("roll");
      setTimeout(function () { move(who, n); }, 650);
    }
    function move(who, n) {
      if (!alive) return;
      pos[who] = (pos[who] + n) % POS.length;
      addLog((who === "P" ? "你" : "阿拉蕾") + " 擲出 " + n + "，來到「" + (cells[pos[who]].sp ? cells[pos[who]].n : cells[pos[who]].s.short) + "」");
      drawBoard();
      land(who);
    }
    function nextTurn() {
      if (!alive) return;
      busy = false;
      if (turn === "R") round++;
      turn = turn === "P" ? "R" : "P";
      setTimeout(idle, 500);
    }
    function land(who) {
      if (!alive) return;
      var c = cells[pos[who]];
      if (c.sp) {
        center('<div><p><b>' + esc(c.n) + '</b></p><p>' + esc(c.d || "從這裡再出發！") + '</p></div>');
        if (c.t === "train") return setTimeout(function () { move(who, 3); }, 1200);
        if (c.t === "bike") return setTimeout(function () { move(who, 2); }, 1200);
        if (c.t === "rice") return setTimeout(function () { busy = false; if (who === "P") idle(); else roll("R"); }, 1200);
        if (c.t === "time") {
          var q = eraQs[Math.floor(Math.random() * eraQs.length)];
          if (who === "R") { var ok = Math.random() < .65; if (ok) score.R++; addLog("阿拉蕾挑戰時光題" + (ok ? "，答對得 1 分" : "，答錯了")); return setTimeout(nextTurn, 1300); }
          return ask(q, function (ok) { if (ok) score.P++; addLog("你挑戰時光題" + (ok ? "，答對得 1 分" : "，答錯了")); nextTurn(); });
        }
        return setTimeout(nextTurn, 1000);
      }
      if (c.owner) { center('<div><p>這裡是' + (c.owner === who ? "自己" : "對手") + '的地盤，休息一下。</p></div>'); return setTimeout(nextTurn, 1200); }
      var q2 = c.s.quiz[Math.floor(Math.random() * c.s.quiz.length)];
      if (who === "R") {
        var ok2 = Math.random() < .7;
        center('<div>' + host("R", ok2 ? "thumb" : "sad", ok2 ? "我知道！佔領「" + c.s.short + "」！" : "嗚，「" + c.s.short + "」這題我答錯了。") + '</div>');
        if (ok2) { c.owner = "R"; score.R++; }
        addLog("阿拉蕾" + (ok2 ? "佔領了「" + c.s.short + "」" : "沒答對「" + c.s.short + "」的題目"));
        return setTimeout(nextTurn, 1600);
      }
      ask(q2, function (ok) { if (ok) { c.owner = "P"; score.P++; } addLog(ok ? "你佔領了「" + c.s.short + "」！" : "你沒答對「" + c.s.short + "」的題目"); nextTurn(); }, c.s);
    }
    function ask(q, cb, s) {
      center('<div style="width:100%;text-align:left">' + (s ? '<p style="text-align:center"><b>' + esc(s.short) + '</b></p>' : "") + '<div id="bq"></div><p style="text-align:center;margin-top:8px"><button class="btn btn-primary" type="button" id="bqOk" hidden>繼續</button></p></div>');
      var res = null;
      A.renderQuiz($("#bq"), q, function (ok) { res = ok; $("#bqOk").hidden = false; });
      $("#bqOk").onclick = function () { if (alive) cb(res); };
    }
    function end() {
      if (!alive) return;
      alive = false;
      var win = score.P > score.R ? "P" : score.P < score.R ? "R" : "T";
      center('<div>' + host(win === "R" ? "R" : "A", win === "R" ? "laugh" : win === "P" ? "laugh" : "wink", win === "P" ? "你和 Allan 贏了！" + score.P + " 比 " + score.R : win === "R" ? "阿拉蕾贏了！" + score.R + " 比 " + score.P : "平手！" + score.P + " 比 " + score.R) +
        '<button class="btn btn-primary" type="button" id="bAgain">再玩一局</button></div>');
      if (win === "P") { A.stamp("game-board"); react(5); } else react(win === "R" ? 6 : 7);
      $("#bAgain").onclick = function () { board(el); };
    }
    idle();
    cleanup = function () { alive = false; };
  }

  /* ---------- view ---------- */
  var inited = false;
  A.register("games", { show: function () {
    if (inited) return; inited = true;
    stage = $("#gameStage");
    new V.Player($("#gameIntro"), { track: "game-intro", lines: CY.extra.gameIntro, title: "遊戲說明", audioBase: "audio/", compact: true });
    var p = A.passport();
    $("#gameGrid").innerHTML = GAMES.map(function (g) {
      return '<button class="game-card" type="button" data-g="' + g.id + '"><span class="ico" aria-hidden="true">' + g.ico + '</span><h3>' + esc(g.name) + '</h3><p>' + esc(g.desc) + '</p>' +
        ((p.stamps || {})["game-" + g.id] ? '<span class="stamp-mini">✔ 已蓋章</span>' : "") + '</button>';
    }).join("");
    $$(".game-card").forEach(function (b) { b.onclick = function () { open(GAMES.filter(function (g) { return g.id === b.dataset.g; })[0]); }; });
    A.renderPassport();
  } });
})();
