import { describe, expect, it } from 'vitest'

import { BillPromptBuilder } from '../bill-prompt-builder'

describe('BillPromptBuilder', () => {
  it('labels user references as self-managed rather than official rules', () => {
    const prompt = new BillPromptBuilder().build(
      {
        jobId: 'job-id',
        userId: 'user-id',
        credentialId: 'connection-id',
        percentage: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        callCount: 0,
        totalTokens: 0,
        deletedAt: null,
        read: false,
        data: {
          collectionId: 'collection-id',
          collectionName: 'Colección',
          type: 'all',
          billIds: ['bill-id'],
          credentialId: 'connection-id',
        },
      },
      {
        vendorName: 'Proveedor',
        buyerIdentifier: '0102030405',
        details: [],
        totals: { amount: 1, net: 1, taxes: 0 },
        billType: 'PERSONAL',
      },
      [{ name: 'Mi criterio.md', markdown: '# Mi criterio\n\nSolo mi texto.' }],
    )

    expect(prompt).toContain('Mi criterio.md')
    expect(prompt).toContain('autogestionado')
    expect(prompt).toContain('no es una fuente oficial')
  })

  it('labels published ruleset sections as official and keeps them distinct from user material', () => {
    const prompt = new BillPromptBuilder().build(
      {
        jobId: 'job-id',
        userId: 'user-id',
        credentialId: 'connection-id',
        percentage: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        callCount: 0,
        totalTokens: 0,
        deletedAt: null,
        read: false,
        data: {
          collectionId: 'collection-id',
          collectionName: 'Colección',
          type: 'all',
          billIds: ['bill-id'],
          credentialId: 'connection-id',
        },
      },
      {
        vendorName: 'Proveedor',
        buyerIdentifier: '0102030405',
        details: [],
        totals: { amount: 1, net: 1, taxes: 0 },
        billType: 'PERSONAL',
      },
      [{ name: 'Nota propia.md', markdown: 'Nota del usuario.' }],
      [{ name: 'SRI — LRTI · Art. 10', markdown: 'Texto oficial publicado.' }],
    )

    expect(prompt).toContain('Secciones de fuente oficial publicadas')
    expect(prompt).toContain('SRI — LRTI · Art. 10')
    expect(prompt).toContain('Nota propia.md')
  })
})
