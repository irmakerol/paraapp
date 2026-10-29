#!/usr/bin/env bash
# Checks that the GitHub secrets for the test server and the iOS build are set and look right.
# Prints only names and OK/problem, never a value (the repository's Actions logs are public).
set -uo pipefail
problems=0
check() { # name, regex, hint
  local value="${!1:-}"
  if [ -z "$value" ]; then
    echo "::warning title=$1::missing"
    problems=$((problems + 1))
  elif ! grep -Eq -- "$2" <<<"$value"; then
    echo "::warning title=$1::set, but doesn't look right: $3"
    problems=$((problems + 1))
  else
    echo "::notice title=$1::OK"
  fi
}
trimmed() { [ "${!1:-}" = "$(printf '%s' "${!1:-}" | xargs 2>/dev/null)" ] || echo "::warning title=$1::has spaces or line breaks at the start or end"; }

check APPLE_TEAM_ID '^[A-Z0-9]{10}$' 'should be 10 capital letters/digits'
check ASC_KEY_ID '^[A-Z0-9]{10}$' 'should be 10 capital letters/digits'
check ASC_ISSUER_ID '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 'should look like 69a6de7f-...-...'
check ASC_KEY_P8 'BEGIN PRIVATE KEY' 'should include the -----BEGIN PRIVATE KEY----- line'
grep -q 'END PRIVATE KEY' <<<"${ASC_KEY_P8:-}" || echo "::warning title=ASC_KEY_P8::the -----END PRIVATE KEY----- line is missing"
check SUPABASE_PROJECT_REF '^[a-z]{20}$' 'should be the 20 lowercase letters of the project ID'
check SUPABASE_ACCESS_TOKEN '^sbp_' 'should start with sbp_'
check SUPABASE_DB_PASSWORD '.{6,}' 'looks too short'
check VERCEL_TOKEN '.{20,}' 'looks too short'
check GOOGLE_IOS_CLIENT_ID '^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$' 'should end in .apps.googleusercontent.com'
check GOOGLE_WEB_CLIENT_ID '^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$' 'should end in .apps.googleusercontent.com'
check GOOGLE_WEB_CLIENT_SECRET '^GOCSPX-' 'should start with GOCSPX-'
check ADMIN_EMAIL '^[^@ ]+@[^@ ]+\.[^@ ]+$' 'should be an email address'
for n in APPLE_TEAM_ID ASC_KEY_ID ASC_ISSUER_ID SUPABASE_PROJECT_REF SUPABASE_ACCESS_TOKEN VERCEL_TOKEN \
  GOOGLE_IOS_CLIENT_ID GOOGLE_WEB_CLIENT_ID GOOGLE_WEB_CLIENT_SECRET ADMIN_EMAIL; do trimmed "$n"; done
if [ -n "${GOOGLE_IOS_CLIENT_ID:-}" ] && [ "${GOOGLE_IOS_CLIENT_ID:-}" = "${GOOGLE_WEB_CLIENT_ID:-}" ]; then
  echo "::warning title=GOOGLE_IOS_CLIENT_ID::is the same as GOOGLE_WEB_CLIENT_ID; they must be two different clients"
fi
echo "::notice title=Secrets check::$problems problem(s)"
