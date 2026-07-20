#!/bin/bash
set -e
echo '=== HOME ==='
curl -sL https://sync2dine.io/ | grep -oE 'sally-widget|data-mode=.topbar.|£139|£208|£323|020 3745 3233|Ask Sync2Dine|Atmosphere|info@sync2dine.io|all1house|£399|£799|brand-icon' | sort | uniq -c
echo '=== PRICING ==='
curl -sL https://sync2dine.io/pricing/ | grep -oE '£139|£208|£323|£399|£799|Atmosphere|Judie|020 3745 3233|sally-widget|topbar|s2d-ai-pricing' | sort | uniq -c
echo '=== LEGAL ==='
for p in terms fair-use-and-fares cookies cancellation-refunds privacy-policy; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://sync2dine.io/$p/")
  echo "$p $code"
done
echo '=== FOOTER LINKS IN HTML ==='
curl -sL https://sync2dine.io/ | grep -oE '/terms/|/fair-use-and-fares/|/cookies/|/cancellation-refunds/|/privacy-policy/' | sort | uniq -c
echo '=== APP ROOT ==='
curl -sL https://app.sync2dine.io/ | grep -oiE 'Sign in to Sync2Dine|Ask Sync2Dine|Marketing|Taking you' | head -10
echo '=== APP PRICING REDIRECT BODY ==='
curl -sL https://app.sync2dine.io/pricing | grep -oiE 'Taking you to Sync2Dine|Atmosphere|£139|Sign in' | head -10
echo '=== WIDGET ==='
curl -s https://app.sync2dine.io/sally-widget.js | grep -c topbar
curl -s -o /dev/null -w 'icon %{http_code}\n' https://app.sync2dine.io/brand/brand-icon.svg
