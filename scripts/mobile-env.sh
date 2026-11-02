#!/usr/bin/env bash
# Writes the phone app's build settings (public values only) to $GITHUB_ENV, read from the
# hosted Supabase and Vercel projects that scripts/cloud-setup.sh created.
set -euo pipefail
VERCEL_PROJECT="${VERCEL_PROJECT:-fly-anatolia}"
out="${GITHUB_ENV:-/dev/stdout}"

if [ -n "${SUPABASE_PROJECT_REF:-}" ] && [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  keys=$(curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys?reveal=true")
  anon=$(jq -r '[.[] | select(.type == "publishable")][0].api_key // ([.[] | select(.name == "anon")][0].api_key)' <<<"$keys")
  echo "EXPO_PUBLIC_SUPABASE_URL=https://$SUPABASE_PROJECT_REF.supabase.co" >> "$out"
  echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=$anon" >> "$out"
else
  echo "::warning::Supabase secrets missing: the app is built without a server (recording only)."
fi

if [ -n "${VERCEL_TOKEN:-}" ]; then
  site=$(curl -fsS -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects/$VERCEL_PROJECT/domains" |
    jq -r '[.domains[].name] | (map(select(endswith(".vercel.app") | not)) + map(select(endswith(".vercel.app"))))[0] // empty') || site=''
  [ -n "$site" ] && echo "EXPO_PUBLIC_WEB_URL=https://$site" >> "$out"
fi

echo "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=${GOOGLE_IOS_CLIENT_ID:-}" >> "$out"
echo "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=${GOOGLE_WEB_CLIENT_ID:-}" >> "$out"
