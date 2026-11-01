"""下載 Wikimedia Commons 自由授權照片到 chiayi-city/img/（網頁仍標示作者、授權與原始頁面連結）
用法：python3 tools/fetch_images.py
產生：<id>-<n>.webp（寬 960）、<id>-<n>-s.webp（寬 320），並在 images.json 寫入 local / small 欄位。
"""
import io, json, os, ssl, sys, time, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "chiayi-city", "data", "images.json")
OUT = os.path.join(ROOT, "chiayi-city", "img")
UA = "AllanLoCultureSite/1.0 (https://github.com/allanloplus/Cultural_Heritage; educational, attribution shown)"
ctx = ssl.create_default_context(cafile=os.environ.get("TTS_CA_BUNDLE")) if os.environ.get("TTS_CA_BUNDLE") else None


def get(url):
    for i in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
                data = r.read()
                if r.headers.get_content_type().startswith("image/"):
                    return data
                raise RuntimeError("not image: " + r.headers.get_content_type())
        except Exception as e:
            print("  retry", i, e, file=sys.stderr)
            time.sleep(5 * (i + 1))
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    d = json.load(open(DATA, encoding="utf-8"))
    for sid, ims in d.items():
        for n, im in enumerate(ims):
            big = "%s-%d.webp" % (sid, n)
            small = "%s-%d-s.webp" % (sid, n)
            if os.path.exists(os.path.join(OUT, big)) and os.path.exists(os.path.join(OUT, small)):
                im["local"], im["small"] = "img/" + big, "img/" + small
                continue
            raw = get(im["thumb"])
            if not raw:
                print("FAILED", sid, im["file"])
                continue
            pic = Image.open(io.BytesIO(raw)).convert("RGB")
            b = pic.copy(); b.thumbnail((960, 960)); b.save(os.path.join(OUT, big), "WEBP", quality=76, method=6)
            s = pic.copy(); s.thumbnail((320, 320)); s.save(os.path.join(OUT, small), "WEBP", quality=72, method=6)
            im["local"], im["small"] = "img/" + big, "img/" + small
            print("ok", sid, n, flush=True)
            time.sleep(1.5)
    json.dump(d, open(DATA, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
