#!/usr/bin/env bash
set -euo pipefail

# Конфигурация
EMAIL="you@example.com"            # TODO: замените на ваш email для Let's Encrypt
DOMAINS_MAIN=(gptlawyer.ru www.gptlawyer.ru)
DOMAINS_N8N=(n8n.gptlawyer.ru)

echo "[1/5] Создаю каталоги для certbot..."
mkdir -p ./nginx/ssl ./nginx/letsencrypt

echo "[2/5] Запускаю nginx с HTTP конфигурацией (для ACME challenge) ..."
docker compose up -d nginx

echo "[3/5] Жду 10 секунд для запуска nginx..."
sleep 10

echo "[4/5] Выпускаю сертификаты для: ${DOMAINS_MAIN[*]} ..."
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --agree-tos -m "$EMAIL" --non-interactive \
  $(printf -- '-d %s ' "${DOMAINS_MAIN[@]}")

echo "[5/5] Выпускаю сертификаты для: ${DOMAINS_N8N[*]} ..."
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --agree-tos -m "$EMAIL" --non-interactive \
  $(printf -- '-d %s ' "${DOMAINS_N8N[@]}")

echo "[6/5] Переключаю nginx на HTTPS конфигурацию..."
# Обновляем docker-compose для использования полной конфигурации
sed -i 's|nginx-http-only.conf|nginx.conf|g' docker-compose.yml

echo "[7/5] Перезапускаю nginx с HTTPS..."
docker compose up -d nginx

echo "Готово! Проверьте:"
echo "- https://gptlawyer.ru (фронтенд)"
echo "- https://n8n.gptlawyer.ru (n8n панель)"
echo ""
echo "Если нужно вернуться к HTTP конфигурации, выполните:"
echo "sed -i 's|nginx.conf|nginx-http-only.conf|g' docker-compose.yml"
echo "docker compose up -d nginx"
