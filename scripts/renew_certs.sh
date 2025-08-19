#!/usr/bin/env bash
set -euo pipefail

echo "[renew] Запускаю certbot renew..."
docker compose run --rm certbot renew --webroot -w /var/www/certbot

echo "[renew] Перезапускаю nginx..."
docker compose restart nginx

echo "[renew] Готово."


