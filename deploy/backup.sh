#!/bin/sh
# One encrypted database dump. Restore: gpg -d FILE | pg_restore -d "$TARGET_DB_URL" --clean --no-owner
set -eu
stamp=$(date -u +%Y-%m-%dT%H%M)
file="/backups/paraapp-$stamp.dump.gpg"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --schema=public --schema=private --schema=auth --schema=storage \
  | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "$file"
find /backups -name 'paraapp-*.dump.gpg' -mtime +14 -delete
echo "backup written: $file"
