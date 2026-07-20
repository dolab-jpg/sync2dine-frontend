#!/usr/bin/env python3
import re
import urllib.request

urls = [
    "https://sync2dine.io/",
    "https://sync2dine.io/pricing/",
    "https://sync2dine.io/about-us/",
    "https://sync2dine.io/our-services/",
    "https://sync2dine.io/ai-phone-ordering/",
    "https://sync2dine.io/faqs/",
    "https://sync2dine.io/who-we-serve/restaurants-cafes/",
    "https://sync2dine.io/fair-use-and-fares/",
    "https://sync2dine.io/music-channel/",
    "https://sync2dine.io/how-it-works/",
    "https://sync2dine.io/inquiry/",
    "https://sync2dine.io/contact/",
    "https://sync2dine.io/who-we-serve/",
    "https://app.sync2dine.io/",
    "https://app.sync2dine.io/pricing",
    "https://app.sync2dine.io/sally-widget.js",
]
pat = re.compile(
    r".{0,70}(?:£|&pound;|&#163;|/wk|/week|per week|setup|Professional Setup).{0,70}",
    re.I,
)
bad = re.compile(
    r"£\s*300|£\s*399|£\s*799|£\s*249|£\s*60\b|£\s*99\b|Billed monthly|Per kiosk|"
    r"One-Time Professional Setup:\s*£?300|Then Just £99|just £60|Lizzie",
    re.I,
)
good = re.compile(r"£139|£208|£323|£232|£347|£539|020 3745 3233")

for u in urls:
    try:
        req = urllib.request.Request(
            u, headers={"User-Agent": "S2D-PriceAudit/1.0", "Cache-Control": "no-cache", "Pragma": "no-cache"}
        )
        html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    except Exception as e:
        print(f"\n===== {u} ERROR {e}")
        continue
    print(f"\n===== {u} len={len(html)}")
    bads = sorted(set(m.group(0) for m in bad.finditer(html)))
    goods = sorted(set(good.findall(html)))
    print("  GOOD:", ", ".join(goods) if goods else "(none)")
    print("  BAD:", " | ".join(bads[:8]) if bads else "(none)")
    seen = set()
    n = 0
    for m in pat.finditer(html):
        t = re.sub(r"\s+", " ", m.group(0)).strip()
        if t in seen:
            continue
        seen.add(t)
        n += 1
        if n <= 12:
            print("  ·", t[:180])
