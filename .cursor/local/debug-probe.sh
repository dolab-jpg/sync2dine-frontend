#!/bin/bash
# Runtime probe — writes NDJSON-ish lines to stdout for agent log
probe() {
  local hid="$1" msg="$2" data="$3"
  echo "{\"hypothesisId\":\"$hid\",\"message\":\"$msg\",\"data\":$data,\"timestamp\":$(date +%s000)}"
}
JS=$(curl -s https://app.sync2dine.io/index.html | tr '"' '\n' | grep 'assets/index-' | head -1)
probe C "app_bundle_path" "{\"js\":\"$JS\"}"
TAKING=$(curl -s "https://app.sync2dine.io$JS" | grep -c 'Taking you to Sync2Dine' || echo 0)
LOGIN_NAV=$(curl -s "https://app.sync2dine.io$JS" | grep -c 'to:\"/login\"' || echo 0)
probe C "app_bundle_markers" "{\"takingYou\":$TAKING,\"loginNavGuess\":$LOGIN_NAV}"
WCODE=$(curl -s -o /dev/null -w '%{http_code}' https://app.sync2dine.io/sally-widget.js)
ICODE=$(curl -s -o /dev/null -w '%{http_code}' https://app.sync2dine.io/brand/brand-icon.svg)
HAS_GUARD=$(curl -s https://app.sync2dine.io/sally-widget.js | grep -c '__sallyWidgetLoaded' || echo 0)
HAS_CURRENT=$(curl -s https://app.sync2dine.io/sally-widget.js | grep -c 'currentScript' || echo 0)
probe A "widget_asset" "{\"http\":$WCODE,\"hasLoadedGuard\":$HAS_GUARD,\"hasCurrentScript\":$HAS_CURRENT}"
probe D "brand_icon" "{\"http\":$ICODE}"
HTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?dbg=$(date +%s)")
SW=$(echo "$HTML" | grep -c sally-widget || echo 0)
TB=$(echo "$HTML" | grep -c 'data-mode="topbar"' || echo 0)
LF=$(echo "$HTML" | grep -c s2d-legal-footer || echo 0)
AT=$(echo "$HTML" | grep -c Atmosphere || echo 0)
P139=$(echo "$HTML" | grep -c '£139' || echo 0)
probe A "apex_html" "{\"bytes\":${#HTML},\"sallyWidget\":$SW,\"topbarAttr\":$TB,\"legalFooter\":$LF,\"atmosphere\":$AT,\"gbp139\":$P139}"
PHTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/pricing/?dbg=$(date +%s)")
probe E "pricing_html" "{\"bytes\":${#PHTML},\"gbp139\":$(echo "$PHTML" | grep -c '£139' || echo 0),\"gbp208\":$(echo "$PHTML" | grep -c '£208' || echo 0),\"s2dPricing\":$(echo "$PHTML" | grep -c s2d-ai-pricing || echo 0)}"
for p in terms fair-use-and-fares cookies cancellation-refunds; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://sync2dine.io/$p/")
  probe E "legal_$p" "{\"http\":$code}"
done
