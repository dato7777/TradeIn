#!/usr/bin/env bash
# Create admin user in local Supabase after `supabase start`
# Usage: ./scripts/create_admin_user.sh your@email.com yourpassword

set -euo pipefail

EMAIL="${1:-tomerbardao@tradein.local}"
PASSWORD="${2:-changeme123}"

if ! command -v supabase &>/dev/null; then
  echo "Install Supabase CLI: brew install supabase/tap/supabase"
  exit 1
fi

echo "Creating user: $EMAIL"
curl -s -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: $(grep SUPABASE_ANON_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | head -c 200
echo ""
echo "Add $EMAIL to ADMIN_EMAILS in .env if not already present."
