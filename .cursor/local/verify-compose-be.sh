#!/bin/bash
ssh vps 'grep -n "deepseekApiKey\|bodyDeepSeekApiKey\|provider: body" /var/www/vhosts/sync2dine.io/sync2dine-backend/server/ai/compose-email-handler.ts'
ssh vps 'sed -n "9,25p" /var/www/vhosts/sync2dine.io/sync2dine-backend/server/ai/compose-email-handler.ts'
ssh vps 'sed -n "105,120p" /var/www/vhosts/sync2dine.io/sync2dine-backend/server/ai/compose-email-handler.ts'
