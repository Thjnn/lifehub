# Production image for Render (spec §4). FrankenPHP = Caddy + PHP in one process, listens on $PORT.

# 1. PHP dependencies without dev packages
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs

# 2. Runtime
FROM dunglas/frankenphp:1-php8.3

# The base image grants frankenphp cap_net_bind_service (to bind :80/:443). Render drops capabilities, so exec
# of a binary carrying file caps fails with EPERM (exit 126). We only bind $PORT (>1024): remove the cap.
RUN install-php-extensions pdo_pgsql opcache intl zip bcmath \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && setcap -r /usr/local/bin/frankenphp

COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"

# Safe defaults; real values come from Render env vars. Render has no persistent disk → logs to stderr.
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    QUEUE_CONNECTION=sync

WORKDIR /app
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY --from=vendor /app/vendor ./vendor
COPY . .

RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && chmod +x docker/entrypoint.sh \
    && useradd --create-home app \
    && chown -R app:app storage bootstrap/cache /config/caddy /data/caddy

USER app

ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile", "--adapter", "caddyfile"]
