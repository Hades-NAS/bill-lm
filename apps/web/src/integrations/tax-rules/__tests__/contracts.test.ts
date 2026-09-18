import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildTaxRuleBundle,
  canonicalizeTaxRuleValue,
  TaxRuleSourceManifestSchema,
} from '../contracts'

const source = {
  schemaVersion: '1' as const,
  id: 'ec-sri-lrti',
  title: 'Ley de Régimen Tributario Interno (LRTI)',
  issuer: 'Servicio de Rentas Internas' as const,
  jurisdiction: 'EC' as const,
  sourceKind: 'law' as const,
  discoveryUrl:
    'https://www.sri.gob.ec/normativa-tributaria-legislacion-nacional',
  resolvedUrl: 'https://www.sri.gob.ec/example.pdf',
  mimeType: 'application/pdf' as const,
  retrievedAt: '2026-09-03T00:00:00.000Z',
  contentHash: `sha256:${'a'.repeat(64)}`,
  effectiveFrom: '2025-10-28',
  effectiveTo: null,
  reviewStatus: 'reviewed' as const,
}

const payload = {
  schemaVersion: '1' as const,
  rulesetId: 'ec-sri-2026.1',
  version: 1,
  jurisdiction: 'EC' as const,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  sourceManifests: [source],
  sections: [
    {
      schemaVersion: '1' as const,
      id: 'ec-sri-lrti-art-10',
      sourceId: 'ec-sri-lrti',
      articleOrSection: 'Art. 10',
      sourcePages: [10],
      sourceContentHash: source.contentHash,
      purposes: ['business_income_tax'] as Array<'business_income_tax'>,
      taxRegimes: ['general'] as Array<'general'>,
      effectiveFrom: '2025-10-28',
      effectiveTo: null,
      reviewStatus: 'reviewed' as const,
      reviewedBy: 'fixture',
      reviewedAt: '2026-09-03T00:00:00.000Z',
      markdown: 'Resumen de fixture; no es normativa publicada.',
    },
  ],
  rules: [
    {
      id: 'ec.sri.ir.business.causality',
      version: 1,
      purpose: 'business_income_tax' as const,
      kind: 'requirement' as const,
      summary: 'Relacionar el gasto con la actividad seleccionada.',
      sourceSectionIds: ['ec-sri-lrti-art-10'],
      conditions: ['related_to_selected_activity'],
      uncertainties: ['mixed_personal_business_use'],
    },
  ],
  promptContractVersion: 'v2',
  createdAt: '2026-09-03T00:00:00.000Z',
  createdBy: 'fixture',
}

describe('tax rule contracts', () => {
  it('serializes object keys canonically', () => {
    expect(canonicalizeTaxRuleValue({ z: 1, a: 2 })).toBe('{"a":2,"z":1}')
  })

  it('builds the same hash from the same reviewed payload', () => {
    expect(buildTaxRuleBundle(payload).bundleHash).toBe(
      buildTaxRuleBundle({
        ...payload,
        sourceManifests: [...payload.sourceManifests],
      }).bundleHash,
    )
  })

  it('does not permit an un-hashed source to be marked reviewed', () => {
    expect(
      TaxRuleSourceManifestSchema.safeParse({
        ...source,
        contentHash: null,
      }).success,
    ).toBe(false)
  })

  it('keeps the initial repository manifests as discovery-only drafts', () => {
    const initialManifest = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          'resources/tax-rules/ec/sri/sources/ec-sri-lrti.source.json',
        ),
        'utf8',
      ),
    )
    expect(TaxRuleSourceManifestSchema.parse(initialManifest)).toMatchObject({
      title: 'Ley de Régimen Tributario Interno (LRTI)',
      contentHash: null,
      reviewStatus: 'draft',
    })
  })

  it('accepts an already-published bundle whose manifests predate readable titles', () => {
    const publishedBundle = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          'resources/tax-rules/ec/sri/rulesets/ec-sri-2026.1.bundle.json',
        ),
        'utf8',
      ),
    )

    expect(() => buildTaxRuleBundle(publishedBundle)).not.toThrow()
  })
})
