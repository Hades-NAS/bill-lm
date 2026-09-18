// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocalViewer } from '../local-viewer'

describe('LocalViewer', () => {
  const activityId = '550e8400-e29b-41d4-a716-446655440000'
  const activityRevisionId = '550e8400-e29b-41d4-a716-446655440001'
  const profileId = '550e8400-e29b-41d4-a716-446655440002'
  const profileRevisionId = '550e8400-e29b-41d4-a716-446655440003'
  const collectionId = '550e8400-e29b-41d4-a716-446655440004'

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input.endsWith('/connections')) return Response.json({ items: [] })
        if (input.endsWith('/rulesets'))
          return Response.json({
            items: [{ id: 'ec-sri-2026.3', effectiveFrom: '2026-01-01' }],
          })
        if (input.endsWith('/runs')) return Response.json({ items: [] })
        if (input.endsWith('/invoices')) return Response.json({ items: [] })
        if (input.endsWith('/activities'))
          return Response.json({
            items: [{
              id: activityId,
              latestRevision: {
                id: activityRevisionId,
                activityId,
                revision: 2,
                createdAt: '2026-09-17T00:00:00.000Z',
                displayName: 'Desarrollo local',
                registeredActivityCode: '',
                registeredActivityName: 'Desarrollo de software',
                activityDescription: 'Servicios de desarrollo.',
                necessaryPurchases: '',
                revenueVatTreatment: 'unknown',
                revenueVatTreatmentOther: '',
                mixedUseDescription: '',
                additionalFacts: '',
              },
            }],
          })
        if (input.endsWith('/profiles'))
          return Response.json({
            items: [{
              id: profileId,
              latestRevision: {
                id: profileRevisionId,
                taxpayerProfileId: profileId,
                revision: 2,
                createdAt: '2026-09-17T00:00:00.000Z',
                displayName: 'Perfil local',
                personalIdNumber: '',
                professionalIdNumber: '',
                hasEmploymentIncome: false,
                hasRuc: true,
                taxRegime: 'unknown',
                vatFilingFrequency: 'unknown',
                activityRevisionIds: [activityRevisionId],
                additionalFacts: '',
              },
            }],
          })
        if (input.endsWith('/collections')) {
          if (init?.method === 'POST')
            return Response.json({ id: collectionId, latestRevision: null }, { status: 201 })
          return Response.json({
            items: [{ id: collectionId, latestRevision: null }],
          })
        }
        if (input.includes('/collections/') && input.endsWith('/revisions'))
          return Response.json({
            id: '550e8400-e29b-41d4-a716-446655440005',
            collectionId,
            revision: 1,
            createdAt: '2026-09-18T00:00:00.000Z',
          }, { status: 201 })
        if (input.includes('/revisions')) return Response.json({ id: activityRevisionId })
        return new Response(null, { status: 404 })
      }),
    )
  })

  it('shows loading before local profile data resolves, then its empty state', async () => {
    let resolveActivities: (value: Response) => void = () => {}
    let resolveProfiles: (value: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/activities'))
        return new Promise<Response>((resolve) => { resolveActivities = resolve })
      if (input.endsWith('/profiles'))
        return new Promise<Response>((resolve) => { resolveProfiles = resolve })
      if (input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(screen.getByText('Cargando actividades locales…')).not.toBeNull()
    expect(screen.getByText('Cargando perfiles locales…')).not.toBeNull()
    expect(screen.queryByText('No hay actividades locales')).toBeNull()
    expect(screen.queryByText('No hay perfiles locales')).toBeNull()

    resolveActivities(Response.json({ items: [] }))
    resolveProfiles(Response.json({ items: [] }))
    expect(await screen.findByText('No hay actividades locales')).not.toBeNull()
    expect(screen.getByText('No hay perfiles locales')).not.toBeNull()
  })

  it('reports a profile-data loading error after requests settle', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/activities')) return new Response(null, { status: 503 })
      if (input.endsWith('/profiles')) return Response.json({ items: [] })
      if (input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByText('No se pudieron cargar los perfiles y actividades locales.')).not.toBeNull()
    expect(screen.queryByText('Cargando actividades locales…')).toBeNull()
    expect(screen.queryByText('Cargando perfiles locales…')).toBeNull()
  })

  it('renders a Firebase-free local XML workflow with OAuth guidance available', async () => {
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )
    expect(await screen.findByText('Bill LM local')).not.toBeNull()
    expect(screen.getByText(/Sólo se importan comprobantes XML/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Analizar' })).not.toBeNull()
  })

  it('renders latest revisions and sends an activity revision through the local daemon', async () => {
    const fetchMock = vi.mocked(fetch)
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect((await screen.findAllByText('Desarrollo local')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Perfil local').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Nueva revisión' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/activities/550e8400-e29b-41d4-a716-446655440000/revisions',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('renders a collection without a context revision safely and creates another only through Hono', async () => {
    const fetchMock = vi.mocked(fetch)
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByText('Contexto pendiente')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva colección' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/collections',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(screen.getByText('Esta colección todavía no tiene una revisión de contexto.')).not.toBeNull()
  })

  it('shows collection loading before resolving its empty state', async () => {
    let resolveCollections: (value: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/collections'))
        return new Promise<Response>((resolve) => { resolveCollections = resolve })
      if (input.endsWith('/activities') || input.endsWith('/profiles') || input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(screen.getByText('Cargando colecciones locales…')).not.toBeNull()
    expect(screen.queryByText('No hay colecciones locales')).toBeNull()

    resolveCollections(Response.json({ items: [] }))
    expect(await screen.findByText('No hay colecciones locales')).not.toBeNull()
  })

  it('retries collection loading after a local Hono GET failure', async () => {
    let collectionRequests = 0
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/collections')) {
        collectionRequests += 1
        return collectionRequests === 1
          ? new Response(null, { status: 503 })
          : Response.json({ items: [] })
      }
      if (input.endsWith('/activities') || input.endsWith('/profiles') || input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect((await screen.findAllByText('No se pudieron cargar las colecciones locales.')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar colecciones' }))
    expect(await screen.findByText('No hay colecciones locales')).not.toBeNull()
    expect(collectionRequests).toBe(2)
  })

  it('hydrates a selected collection context and posts its next revision only through Hono', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/collections')) return Response.json({
        items: [{
          id: collectionId,
          latestRevision: {
            id: '550e8400-e29b-41d4-a716-446655440005',
            collectionId,
            revision: 1,
            createdAt: '2026-09-18T00:00:00.000Z',
            purpose: 'personal_expenses',
            period: { startDate: '2026-01-01', endDate: '2026-01-31' },
            taxpayerProfileRevisionId: profileRevisionId,
            activityRevisionIds: [activityRevisionId],
            notes: 'Contexto inicial',
          },
        }],
      })
      if (input.endsWith('/activities')) return Response.json({ items: [{ id: activityId, latestRevision: { id: activityRevisionId, activityId, revision: 1, createdAt: '2026-09-17T00:00:00.000Z', displayName: 'Desarrollo local' } }] })
      if (input.endsWith('/profiles')) return Response.json({ items: [{ id: profileId, latestRevision: { id: profileRevisionId, taxpayerProfileId: profileId, revision: 1, createdAt: '2026-09-17T00:00:00.000Z', displayName: 'Perfil local', activityRevisionIds: [activityRevisionId] } }] })
      if (input.includes('/collections/') && input.endsWith('/revisions')) return Response.json({ id: '550e8400-e29b-41d4-a716-446655440006' }, { status: 201 })
      if (input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    const fetchMock = vi.mocked(fetch)
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByDisplayValue('Contexto inicial')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión de contexto' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/collections/${collectionId}/revisions`,
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })
})
