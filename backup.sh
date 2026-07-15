#!/usr/bin/env bash
# Back up the Turso database to backups/ledgerai-<timestamp>.sql
# Restore into a NEW db:  turso db create ledgerai-restore && turso db shell ledgerai-restore < backups/<file>.sql
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.turso:$PATH"
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M)
turso db shell ledgerai ".dump" > "backups/ledgerai-$STAMP.sql"
echo "Backup written: backups/ledgerai-$STAMP.sql"
