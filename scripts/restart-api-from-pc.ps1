# Run on the Windows PC where `ssh vps` works (uses C:\Users\dolab\.ssh\id_ed25519).
ssh vps "bash /var/www/vhosts/sync2dine.io/sync2dine-backend/scripts/restart-sync2dine-api.sh"
Write-Host "--- health ---"
curl.exe -sS https://app.sync2dine.io/health
Write-Host ""
curl.exe -sS https://app.sync2dine.io/api/vapi/health
Write-Host ""
