#!/usr/bin/env bash
# Sets up (or updates) the hosted test server: Supabase Cloud (database + sign-in) and Vercel
# (website). Run by .github/workflows/cloud.yml with the secrets listed in
# docs/MOBILE.md. Safe to run again: it only creates what is missing.
#
# The repository is public, so its Actions logs are too: never print a key. Every value that
# isn't a GitHub secret already is masked with ::add-mask:: before it is used.
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?}" "${SUPABASE_ACCESS_TOKEN:?}" "${SUPABASE_DB_PASSWORD:?}" "${VERCEL_TOKEN:?}"
VERCEL_PROJECT="${VERCEL_PROJECT:-fly-anatolia}"
BUNDLE_ID="com.flyanatolia.paraapp"
SB_API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF"
SUPABASE_URL="https://$SUPABASE_PROJECT_REF.supabase.co"

sb() { curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'content-type: application/json' "$@"; }
vc() { curl -fsS -H "Authorization: Bearer $VERCEL_TOKEN" -H 'content-type: application/json' "$@"; }
mask() { echo "::add-mask::$1"; }

# Runs SQL through the Management API (GitHub runners have no IPv6 for the direct DB host).
sql() { sb -X POST "$SB_API/database/query" --data "$(jq -n --arg q "$1" '{query: $q}')"; }

echo "== Database: migrations"
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
npx supabase db push --password "$SUPABASE_DB_PASSWORD" --include-all

echo "== Database: legal texts and example sites (only on a fresh database)"
count=$(sql 'select count(*)::int as n from public.legal_documents' | jq -r '.[0].n')
if [ "$count" = "0" ]; then
  sql "$(cat supabase/seed.sql)" > /dev/null
  sql "$(cat supabase/seeds/demo_sites.sql)" > /dev/null
  echo "seeded"
else
  echo "already there"
fi

echo "== Supabase keys"
keys=$(sb "$SB_API/api-keys?reveal=true")
ANON_KEY=$(jq -r '[.[] | select(.type == "publishable")][0].api_key // ([.[] | select(.name == "anon")][0].api_key)' <<<"$keys")
SERVICE_KEY=$(jq -r '[.[] | select(.type == "secret")][0].api_key // ([.[] | select(.name == "service_role")][0].api_key)' <<<"$keys")
mask "$SERVICE_KEY"
[ -n "$ANON_KEY" ] && [ "$ANON_KEY" != null ] && [ -n "$SERVICE_KEY" ] && [ "$SERVICE_KEY" != null ]

echo "== Vercel project"
if ! project=$(vc "https://api.vercel.com/v9/projects/$VERCEL_PROJECT" 2>/dev/null); then
  project=$(vc -X POST https://api.vercel.com/v11/projects --data "$(jq -n --arg n "$VERCEL_PROJECT" \
    '{name: $n, framework: "nextjs", rootDirectory: "apps/web"}')")
  echo "created $VERCEL_PROJECT"
fi
PROJECT_ID=$(jq -r .id <<<"$project")
TEAM_ID=$(jq -r '.accountId' <<<"$project")

existing=$(vc "https://api.vercel.com/v10/projects/$PROJECT_ID/env" | jq -r '.envs[].key')
has_env() { grep -qx "$1" <<<"$existing"; }
set_env() { # name value [force]
  if has_env "$1"; then
    [ "${3:-}" = force ] || return 0
    id=$(vc "https://api.vercel.com/v10/projects/$PROJECT_ID/env" | jq -r --arg k "$1" '.envs[] | select(.key == $k) | .id')
    vc -X DELETE "https://api.vercel.com/v9/projects/$PROJECT_ID/env/$id" > /dev/null
  fi
  vc -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env" --data "$(jq -n --arg k "$1" --arg v "$2" \
    '{key: $k, value: $v, type: "encrypted", target: ["production", "preview"]}')" > /dev/null
}

echo "== Vercel settings"
set_env NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL" force
set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$ANON_KEY" force
set_env SUPABASE_SERVICE_ROLE_KEY "$SERVICE_KEY" force
set_env NEXT_PUBLIC_AUTH_GOOGLE_ENABLED "$([ -n "${GOOGLE_WEB_CLIENT_ID:-}" ] && echo true || echo false)" force
# Generated once and kept: changing these would make encrypted data unreadable.
for name in LICENCE_ENCRYPTION_KEY INCIDENT_ENCRYPTION_KEY; do
  has_env "$name" || { v=$(openssl rand -base64 32); mask "$v"; set_env "$name" "$v"; }
done
has_env CRON_SECRET || { v=$(openssl rand -hex 32); mask "$v"; set_env CRON_SECRET "$v"; }
if ! has_env VAPID_PRIVATE_KEY; then
  vapid=$(npx -y web-push@3.6.7 generate-vapid-keys --json)
  priv=$(jq -r .privateKey <<<"$vapid"); mask "$priv"
  set_env VAPID_PRIVATE_KEY "$priv"
  set_env NEXT_PUBLIC_VAPID_PUBLIC_KEY "$(jq -r .publicKey <<<"$vapid")"
fi

deploy() {
  npx -y vercel@latest pull --yes --environment=production --token "$VERCEL_TOKEN" > /dev/null
  npx -y vercel@latest build --prod --token "$VERCEL_TOKEN"
  npx -y vercel@latest deploy --prebuilt --prod --token "$VERCEL_TOKEN"
}

echo "== Website deploy"
mkdir -p .vercel
jq -n --arg p "$PROJECT_ID" --arg o "$TEAM_ID" '{projectId: $p, orgId: $o}' > .vercel/project.json
SITE=$(vc "https://api.vercel.com/v9/projects/$PROJECT_ID/domains" | jq -r '[.domains[].name] | (map(select(endswith(".vercel.app") | not)) + map(select(endswith(".vercel.app"))))[0] // empty')
if [ -n "$SITE" ]; then set_env NEXT_PUBLIC_SITE_URL "https://$SITE" force; fi
deploy
if [ -z "$SITE" ]; then
  # First deploy: the project's domain exists only now. Set the site URL and build again.
  SITE=$(vc "https://api.vercel.com/v9/projects/$PROJECT_ID/domains" | jq -r '[.domains[].name][0]')
  set_env NEXT_PUBLIC_SITE_URL "https://$SITE" force
  deploy
fi
WEB_URL="https://$SITE"

echo "== Sign-in settings"
auth=$(jq -n --arg site "$WEB_URL" --arg bundle "$BUNDLE_ID" \
  --arg gweb "${GOOGLE_WEB_CLIENT_ID:-}" --arg gios "${GOOGLE_IOS_CLIENT_ID:-}" --arg gsecret "${GOOGLE_WEB_CLIENT_SECRET:-}" '
  {
    site_url: $site,
    uri_allow_list: ($site + "/**"),
    external_apple_enabled: true,
    external_apple_client_id: $bundle
  } + (if $gweb != "" then {
    external_google_enabled: true,
    external_google_client_id: ([$gweb, $gios] | map(select(. != "")) | join(",")),
    external_google_secret: $gsecret,
    external_google_skip_nonce_check: true
  } else {} end)')
sb -X PATCH "$SB_API/config/auth" --data "$auth" > /dev/null

{
  echo "### Test server is up"
  echo ""
  echo "- Website: $WEB_URL"
  echo "- Supabase project: \`$SUPABASE_PROJECT_REF\`"
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
