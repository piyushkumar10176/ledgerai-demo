#!/usr/bin/env bash
# Build, run the production server, and expose it via a Cloudflare quick tunnel.
# Prints a public https URL. Keep this terminal open + your Mac awake to share.
set -e
cd "$(dirname "$0")"
export PATH="/Users/user/homebrew/bin:$PATH"

echo "==> Building…"
npm run build

echo "==> Starting production server on :3000…"
# kill anything already on :3000, then start fresh
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
npm run start > data/server.log 2>&1 &

# wait for the server to answer
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000/login; then break; fi
  sleep 1
done

echo "==> Opening Cloudflare tunnel (public URL appears below)…"
echo "    (Ctrl+C stops the tunnel; the URL changes each time you restart.)"
cloudflared tunnel --url http://localhost:3000 --no-autoupdate
