#!/bin/bash

# entrypoint.sh - Script de inicialización para Budgetfy Server

set -e

# Skip database migrations if SKIP_DB_MIGRATION is set
echo "============================================"
if [ -z "$SKIP_DB_MIGRATION" ]; then
  echo "🔄 Ejecutando migraciones de base de datos..."
  echo ""

  echo "ENVIRONMENT: $ENVIRONMENT"
  
  bun run db:push
  
  echo ""
  echo "✅ Migraciones de base de datos completadas"
else
  echo "⏭️  Saltando migraciones de base de datos (SKIP_DB_MIGRATION está activado)"
fi
echo "============================================"

echo "🚀 Iniciando servidor Bill-LM"
echo ""
echo ""

bun run start

