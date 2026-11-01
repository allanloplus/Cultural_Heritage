/* 雙人對話語音播放器（Allan 台灣男聲 × 阿拉蕾 台灣小女生）
 * 預錄語音：audio/<track>.mp3 + audio/cues.js（tools/gen_audio.py 產生）
 * 若內容改過但語音未重新產生（雜湊不符），自動改用瀏覽器內建語音。
 */
(function (root) {
  "use strict";
  var C = root.Characters;
  var doc = root.document;

  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(t) { t = Math.max(0, Math.round(t || 0)); return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }

  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h10v2H4z"/></svg>'
  };

  var audio = new Audio(); audio.preload = "none";
  var current = null;          // 正在播放的 player
  var segEnd = null;           // 單句播放的結束時間
  var hasTTS = "speechSynthesis" in root;
  var V = { A: null, R: null };

  function pickVoices() {
    if (!hasTTS) return;
    var all = root.speechSynthesis.getVoices() || [];
    var zh = all.filter(function (v) { return /zh[-_]TW|zh[-_]Hant|Taiwan|臺灣|台灣/i.test(v.lang + " " + v.name); });
    if (!zh.length) zh = all.filter(function (v) { return /^zh/i.test(v.lang); });
    var male = zh.filter(function (v) { return /YunJhe|Zhiwei|Male|男/i.test(v.name); })[0];
    var female = zh.filter(function (v) { return /HsiaoYu|HsiaoChen|Hanhan|Mei-?Jia|Female|女|Google/i.test(v.name); })[0];
    V.A = male || zh[0] || null;
    V.R = female || zh[1] || zh[0] || null;
  }
  if (hasTTS) { pickVoices(); root.speechSynthesis.onvoiceschanged = pickVoices; }

  function cuesFor(track, lines) {
    var c = (root.AUDIO_CUES || {})[track];
    if (!c || !lines || c.cues.length !== lines.length) return null;
    for (var k = 0; k < lines.length; k++) if (c.cues[k][2] !== fnv(lines[k].text)) return null;
    return c;
  }

  function stopAll() {
    if (current) current.stop();
    audio.pause();
    segEnd = null;
    if (hasTTS) root.speechSynthesis.cancel();
  }

  audio.addEventListener("timeupdate", function () {
    if (segEnd != null && audio.currentTime >= segEnd) { audio.pause(); segEnd = null; return; }
    if (current && current.mode === "audio") current.onTime(audio.currentTime);
  });
  audio.addEventListener("ended", function () { if (current) current.finish(); });
  audio.addEventListener("error", function () {
    if (current && current.mode === "audio" && hasTTS) {   // 檔案讀不到就改用瀏覽器語音
      var p = current, i = Math.max(0, p.i);
      p.mode = "tts"; p.updateBadge(); p.speakFrom(i);
    }
  });

  /* ---------------- Player ---------------- */
  function Player(el, opts) {
    this.el = el;
    this.opts = opts || {};
    this.track = opts.track;
    this.lines = opts.lines || [];
    this.base = opts.audioBase || "audio/";
    this.i = -1;
    this.playing = false;
    this.speed = parseFloat(localStorage.getItem("cy.speed") || "1") || 1;
    this.token = 0;
    var c = cuesFor(this.track, this.lines);
    this.cues = c ? c.cues : null;
    this.duration = c ? c.duration : this.lines.reduce(function (s, l) { return s + l.text.length * 0.23 + 0.4; }, 0);
    this.mode = c ? "audio" : (hasTTS ? "tts" : "silent");
    this.render();
  }

  Player.prototype.actor = function (who) {
    var c = C.CHAR[who];
    return '<figure class="dlg-actor is-' + who + '"><img src="' + C.face(who, c.base) + '" alt="' + esc(c.name) + '" width="120" height="140" loading="lazy">' +
      '<figcaption>' + esc(c.short) + '</figcaption></figure>';
  };

  Player.prototype.render = function () {
    var self = this, o = this.opts;
    var speeds = [0.8, 1, 1.25, 1.5];
    var h = '<div class="dlg' + (o.compact ? " dlg-compact" : "") + '">' +
      '<div class="dlg-stage">' + this.actor("A") +
      '<div class="dlg-bubble from-A" aria-live="polite"><span class="dlg-who">' + esc(o.title || "語音導覽") + '</span>' +
      '<p class="dlg-text">' + esc(o.hint || "按下播放，聽 Allan 和阿拉蕾說給你聽！") + '</p></div>' +
      this.actor("R") + '</div>' +
      '<div class="dlg-ctrl">' +
      '<button type="button" class="dlg-btn dlg-prev" aria-label="上一句">' + ICON.prev + '</button>' +
      '<button type="button" class="dlg-btn dlg-play" aria-label="播放">' + ICON.play + '</button>' +
      '<button type="button" class="dlg-btn dlg-next" aria-label="下一句">' + ICON.next + '</button>' +
      '<div class="dlg-bar" role="slider" tabindex="0" aria-label="播放進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="dlg-fill"></div></div>' +
      '<span class="dlg-time">0:00 / ' + fmt(this.duration) + '</span>' +
      '<select class="dlg-speed" aria-label="語速">' + speeds.map(function (s) { return '<option value="' + s + '"' + (s === self.speed ? " selected" : "") + '>' + s + '×</option>'; }).join("") + '</select>' +
      '<button type="button" class="dlg-btn dlg-list" aria-label="顯示逐字稿" aria-expanded="false">' + ICON.list + '</button>' +
      '</div>' +
      '<p class="dlg-badge"></p>' +
      '<ol class="dlg-script" hidden>' + this.lines.map(function (l, k) {
        return '<li data-i="' + k + '" class="who-' + l.who + '"><b>' + esc(C.CHAR[l.who].short) + '</b>' + esc(l.text) + '</li>';
      }).join("") + '</ol></div>';
    this.el.innerHTML = h;
    var q = function (s) { return self.el.querySelector(s); };
    this.$ = { a: q(".is-A img"), r: q(".is-R img"), fa: q(".is-A"), fr: q(".is-R"), bubble: q(".dlg-bubble"), who: q(".dlg-who"), text: q(".dlg-text"),
      play: q(".dlg-play"), bar: q(".dlg-bar"), fill: q(".dlg-fill"), time: q(".dlg-time"), script: q(".dlg-script"), list: q(".dlg-list"), badge: q(".dlg-badge"), speedSel: q(".dlg-speed") };
    this.updateBadge();
    this.$.play.onclick = function () { self.toggle(); };
    q(".dlg-prev").onclick = function () { self.go(Math.max(0, self.i - 1)); };
    q(".dlg-next").onclick = function () { self.go(Math.min(self.lines.length - 1, self.i + 1)); };
    this.$.speedSel.onchange = function () { self.speed = parseFloat(this.value); localStorage.setItem("cy.speed", self.speed); audio.playbackRate = self.speed; if (self.mode === "tts" && self.playing) self.speakFrom(Math.max(0, self.i)); };
    this.$.list.onclick = function () { var hid = !self.$.script.hidden; self.$.script.hidden = hid; this.setAttribute("aria-expanded", String(!hid)); };
    this.$.script.onclick = function (e) { var li = e.target.closest("li"); if (li) self.go(+li.dataset.i); };
    var seek = function (e) {
      var r = self.$.bar.getBoundingClientRect(); var x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      if (self.cues) { var t = x * self.duration, k = 0; for (var j = 0; j < self.cues.length; j++) if (self.cues[j][0] <= t) k = j; self.go(k); }
      else self.go(Math.min(self.lines.length - 1, Math.floor(x * self.lines.length)));
    };
    this.$.bar.addEventListener("click", seek);
    this.$.bar.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") self.go(Math.min(self.lines.length - 1, self.i + 1));
      if (e.key === "ArrowLeft") self.go(Math.max(0, self.i - 1));
    });
  };

  Player.prototype.updateBadge = function () {
    this.$.badge.textContent = this.mode === "audio" ? "預錄語音：Allan（台灣男聲）・阿拉蕾（台灣小女生）" :
      this.mode === "tts" ? "使用瀏覽器內建語音（音色依裝置而異）" : "此瀏覽器不支援語音，請閱讀字幕";
  };

  Player.prototype.show = function (k) {
    if (k < 0 || k >= this.lines.length) return;
    this.i = k;
    var l = this.lines[k], who = l.who, other = who === "A" ? "R" : "A";
    var m = C.mood(who, l.text);
    (who === "A" ? this.$.a : this.$.r).src = C.face(who, m);
    (who === "A" ? this.$.fa : this.$.fr).classList.add("is-speaking");
    (other === "A" ? this.$.fa : this.$.fr).classList.remove("is-speaking");
    this.$.bubble.className = "dlg-bubble from-" + who;
    this.$.who.textContent = C.CHAR[who].short;
    this.$.text.textContent = l.text;
    var lis = this.$.script.children;
    for (var j = 0; j < lis.length; j++) lis[j].classList.toggle("is-on", j === k);
    if (!this.cues) this.progress((k + 1) / this.lines.length * this.duration);
    if (this.opts.onLine) this.opts.onLine(k, l);
  };

  Player.prototype.progress = function (t) {
    var p = Math.min(1, t / (this.duration || 1));
    this.$.fill.style.width = (p * 100).toFixed(1) + "%";
    this.$.bar.setAttribute("aria-valuenow", Math.round(p * 100));
    this.$.time.textContent = fmt(t) + " / " + fmt(this.duration);
  };

  Player.prototype.onTime = function (t) {
    this.progress(t);
    var k = 0;
    for (var j = 0; j < this.cues.length; j++) if (this.cues[j][0] <= t + 0.05) k = j;
    if (k !== this.i) this.show(k);
  };

  Player.prototype.setPlaying = function (on) {
    this.playing = on;
    this.$.play.innerHTML = on ? ICON.pause : ICON.play;
    this.$.play.setAttribute("aria-label", on ? "暫停" : "播放");
    this.el.classList.toggle("is-playing", on);
  };

  Player.prototype.toggle = function () { if (this.playing) this.stop(); else this.play(); };

  Player.prototype.play = function (from) {
    if (current && current !== this) current.stop();
    current = this; segEnd = null;
    var k = from != null ? from : (this.i < 0 || this.i >= this.lines.length - 1 && !this.playing ? (this.i >= this.lines.length - 1 ? 0 : Math.max(0, this.i)) : this.i);
    this.setPlaying(true);
    if (this.mode === "audio") {
      var url = this.base + this.track + ".mp3";
      if (audio.dataset.src !== url) { audio.src = url; audio.dataset.src = url; }
      audio.playbackRate = this.speed;
      var self = this;
      var start = function () { try { audio.currentTime = self.cues[k][0]; } catch (e) {} self.show(k); var p = audio.play(); if (p && p.catch) p.catch(function () { self.setPlaying(false); }); };
      if (audio.readyState >= 1) start(); else { audio.addEventListener("loadedmetadata", function f() { audio.removeEventListener("loadedmetadata", f); if (current === self && self.playing) start(); }); audio.load(); }
    } else if (this.mode === "tts") this.speakFrom(k);
    else this.silentFrom(k);
  };

  Player.prototype.speakFrom = function (k) {
    var self = this, tok = ++this.token;
    root.speechSynthesis.cancel();
    if (k >= this.lines.length) { this.finish(); return; }
    this.show(k);
    var l = this.lines[k];
    var u = new SpeechSynthesisUtterance(l.text);
    u.lang = "zh-TW";
    var v = V[l.who]; if (v) u.voice = v;
    u.rate = this.speed * (l.who === "R" ? 1.05 : 0.98);
    u.pitch = l.who === "R" ? 1.6 : (V.A && V.A === V.R ? 0.75 : 0.95);
    u.onend = function () { if (tok === self.token && self.playing && current === self) self.speakFrom(k + 1); };
    u.onerror = u.onend;
    setTimeout(function () { if (tok === self.token) root.speechSynthesis.speak(u); }, 60);
  };

  Player.prototype.silentFrom = function (k) {
    var self = this, tok = ++this.token;
    if (k >= this.lines.length) { this.finish(); return; }
    this.show(k);
    setTimeout(function () { if (tok === self.token && self.playing) self.silentFrom(k + 1); }, (this.lines[k].text.length * 230 + 500) / this.speed);
  };

  Player.prototype.go = function (k) {
    if (this.playing) this.play(k);
    else { this.show(k); if (this.cues) this.progress(this.cues[k][0]); }
  };

  Player.prototype.stop = function () {
    this.token++;
    if (current === this) {
      if (this.mode === "audio") audio.pause();
      if (hasTTS) root.speechSynthesis.cancel();
    }
    this.setPlaying(false);
  };

  Player.prototype.finish = function () {
    this.setPlaying(false);
    this.progress(this.duration);
    if (this.opts.onEnd) this.opts.onEnd();
  };

  Player.prototype.destroy = function () { this.stop(); if (current === this) current = null; this.el.innerHTML = ""; };

  /* 單句播放（遊戲回饋用）：優先使用預錄片段，否則瀏覽器語音 */
  function say(track, lines, k, base) {
    stopAll();
    var c = cuesFor(track, lines);
    var l = lines[k];
    if (c) {
      var url = (base || "audio/") + track + ".mp3";
      if (audio.dataset.src !== url) { audio.src = url; audio.dataset.src = url; }
      current = null;
      var go = function () { try { audio.currentTime = c.cues[k][0]; } catch (e) {} segEnd = c.cues[k][1]; audio.playbackRate = 1; audio.play().catch(function () {}); };
      if (audio.readyState >= 1) go(); else { audio.addEventListener("loadedmetadata", function f() { audio.removeEventListener("loadedmetadata", f); go(); }); audio.load(); }
    } else if (hasTTS && l) {
      var u = new SpeechSynthesisUtterance(l.text); u.lang = "zh-TW";
      var v = V[l.who]; if (v) u.voice = v;
      u.pitch = l.who === "R" ? 1.6 : 0.95;
      root.speechSynthesis.speak(u);
    }
  }

  root.Voice = { Player: Player, stopAll: stopAll, say: say, fnv: fnv, esc: esc, fmt: fmt };
})(this);
