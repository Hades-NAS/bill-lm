#!/usr/bin/env bash

set -euo pipefail

run_check() {
  local label="$1"
  shift

  printf '\n==> %s\n' "$label"
  "$@"
}

run_check "Typecheck" bun run typecheck
run_check "Build" bun run build
run_check "Vitest" bun run test -- --passWithNoTests
run_check "Playwright" bun run test:e2e

printf '\nNote: Vitest may report that no tests exist yet; this bootstrap exception does not replace migration test coverage.\n'

printf '\nHealth check passed.\n'
