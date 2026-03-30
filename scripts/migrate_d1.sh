#!/bin/bash
# Run D1 migrations
# Usage: ./scripts/migrate_d1.sh <DB_NAME> <CLOUDFLARE_ACCOUNT_ID> <CLOUDFLARE_API_TOKEN>

DB_NAME="${1:-cli-proxy-api-db}"
ACCOUNT_ID="${2:-$CLOUDFLARE_ACCOUNT_ID}"
TOKEN="${3:-$CLOUDFLARE_API_TOKEN}"

echo "Running D1 migrations..."
for f in scripts/migrate_*.sql; do
  echo "Applying: $f"
  npx wrangler d1 execute "$DB_NAME" --file="$f" --remote --yes 2>&1 || echo "Migration $f may have already been applied"
done
echo "Done!"
