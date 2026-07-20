#!/bin/bash
OUT=/tmp/debug-f5de91-probe.ndjson
: > "$OUT"
log() { echo "$1" >> "$OUT"; }
JS=$(curl -s https://app.sync2dine.io/index.html | tr '"' '\n' | grep 'assets/index-' | head -1)
log "{\"hypothesisId\":\"C\",\"message\":\"bundle\",\"data\":{\"js\":\"$JS\",\"taking\":$(curl -s https://app.sync2dine.io$JS | grep -c 'Taking you to Sync2Dine')},\"timestamp\":$(date +%s000)}"
W=$(curl -s https://app.sync2dine.io/sally-widget.js)
log "{\"hypothesisId\":\"A\",\"message\":\"widget_source\",\"data\":{\"http\":$(curl -s -o /dev/null -w '%{http_code}' https://app.sync2dine.io/sally-widget.js),\"hasDbg\":$(echo "$W" | grep -c '__dbg'),\"hasAbort\":$(echo "$W" | grep -c 'abort_no_script'),\"bytes\":${#W}},\"timestamp\":$(date +%s000)}"
HTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?t=$(date +%s)")
# Detect how LiteSpeed presents the script
TYPE=$(echo "$HTML" | grep -o 'script[^>]*sally-widget[^>]*>' | head -1)
log "{\"hypothesisId\":\"A\",\"message\":\"apex_script_tag\",\"data\":{\"tag\":$(echo "$TYPE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""'),\"sallyCount\":$(echo "$HTML" | grep -c sally-widget),\"litespeedJsType\":$(echo "$HTML" | grep -c 'type=\"litespeed/javascript\"'),\"legal\":$(echo "$HTML" | grep -c s2d-legal-footer)},\"timestamp\":$(date +%s000)}"
# Simulate currentScript null scenario: if script is data-no-optimize with async, currentScript should work when native
log "{\"hypothesisId\":\"D\",\"message\":\"brand\",\"data\":{\"icon\":$(curl -s -o /dev/null -w '%{http_code}' https://app.sync2dine.io/brand/brand-icon.svg)},\"timestamp\":$(date +%s000)}"
P=$(curl -sL "https://sync2dine.io/pricing/?t=$(date +%s)")
log "{\"hypothesisId\":\"E\",\"message\":\"pricing\",\"data\":{\"gbp139\":$(echo "$P" | grep -c '£139'),\"gbp208\":$(echo "$P" | grep -c '£208'),\"block\":$(echo "$P" | grep -c s2d-ai-pricing)},\"timestamp\":$(date +%s000)}"
cat "$OUT"
