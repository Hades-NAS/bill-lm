// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocalCollectionDetail, LocalCollectionRunDetail } from '@bill-lm/contracts'

import { LocalDaemonClient } from '../api'
import { LocalCollectionAnalysis } from '../local-collection-analysis'

const collectionId = '550e8400-e29b-41d4-a716-446655440004'
const invoiceId = '550e8400-e29b-41d4-a716-446655440000'
const runId = '550e8400-e29b-41d4-a716-446655440006'
const collection = {
  id: collectionId,
  latestRevision: null,
  invoices: [{ id: invoiceId, fileName: 'IVA-septiembre.xml', createdAt: '2026-09-18T00:00:00.000Z' }],
  runs: [{ id: runId, invoiceId, collectionId, status: 'failed', createdAt: '2026-09-18T01:00:00.000Z' }],
} as LocalCollectionDetail
const unavailableDetail = {
  ...collection.runs[0], events: [{ id: '550e8400-e29b-41d4-a716-446655440007', runId, status: 'failed', message: 'El análisis local no pudo completarse.', createdAt: '2026-09-18T01:01:00.000Z' }], result: null,
} as LocalCollectionRunDetail

describe('LocalCollectionAnalysis', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('drills into a collection-scoped run with localized labels and an unavailable result', async () => {
    const client = new LocalDaemonClient()
    vi.spyOn(client, 'listConnections').mockResolvedValue([])
    const detail = vi.spyOn(client, 'getCollectionRunDetail').mockResolvedValue(unavailableDetail)
    render(<MantineProvider><LocalCollectionAnalysis client={client} collection={collection} onChanged={async () => {}} /></MantineProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle de IVA-septiembre.xml' }))
    expect(await screen.findByText('Resultado no disponible')).not.toBeNull()
    expect(screen.getAllByText('Fallido').length).toBeGreaterThan(0)
    expect(screen.getByText('El análisis local no pudo completarse.')).not.toBeNull()
    expect(detail).toHaveBeenCalledWith(collectionId, runId)
    expect(screen.queryByText(/secretRef|cloud metadata|provider/i)).toBeNull()
  })

  it('shows a loading error and retries the same collection-scoped detail route', async () => {
    const client = new LocalDaemonClient()
    vi.spyOn(client, 'listConnections').mockResolvedValue([])
    const detail = vi.spyOn(client, 'getCollectionRunDetail').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(unavailableDetail)
    render(<MantineProvider><LocalCollectionAnalysis client={client} collection={collection} onChanged={async () => {}} /></MantineProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle de IVA-septiembre.xml' }))
    expect(await screen.findByText('No se pudo cargar el detalle local de esta ejecución.')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Resultado no disponible')).not.toBeNull()
    expect(detail).toHaveBeenLastCalledWith(collectionId, runId)
  })
})
