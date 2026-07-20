#!/bin/bash
set -eu
echo '=== sally-web-routes head ==='
head -40 /var/www/vhosts/sync2dine.io/sync2dine-backend/server/sally-web-routes.ts
echo '=== importers of sally-sales ==='
grep -rn "sally-sales" /var/www/vhosts/sync2dine.io/sync2dine-backend/server --include='*.ts' | head -40
echo '=== index sally ==='
grep -n Sally /var/www/vhosts/sync2dine.io/sync2dine-backend/server/index.ts | head
