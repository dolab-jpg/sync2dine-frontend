from pathlib import Path

fe = Path(r"c:\Users\dolab\Downloads\sync2dine-frontend\server\vapi-routes.ts").read_text(encoding="utf-8")
be_path = Path(r"c:\Users\dolab\Downloads\sync2dine-backend\server\vapi-routes.ts")
be = be_path.read_text(encoding="utf-8")

start = fe.find("function extractMonitorUrls")
end = fe.find("/** Prefer TradePro call id")
if start < 0 or end < 0:
    raise SystemExit(f"frontend markers missing start={start} end={end}")
block = fe[start:end]

old_start = be.find("function ensureCallFromVapi")
old_end = be.find("/** Prefer TradePro call id")
if old_start < 0 or old_end < 0:
    raise SystemExit(f"backend markers missing start={old_start} end={old_end}")

be2 = be[:old_start] + block + be[old_end:]
be_path.write_text(be2, encoding="utf-8")
print("backend ensureCallFromVapi synced", len(block))
