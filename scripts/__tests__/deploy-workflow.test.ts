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

  it('ejecuta calidad y construcción en paralelo antes de publicar imágenes', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('  quality:')
    expect(workflow).toContain('uses: actions/setup-node@v7')
    expect(workflow).toContain('node-version: 24')
    expect(workflow).toContain("PLAYWRIGHT_PORT: '3100'")
    expect(workflow).toContain('run: bash health.sh')
    expect(workflow).toContain('needs: [quality, validate-health, build]')
    expect(workflow).toContain('QUALITY_RESULT: ${{ needs.quality.result }}')
  })

  it('no pasa API keys de proveedores a builds ni imágenes', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).not.toContain('OPENAI_API_KEY')
    expect(workflow).not.toContain('CLAUDE_API_KEY')
    expect(workflow).not.toContain('--build-arg DATABASE_URL')
    expect(workflow).toContain('BYOK_ENCRYPTION_KEY=${{ secrets.BYOK_ENCRYPTION_KEY }}')
  })
})
