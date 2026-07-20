#!/bin/bash
set -e
echo "=== port 3011 ==="
ss -tlnp | grep 3011 || echo "3011 not listening"
curl -s http://127.0.0.1:3011/health; echo
printf '%s' '{"sessionId":"t1","text":"Tell me about Judie phone AI","page":"/"}' > /tmp/sally-test.json
curl -s -w "\nHTTP:%{http_code}\n" -X POST http://127.0.0.1:3011/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d @/tmp/sally-test.json | head -c 600
echo
echo "=== public ==="
curl -s -w "\nHTTP:%{http_code}\n" -X POST https://app.sync2dine.io/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d @/tmp/sally-test.json | head -c 600
echo
