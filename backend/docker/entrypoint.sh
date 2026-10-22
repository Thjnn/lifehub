#!/bin/sh
set -e

# Render injects PORT (default 10000). ":port" also tells Caddy not to manage HTTPS — Render terminates TLS.
export SERVER_NAME=":${PORT:-8000}"

# Caches are built here, not at image build time, because they must see the runtime env vars.
php artisan config:cache
php artisan route:cache
php artisan migrate --force

exec "$@"
