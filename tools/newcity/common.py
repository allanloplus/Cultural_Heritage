"""新增縣市工具的共用設定（下載、路徑、縣市比對）。

網路禮儀（請務必遵守）：
- 所有對外請求都用下面的 UA，裡面只放專案網址；不要放任何人的 Email 或帳號。
- Nominatim 每次查詢至少間隔 5 秒；維基百科、Wikimedia Commons 會限流（HTTP 429），請節制、失敗就等。
"""
import json, os, ssl, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = "AllanLoCultureSite/1.0 (https://github.com/allanloplus/Cultural_Heritage)"
BASE = os.environ.get("NEWCITY_DIR", "/tmp/newcity")          # 工作目錄（不進版控）
CACHE = os.path.join(BASE, "cache")                             # 共用下載快取
_CA = os.environ.get("TTS_CA_BUNDLE") or ("/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else None)
CTX = ssl.create_default_context(cafile=_CA) if _CA else None   # 經過代理時使用其 CA
if CTX is not None:  # Python 3.13 預設嚴格 X.509，代理憑證缺 SKI 會被拒；只關嚴格模式，仍完整驗證憑證
    CTX.verify_flags &= ~ssl.VERIFY_X509_STRICT


def work_dir(slug):
    d = os.path.join(BASE, slug)
    os.makedirs(d, exist_ok=True)
    return d


def get(url, timeout=180, tries=4, wait=8):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, context=CTX, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # 429、逾時等：等一下再試
            print("  retry %d %s %s" % (i + 1, url[:90], e), file=sys.stderr)
            time.sleep(wait * (i + 1))
    raise RuntimeError("download failed: " + url)


def variants(name):
    """臺南市 / 台南市 兩種寫法都要比對。"""
    return {name, name.replace("臺", "台"), name.replace("台", "臺")}


def in_city(rec, name):
    v = variants(name)
    return any(isinstance(a, dict) and (a.get("cityName") or "") in v for a in (rec.get("addresses") or []))


def city_addr(rec, name):
    v = variants(name)
    return next((a for a in (rec.get("addresses") or []) if isinstance(a, dict) and (a.get("cityName") or "") in v), {})


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump(obj, path, indent=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
    os.replace(tmp, path)
