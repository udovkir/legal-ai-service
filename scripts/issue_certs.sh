#!/usr/bin/env bash
set -euo pipefail

# Конфигурация
EMAIL="you@example.com"            # TODO: замените на ваш email для Let's Encrypt
DOMAINS_MAIN=(gptlawyer.ru www.gptlawyer.ru)
DOMAINS_N8N=(n8n.gptlawyer.ru)

echo "[1/4] Создаю каталоги для certbot..."
mkdir -p ./nginx/ssl ./nginx/letsencrypt

echo "[2/4] Запускаю nginx (для ответа на http-01 challenge) ..."
docker compose up -d nginx

echo "[3/4] Выпускаю сертификаты для: ${DOMAINS_MAIN[*]} ..."
docker compose run --rm certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --agree-tos -m "$EMAIL" --non-interactive \
  $(printf -- '-d %s ' "${DOMAINS_MAIN[@]}")

echo "[3/4] Выпускаю сертификаты для: ${DOMAINS_N8N[*]} ..."
docker compose run --rm certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --agree-tos -m "$EMAIL" --non-interactive \
  $(printf -- '-d %s ' "${DOMAINS_N8N[@]}")

echo "[4/4] Перезапускаю nginx..."
docker compose restart nginx

echo "Готово. Проверьте: https://gptlawyer.ru и https://n8n.gptlawyer.ru"


