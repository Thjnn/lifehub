#!/usr/bin/env bash
# Smoke test a deployed frontend.
# Usage: .github/scripts/smoke-frontend.sh https://lifehub-frontend-mu.vercel.app
set -uo pipefail

base="${1%/}"
fail=0

# check NAME URL EXPECTED_STATUS EXPECTED_CONTENT_TYPE_PREFIX ("" = any)
check() {
  local name=$1 url=$2 want_status=$3 want_type=$4 out status type
  out=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$url")
  status=${out%% *}
  type=${out#* }
  if [[ $status == "$want_status" && $type == "$want_type"* ]]; then
    echo "ok   $name ($status $type)"
  else
    echo "FAIL $name: got $status '$type', want $want_status ${want_type:-any type}"
    fail=1
  fi
}

check "home" "$base/" 200 text/html
check "SPA deep link" "$base/app/tasks" 200 text/html

css=$(curl -s "$base/" | grep -o '/assets/index-[^"]*\.css' | head -1)
if [[ -z $css ]]; then
  echo "FAIL index.html links no stylesheet"
  fail=1
else
  check "current stylesheet" "$base$css" 200 text/css
fi

# Regression guard (2026-10-22): a build file missing after a deploy must be a real 404. Answering it with
# index.html (200, cached immutable) left phones on an old build with an unstyled page that survived reloads.
check "missing asset is 404" "$base/assets/does-not-exist-$RANDOM.css" 404 ""

check "service worker" "$base/sw.js" 200 ""
sw_cache=$(curl -sI "$base/sw.js" | tr -d '\r' | grep -i '^cache-control:' || true)
if [[ $sw_cache == *max-age=0* ]]; then
  echo "ok   sw.js revalidates ($sw_cache)"
else
  echo "FAIL sw.js must not be cached long: '$sw_cache'"
  fail=1
fi

exit $fail
