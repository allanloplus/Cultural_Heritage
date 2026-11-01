/* 角色設定：導覽員 Allan Lo 與 AI 小助手 阿拉蕾（全站共用）
 * 圖檔由角色設定圖裁切去背：assets/characters/
 */
(function (root) {
  "use strict";

  var CHAR = {
    A: {
      name: "Allan Lo", short: "Allan", role: "文化導覽員",
      base: "smile",
      moods: ["smile", "laugh", "think", "surprised", "point", "scratch", "cry", "wink", "talk"],
      full: "allan-stand", wave: "allan-wave"
    },
    R: {
      name: "阿拉蕾", short: "阿拉蕾", role: "AI 小助手",
      base: "explain",
      moods: ["laugh", "think", "surprised", "confused", "explain", "sad", "thumb", "fight"],
      full: "arale-stand", wave: "arale-wave"
    }
  };

  var base = "assets/characters/";
  function setBase(b) { base = b; }
  function src(name) { return base + name + ".webp"; }
  function face(who, mood) {
    var c = CHAR[who] || CHAR.A;
    if (c.moods.indexOf(mood) < 0) mood = c.base;
    return src((who === "R" ? "arale-" : "allan-") + mood);
  }

  /* 依台詞內容挑表情 */
  function mood(who, text) {
    var t = String(text || "");
    if (who === "R") {
      if (/哇|天啊|真的假的|好厲害|原來|居然|竟然/.test(t)) return "surprised";
      if (/可惜|難過|好可憐|哎呀|糟糕|嗚/.test(t)) return "sad";
      if (/出發|衝|加油|任務|挑戰|走吧|開始囉/.test(t)) return "fight";
      if (/答對|沒錯|記住了|讚|收到|完成/.test(t)) return "thumb";
      if (/[？?]/.test(t)) return /怎麼會|為什麼|不是說|搞不懂|聽不懂/.test(t) ? "confused" : "think";
      if (/哈|嘿嘿|好好玩|好可愛|喔耶|好耶/.test(t)) return "laugh";
      return "explain";
    }
    if (/哈哈|笑死|冷笑話/.test(t)) return "laugh";
    if (/可惜|難過|悲劇|遇難|犧牲|拆除|燒毀|倒塌|震垮/.test(t)) return "cry";
    if (/搔頭|不好意思|說來慚愧|我也不知道|考倒/.test(t)) return "scratch";
    if (/沒想到吧|你知道嗎|驚人|嚇一跳|厲害吧/.test(t)) return "surprised";
    if (/答對|沒錯|聰明|很好|真棒|說得好|內行/.test(t)) return "wink";
    if (/重點|記住|一定要|注意|千萬|請看|找找看|任務/.test(t)) return "point";
    if (/[？?]/.test(t)) return "think";
    if (/！/.test(t) && t.length < 24) return "talk";
    return "smile";
  }

  var api = { CHAR: CHAR, face: face, mood: mood, src: src, setBase: setBase };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Characters = api;
})(this);
