#!/usr/bin/env bash
# Drives the token lifecycle from the command line so every server-side case in
# README.md can be observed without a browser.
#
#   ./scripts/token-demo.sh                    # against http://localhost:3000
#   ./scripts/token-demo.sh https://your-app.vercel.app
#
# Needs: curl, python3 (for JSON pretty-printing).
set -euo pipefail
BASE="${1:-http://localhost:3000}"
GRACE="${REFRESH_GRACE_SECONDS:-15}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
show() { python3 -c 'import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))' 2>/dev/null || cat; }
cookie() { awk -v n="$1" '$6==n {print $7}' "$JAR"; }
post() { curl -s -b "$JAR" -c "$JAR" -X POST -H 'content-type: application/json' "$@"; }
get()  { curl -s -b "$JAR" -c "$JAR" "$@"; }

say "1. Sign in as the viewer"
post "$BASE/api/auth/login" -d '{"email":"viewer@udyogpay.test","password":"Viewer#2026"}' | show
R0="$(cookie udy_refresh)"; A0="$(cookie udy_access)"
echo "refresh cookie: ${R0:0:12}…   access cookie: ${A0:0:12}…"

say "2. /api/auth/me with the access token"
get "$BASE/api/auth/me" | show

say "3. Refresh: the refresh token rotates (rotated: true, new refreshToken.id)"
post "$BASE/api/auth/refresh" | show
R1="$(cookie udy_refresh)"
echo "old refresh: ${R0:0:12}…  new refresh: ${R1:0:12}…  (different: $([ "$R0" != "$R1" ] && echo yes || echo no))"

say "4. Concurrent refresh: present the OLD token again within ${GRACE}s -> rotated: false, still 200"
curl -s -X POST -H "authorization: Bearer $R0" "$BASE/api/auth/refresh" | show

say "5. Reuse detection: wait $((GRACE + 2))s, then present the OLD token again -> 401 refresh_reuse_detected"
sleep $((GRACE + 2))
curl -s -X POST -H "authorization: Bearer $R0" "$BASE/api/auth/refresh" | show

say "6. The NEWEST token is dead too: the whole session family was revoked"
curl -s -X POST -H "authorization: Bearer $R1" "$BASE/api/auth/refresh" | show

say "7. And the access token that was still valid a moment ago is refused on the next request"
get "$BASE/api/auth/me" | show

say "8. Sign in again as the viewer and try the admin-only action -> 403, not a sign-out"
post "$BASE/api/auth/login" -d '{"email":"viewer@udyogpay.test","password":"Viewer#2026"}' >/dev/null
MID="$(get "$BASE/api/merchants" | python3 -c 'import sys,json; print(json.load(sys.stdin)["merchants"][0]["id"])')"
post "$BASE/api/merchants/$MID/status" -d '{"status":"suspended"}' | show
echo "still signed in? ->"; get "$BASE/api/auth/me" | show

say "9. A forged access token is token_invalid, an absent one is no_token"
curl -s -H "authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.forged" "$BASE/api/auth/me" | show
curl -s "$BASE/api/auth/me" | show

say "10. Sign out revokes the session; the refresh token is then refused with session_revoked"
R2="$(cookie udy_refresh)"
post "$BASE/api/auth/logout" | show
curl -s -X POST -H "authorization: Bearer $R2" "$BASE/api/auth/refresh" | show
