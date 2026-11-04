"""下載 Wikimedia Commons 自由授權照片到 <city>/img/（網頁仍標示作者、授權與原始頁面連結）
用法：python3 tools/fetch_images.py [city]   # 預設 chiayi-city，例如 chiayi-county
產生：<id>-<n>.webp（寬 960）、<id>-<n>-s.webp（寬 320），並在 images.json 寫入 local / small 欄位。
第二網站的縣市會寫到 Cultural_Heritage2 的 clone（見 tools/sites.py）。
"""
import io, json, os, ssl, sys, time, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import sites as SITES  # noqa: E402  兩個網站的對應
CITY = sys.argv[1] if len(sys.argv) > 1 else "chiayi-city"
CITY_DIR = SITES.city_dir(CITY)
DATA = os.path.join(CITY_DIR, "data", "images.json")
OUT = os.path.join(CITY_DIR, "img")
UA = "AllanLoCultureSite/1.0 (https://github.com/allanloplus/Cultural_Heritage; educational, attribution shown)"
ctx = ssl.create_default_context(cafile=os.environ.get("TTS_CA_BUNDLE")) if os.environ.get("TTS_CA_BUNDLE") else None
if ctx is not None:  # Python 3.13 嚴格 X.509 會拒絕代理憑證；只關嚴格模式，仍完整驗證
    ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT


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


def save(d):
    # 每張都寫回：被限流或中斷時，已下載的照片不會白做
    tmp = DATA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DATA)


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
            save(d)
            print("ok", sid, n, flush=True)
            time.sleep(1.5)
    save(d)


if __name__ == "__main__":
    main()
