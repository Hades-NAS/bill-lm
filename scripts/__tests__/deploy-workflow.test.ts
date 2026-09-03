import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const workflowPath = fileURLToPath(
  new URL('../../.github/workflows/deploy-build-push.yml', import.meta.url),
)

describe('deploy workflow', () => {
  it('notifica de forma opcional los resultados de despliegue por Discord', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('notify-deployment-failure:')
    expect(workflow).toContain('notify-deployment-success:')
    expect(workflow).toContain('secrets.DISCORD_WEBHOOK_URL')
    expect(workflow).toContain('allowed_mentions: { parse: [] }')
    expect(workflow).toContain('>> "$GITHUB_STEP_SUMMARY"')
  })
})
