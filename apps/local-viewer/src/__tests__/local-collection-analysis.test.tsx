// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocalCollectionDetail } from '@bill-lm/contracts'

import { LocalDaemonClient } from '../api'
import { LocalCollectionAnalysis } from '../local-collection-analysis'

const collectionId = '550e8400-e29b-41d4-a716-446655440004'
const invoiceId = '550e8400-e29b-41d4-a716-446655440000'
const collection = {
  id: collectionId,
  latestRevision: null,
  invoices: [{ id: invoiceId, fileName: 'IVA-septiembre.xml', createdAt: '2026-09-18T00:00:00.000Z', latestAnalysis: null }],
  runs: [],
} as unknown as LocalCollectionDetail

const configuredCollection = {
  ...collection,
  latestRevision: { purpose: 'personal_expenses' },
} as LocalCollectionDetail

describe('LocalCollectionAnalysis', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('renders analysis as a collection modal and keeps history out of the detail body', async () => {
    const client = new LocalDaemonClient()
    vi.spyOn(client, 'listConnections').mockResolvedValue([])
    render(<MantineProvider><LocalCollectionAnalysis client={client} collection={collection} onChanged={async () => {}} /></MantineProvider>)

    expect(await screen.findByRole('dialog', { name: 'Analizar colección' })).not.toBeNull()
    expect(screen.getByText('Configura el contexto de la colección')).not.toBeNull()
    expect(screen.queryByText('Historial local de análisis')).toBeNull()
  })

  it('sends a selected invoice to the local analysis endpoint', async () => {
    const client = new LocalDaemonClient()
    vi.spyOn(client, 'listConnections').mockResolvedValue([{ id: '550e8400-e29b-41d4-a716-446655440008', label: 'GPU', apiFlavor: 'openai-like', baseUrl: 'http://127.0.0.1:1234/v1', model: 'qwen', isDefault: true, lastProbedAt: null, lastProbeError: null, createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z' }])
    const analyze = vi.spyOn(client, 'analyze').mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440009', status: 'queued' })
    render(<MantineProvider><LocalCollectionAnalysis client={client} collection={configuredCollection} onChanged={async () => {}} /></MantineProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Analizar IVA-septiembre.xml' }))
    expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ collectionId, invoiceId }))
  })

  it('confirms a successful Local-GPU probe in the analysis modal', async () => {
    const client = new LocalDaemonClient()
    vi.spyOn(client, 'listConnections').mockResolvedValue([{ id: '550e8400-e29b-41d4-a716-446655440008', label: 'GPU', apiFlavor: 'openai-like', baseUrl: 'http://127.0.0.1:1234/v1', model: 'qwen', isDefault: true, lastProbedAt: null, lastProbeError: null, createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z' }])
    vi.spyOn(client, 'probeConnection').mockResolvedValue({ ok: true })
    render(<MantineProvider><LocalCollectionAnalysis client={client} collection={configuredCollection} onChanged={async () => {}} /></MantineProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Probar conexión' }))

    expect(await screen.findByText('El host Local-GPU respondió correctamente.')).not.toBeNull()
  })
})
