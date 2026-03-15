import type { UserConfig } from "@commitlint/types"

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // scope es obligatorio siempre
    "scope-empty": [2, "never"],
    // tipos permitidos
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "style", "refactor", "test", "ci", "revert"],
    ],
  },
}

export default config