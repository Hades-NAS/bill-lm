import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const scriptPath = fileURLToPath(
  new URL('../registry-retention.sh', import.meta.url),
)
const workflowPath = fileURLToPath(
  new URL('../../.github/workflows/registry-retention.yml', import.meta.url),
)

describe('registry retention', () => {
  it('limita el alcance a los dos repositorios publicados y protege el apply', () => {
    const script = readFileSync(scriptPath, 'utf8')

    expect(script).toContain('REPOSITORIES=(bill-lm-server bill-lm-worker)')
    expect(script).toContain("readonly REGISTRY_URL='http://127.0.0.1:5000'")
    expect(script).toContain(
      '[[ "$MODE" != apply || "$CONFIRMATION" == DELETE ]]',
    )
    expect(script).toContain('manifest digest unavailable')
    expect(script).toContain('digest also backs a protected tag')
    expect(script).toContain(
      'registry garbage collection remains an NAS operation',
    )
  })

  it('retiene las familias conocidas y muestra una tabla antes de borrar', () => {
    const script = readFileSync(scriptPath, 'utf8')

    expect(script).toContain('buildcache')
    expect(script).toContain('^[0-9]+\\.[0-9]+\\.[0-9]+-dev$')
    expect(script).toContain('^[0-9]+\\.[0-9]+\\.[0-9]+$')
    expect(script).toContain(
      '| Tag | Family | Created | Manifest bytes | Digest | Decision |',
    )
    expect(script).toContain('api_curl --request DELETE')
  })

  it('expone solo el workflow manual, serializado y con confirmación explícita', () => {
    const workflow = readFileSync(workflowPath, 'utf8')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toContain('push:')
    expect(workflow).toContain('default: preview')
    expect(workflow).toContain('group: bill-lm-deploy')
    expect(workflow).toContain('RETENTION_CONFIRM: ${{ inputs.confirm }}')
    expect(workflow).toContain('group: Default')
    expect(workflow).toContain('labels: self-hosted')
  })
})
