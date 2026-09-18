#!/usr/bin/env bash

set -euo pipefail

HEALTH_ENV_FILE=".env.health"
HEALTH_PLAYWRIGHT_PORT="${PLAYWRIGHT_PORT:-3000}"
HEALTH_SKIP_E2E="${SKIP_E2E:-false}"

if [[ ! -f "$HEALTH_ENV_FILE" ]]; then
  printf 'Health fixture not found: %s\n' "$HEALTH_ENV_FILE" >&2
  exit 1
fi

run_check() {
  local label="$1"
  shift

  printf '\n==> %s\n' "$label"
  env -i \
    PATH="$PATH" \
    HOME="${HOME:-}" \
    CI="${CI:-}" \
    SKIP_E2E="$HEALTH_SKIP_E2E" \
    PLAYWRIGHT_PORT="$HEALTH_PLAYWRIGHT_PORT" \
    ./node_modules/.bin/dotenv -e "$HEALTH_ENV_FILE" -- "$@"
}

run_check "Package boundaries" bun --no-env-file run boundaries:check
run_check "Typecheck" bun --no-env-file run typecheck
run_check "Build" bun --no-env-file run build
run_check "Vitest" bun --no-env-file run test -- --passWithNoTests
run_check "Local daemon" bun --no-env-file run test:local
run_check "Playwright" bun --no-env-file run test:e2e

printf '\nNote: Vitest may report that no tests exist yet; this bootstrap exception does not replace migration test coverage.\n'

printf '\nHealth check passed.\n'
