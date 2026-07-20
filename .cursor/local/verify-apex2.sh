#!/bin/bash
echo 'SALLY SCRIPT TAGS'
curl -sL https://sync2dine.io/ | tr '"' '\n' | grep -i sally | head -20
echo 'ALL1HOUSE'
curl -sL https://sync2dine.io/ | grep -oi 'all1house[^ <"]*' | head
echo 'APP INDEX'
curl -sL https://app.sync2dine.io/index.html
echo 'BUNDLE REDIRECTS'
JS=$(curl -sL https://app.sync2dine.io/index.html | tr '"' '\n' | grep 'assets/index-' | head -1)
echo "js=$JS"
curl -s "https://app.sync2dine.io$JS" | grep -o 'https://sync2dine.io[^"]*' | sort -u | head -20
curl -s "https://app.sync2dine.io$JS" | grep -c 'Taking you to Sync2Dine'
curl -s "https://app.sync2dine.io$JS" | grep -c 'Sign in to Sync2Dine'
