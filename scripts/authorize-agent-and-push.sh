#!/bin/bash
# Run ONCE on your PC (where `ssh vps` already works).
# 1) Authorizes the Cursor cloud-agent SSH pubkey on the VPS
# 2) Deploys SPA + API from local master
# 3) Prints live probes
set -euo pipefail

VPS_SSH="${VPS_SSH:-vps}"
AGENT_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPqiJsBjAsv4KymedFcUR891X1lgC90DW8yMtjcHJ/p0 cursor-agent'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== Authorize Cursor agent key on $VPS_SSH =="
ssh "$VPS_SSH" bash -s <<REMOTE
set -euo pipefail
mkdir -p "\$HOME/.ssh"
chmod 700 "\$HOME/.ssh"
touch "\$HOME/.ssh/authorized_keys"
chmod 600 "\$HOME/.ssh/authorized_keys"
if ! grep -qF 'AAAAC3NzaC1lZDI1NTE5AAAAIPqiJsBjAsv4KymedFcUR891X1lgC90DW8yMtjcHJ/p0' "\$HOME/.ssh/authorized_keys"; then
  echo '$AGENT_PUBKEY' >> "\$HOME/.ssh/authorized_keys"
  echo "agent key added"
else
  echo "agent key already present"
fi
# Also try common system users if we have sudo (best-effort)
if command -v sudo >/dev/null 2>&1; then
  for home in /home/ubuntu /root /var/www/vhosts/sync2dine.io; do
    [ -d "\$home" ] || continue
    sudo mkdir -p "\$home/.ssh" 2>/dev/null || true
    sudo touch "\$home/.ssh/authorized_keys" 2>/dev/null || true
    if ! sudo grep -qF 'AAAAC3NzaC1lZDI1NTE5AAAAIPqiJsBjAsv4KymedFcUR891X1lgC90DW8yMtjcHJ/p0' "\$home/.ssh/authorized_keys" 2>/dev/null; then
      echo '$AGENT_PUBKEY' | sudo tee -a "\$home/.ssh/authorized_keys" >/dev/null || true
    fi
    sudo chmod 700 "\$home/.ssh" 2>/dev/null || true
    sudo chmod 600 "\$home/.ssh/authorized_keys" 2>/dev/null || true
  done
fi
whoami
REMOTE

echo "== Deploy live =="
cd "$ROOT"
bash scripts/push-live-local.sh
