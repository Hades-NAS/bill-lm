import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const workflowPath = fileURLToPath(
  new URL('../../.github/workflows/deploy-build-push.yml', import.meta.url),
)
const workerDockerfilePath = fileURLToPath(
  new URL('../../docker/Dockerfile.worker', import.meta.url),
)

describe('deploy workflow', () => {
  it('serializa despliegues para evitar carreras sobre imágenes y el NAS', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('concurrency:')
    expect(workflow).toContain('group: bill-lm-deploy')
    expect(workflow).toContain('cancel-in-progress: false')
  })

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

  it('asigna calidad al runner Tests y los trabajos Docker al runner Default', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const quality = workflow.slice(
      workflow.indexOf('  quality:'),
      workflow.indexOf('  build:'),
    )

    expect(quality).toContain('group: Tests')
    expect(quality).toContain('labels: tests')
    for (const job of [
      'build:',
      'validate-health:',
      'push-to-registry:',
      'notify-deployment-failure:',
      'notify-deployment-success:',
    ]) {
      expect(workflow).toMatch(
        new RegExp(
          `  ${job}\\n(?:    [^\\n]*\\n)*    runs-on:\\n      group: Default\\n      labels: self-hosted`,
        ),
      )
    }
  })

  it('usa cachés BuildKit aisladas para servidor y worker', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('driver-opts: network=host')
    expect(workflow).toContain('127.0.0.1:5000/bill-lm-server:buildcache')
    expect(workflow).toContain('127.0.0.1:5000/bill-lm-worker:buildcache')
    expect(workflow).toContain(
      '--cache-to "type=registry,ref=$CACHE_IMAGE,mode=max"',
    )
    expect(workflow).toContain('Cleanup local runner images only')
  })

  it('no pasa API keys de proveedores a builds ni imágenes', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).not.toContain('OPENAI_API_KEY')
    expect(workflow).not.toContain('CLAUDE_API_KEY')
    expect(workflow).toContain(
      'BYOK_ENCRYPTION_KEY=${{ secrets.BYOK_ENCRYPTION_KEY }}',
    )
  })

  it('entrega la configuración pública de Firebase al build del worker', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    const workerDockerfile = readFileSync(workerDockerfilePath, 'utf8')
    const workerBuild = workflow.slice(
      workflow.indexOf('Build Worker Docker image'),
      workflow.indexOf('  validate-health:'),
    )

    expect(workerBuild).toContain(
      '--build-arg VITE_FIREBASE_API_KEY=${{ env.VITE_FIREBASE_API_KEY }}',
    )
    expect(workerBuild).toContain(
      '--build-arg VITE_FIREBASE_APP_ID=${{ env.VITE_FIREBASE_APP_ID }}',
    )
    expect(workerDockerfile).toContain('ARG VITE_FIREBASE_API_KEY')
    expect(workerDockerfile).toContain(
      'ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}',
    )
  })

  it('permite generar Prisma del worker sin una URL de producción', () => {
    const workerDockerfile = readFileSync(workerDockerfilePath, 'utf8')
    const builderStage = workerDockerfile.slice(
      0,
      workerDockerfile.indexOf('# ===== STAGE 2: Runtime ====='),
    )

    expect(builderStage).toContain(
      'ARG DATABASE_URL=postgresql://localhost/bill-lm',
    )
    expect(builderStage).toContain('ENV DATABASE_URL=${DATABASE_URL}')
    expect(builderStage).toContain('bun run --cwd apps/web db:gen')
  })
})
