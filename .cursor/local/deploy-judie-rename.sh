#!/bin/bash
set -euo pipefail
ROOT=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$ROOT"
# Pull if git remote works; else files already scp'd
git fetch origin master 2>/dev/null || true
git checkout master 2>/dev/null || true
git pull --ff-only origin master 2>/dev/null || true
bash /tmp/restart-s2d-api-push.sh
# Spot-check Judie
grep -n "You are Judie" server/phone-brain.ts | head -3 || true
grep -n "SilencePersona" server/vapi-assistant.ts | head -3 || true
grep -RIn --include='*.ts' 'Lizzie' server | grep -vE 'vps\.ts|local-full|node_modules' | head -20 || echo 'no Lizzie in live server ts'
