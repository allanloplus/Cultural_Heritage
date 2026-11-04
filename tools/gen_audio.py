"""產生雙人對話語音（Microsoft Edge 神經網路語音，台灣口音）— 沿用課程網站的語音模式
用法：python3 tools/build_data.py && python3 tools/gen_audio.py
需要：pip install edge-tts；ffmpeg
Allan：zh-TW-YunJheNeural（台灣男聲）
阿拉蕾：zh-TW-HsiaoYuNeural 提高音調（台灣小女生）
只會重新合成內容有變動的句子（快取於 tools/.tts-cache/，不進版控）。
"""
import asyncio, hashlib, json, os, random, ssl, subprocess, sys, wave

import edge_tts
import edge_tts.communicate as C

if os.environ.get("TTS_CA_BUNDLE"):  # 經過企業代理時使用其 CA
    C._SSL_CTX = ssl.create_default_context(cafile=os.environ["TTS_CA_BUNDLE"])
    C._SSL_CTX.verify_flags &= ~ssl.VERIFY_X509_STRICT  # Python 3.13 嚴格 X.509 會拒絕代理憑證；仍完整驗證

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".tts-cache")
VOICE = {
    "A": dict(voice="zh-TW-YunJheNeural", pitch="+0Hz", rate="+0%"),  # 語音服務自 2026/11 起拒絕負值音調，改 +0Hz（差 2Hz，聽不出差別）
    "R": dict(voice="zh-TW-HsiaoYuNeural", pitch="+55Hz", rate="+6%"),
}
RATE = 24000
GAP = 0.35      # 每句之間的停頓（秒）
BITRATE = "32k"


def key(who, text):
    v = VOICE[who]
    return hashlib.sha1(json.dumps([v, text], ensure_ascii=False).encode()).hexdigest()[:16]


async def synth(who, text, sem):
    path = os.path.join(CACHE, key(who, text) + ".wav")
    if os.path.exists(path):
        return path
    v = VOICE[who]
    async with sem:
        for attempt in range(60):  # 語音服務偶爾回傳空白（限流時約一半請求隨機失敗），失敗就短暫等待後重試
            try:
                mp3 = path[:-4] + ".mp3"
                await edge_tts.Communicate(text, v["voice"], pitch=v["pitch"], rate=v["rate"],
                                           proxy=os.environ.get("HTTPS_PROXY")).save(mp3)
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-ar", str(RATE),
                                "-sample_fmt", "s16", path], check=True)
                os.remove(mp3)
                return path
            except Exception as e:  # 網路偶發錯誤重試
                print("retry", attempt, text[:20], e, file=sys.stderr)
                await asyncio.sleep(2 + random.random() * 3 + (10 if attempt > 15 else 0))  # 指數退避在限流時太慢（2026/11 澎湖：每分鐘 2 句 → 20 句）
    raise RuntimeError("TTS failed: " + text[:40])


def fnv(text):
    """與 assets/js/voice.js 相同的 FNV-1a（UTF-16 碼元），用來確認語音檔與內容一致。"""
    h = 0x811C9DC5
    b = text.encode("utf-16-le")
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "x")


def pack(out_dir, name, lines, paths):
    """把多句 wav 串成一個 mp3，並記錄每句起訖時間。"""
    gap = b"\x00\x00" * int(RATE * GAP)
    frames, cues, t = [], [], 0.0
    for it, p in zip(lines, paths):
        with wave.open(p) as w:
            data = w.readframes(w.getnframes())
        dur = len(data) / 2 / RATE
        cues.append([round(t, 3), round(t + dur, 3), fnv(it["text"])])
        frames += [data, gap]
        t += dur + GAP
    wav = os.path.join(CACHE, name + ".all.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b"".join(frames))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", BITRATE,
                    "-ac", "1", "-ar", str(RATE), os.path.join(out_dir, name + ".mp3")], check=True)
    os.remove(wav)
    return cues, round(t, 1)


async def main():
    os.makedirs(CACHE, exist_ok=True)
    script = json.load(open(os.path.join(ROOT, "tools", "script.json"), encoding="utf-8"))
    args = set(sys.argv[1:])
    dirs = {g["dir"] for g in script["groups"]}
    # 可指定只處理某些縣市資料夾，例如 pingtung-county（多個 session 同時建置不同縣市時用）
    only_dirs = {d for d in dirs if d in args or d.split("/")[0] in args}
    only = {a for a in args if a not in dirs and a + "/audio" not in dirs}  # 可指定只產生某些 track
    sem = asyncio.Semaphore(int(os.environ.get("TTS_CONCURRENCY", "3")))  # 服務封鎖頻繁時可設 1
    for g in script["groups"]:
        if only_dirs and g["dir"] not in only_dirs:
            continue
        out_dir = os.path.join(ROOT, g["dir"])
        os.makedirs(out_dir, exist_ok=True)
        cues_path = os.path.join(out_dir, "cues.js")
        index = {}
        if os.path.exists(cues_path):
            txt = open(cues_path, encoding="utf-8").read()
            start = txt.index("|| {}, ") + len("|| {}, ")
            index = json.loads(txt[start:txt.rindex(")")])
        keep = {t["id"] for t in g["tracks"]}
        index = {k: v for k, v in index.items() if k in keep}
        def save():
            # 每完成一段就寫回 cues.js：合成到一半中斷時，已完成的語音也能正常播放
            tmp = cues_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write("/* 由 tools/gen_audio.py 產生，請勿手動編修 */\nwindow.AUDIO_CUES = Object.assign(window.AUDIO_CUES || {}, ")
                json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
                f.write(");\n")
            os.replace(tmp, cues_path)
        for tr in g["tracks"]:
            name, lines = tr["id"], tr["lines"]
            if only and name not in only:
                continue
            old = index.get(name)
            mp3 = os.path.join(out_dir, name + ".mp3")
            if old and os.path.exists(mp3) and [c[2] for c in old["cues"]] == [fnv(l["text"]) for l in lines]:
                continue  # 內容沒變
            paths = await asyncio.gather(*[synth(l["who"], l["text"], sem) for l in lines])
            cues, total = pack(out_dir, name, lines, paths)
            index[name] = {"duration": total, "cues": cues}
            save()
            print(g["dir"], name, len(lines), "句", total, "秒", flush=True)
        save()
        # 清掉已不存在的 mp3
        for fn in os.listdir(out_dir):
            if fn.endswith(".mp3") and fn[:-4] not in keep:
                os.remove(os.path.join(out_dir, fn))


asyncio.run(main())
