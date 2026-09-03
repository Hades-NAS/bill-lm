#!/bin/bash

# Entrypoint del servidor Bill-LM

set -eu

echo "============================================"
case "${SKIP_DB_MIGRATION:-false}" in
  false|'')
    echo "🔄 Aplicando migraciones pendientes de Prisma..."
    echo "ENVIRONMENT: ${ENVIRONMENT:-unknown}"
    ./node_modules/.bin/prisma migrate deploy
    echo "✅ Migraciones de base de datos aplicadas"
    ;;
  true)
    echo "⏭️  Saltando migraciones de base de datos (SKIP_DB_MIGRATION=true)"
    ;;
  *)
    echo "❌ SKIP_DB_MIGRATION debe ser 'true' o 'false'"
    exit 1
    ;;
esac
echo "============================================"

echo "🚀 Iniciando servidor Bill-LM"
echo ""
echo ""

exec bun run start
