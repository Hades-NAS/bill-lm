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
    window.location.hash = '#' + '/collections'
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
        if (input.endsWith('/official-sources'))
          return Response.json({ items: [{
            id: 'ec-sri-lrti', title: 'Ley tributaria local', issuer: 'SRI', jurisdiction: 'EC', sourceKind: 'law', officialUrl: null, resolvedUrl: null, contentHash: 'sha256:test', effectiveFrom: '2026-01-01', effectiveTo: null, reviewStatus: 'reviewed', sectionCount: 1,
          }] })
        if (input.includes('/official-sources/'))
          return Response.json({ id: 'ec-sri-lrti', title: 'Ley tributaria local', issuer: 'SRI', jurisdiction: 'EC', sourceKind: 'law', officialUrl: null, resolvedUrl: null, contentHash: 'sha256:test', effectiveFrom: '2026-01-01', effectiveTo: null, reviewStatus: 'reviewed', sectionCount: 1, fragments: [], ruleset: { id: 'ec-sri-2026.3', version: '3', jurisdiction: 'EC', reviewStatus: 'local-snapshot' } })
        if (input.endsWith('/library/summary'))
          return Response.json({ invoiceCount: 0, collectionCount: 1, profileCount: 1, activityCount: 1, runCount: 0, ruleset: { id: 'ec-sri-2026.3', version: '3', effectiveFrom: '2026-01-01', effectiveTo: null } })
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
            return Response.json({ id: collectionId, name: 'Gastos personales', year: 2026, invoiceCount: 0, latestRevision: null }, { status: 201 })
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
    window.location.hash = '#' + '/profiles'
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

    expect(screen.queryByText('Aún no tienes actividades')).toBeNull()
    expect(screen.queryByText('Aún no tienes perfiles')).toBeNull()

    resolveActivities(Response.json({ items: [] }))
    resolveProfiles(Response.json({ items: [] }))
    expect(await screen.findByText('Aún no tienes actividades')).not.toBeNull()
    expect(screen.getByText('Aún no tienes perfiles')).not.toBeNull()
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

  it('renders a Firebase-free local XML workflow and keeps GPU execution out of settings', async () => {
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )
    expect(await screen.findByRole('heading', { name: 'Colecciones' })).not.toBeNull()
    expect(screen.getByText(/Sólo se importan comprobantes XML/)).not.toBeNull()
    fireEvent.click(screen.getAllByText('Configuración').at(0)!)
    expect(await screen.findByText(/Las conexiones Local-GPU se configuran dentro del detalle/)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar conexión' })).toBeNull()
  })

  it('uses the web-app navigation order and canonical local hash fallback', async () => {
    window.location.hash = '#' + '/unknown-route'
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByRole('heading', { name: 'Colecciones' })).not.toBeNull()
    expect(window.location.hash).toBe('#' + '/collections')
    expect(
      ['Colecciones', 'Perfiles y actividades', 'Configuración', 'Fuentes oficiales', 'Biblioteca local'].map((label) =>
        screen.getAllByText(label).at(0)?.textContent,
      ),
    ).toEqual(['Colecciones', 'Perfiles y actividades', 'Configuración', 'Fuentes oficiales', 'Biblioteca local'])

    fireEvent.click(screen.getAllByText('Perfiles y actividades').at(0)!)
    expect((await screen.findAllByRole('heading', { name: 'Perfiles y actividades' })).length).toBeGreaterThan(0)
    expect(document.querySelector('[aria-current="page"]')?.textContent).toContain('Perfiles y actividades')
  })

  it('renders latest revisions and sends an activity revision through the local daemon', async () => {
    window.location.hash = '#' + '/profiles'
    const fetchMock = vi.mocked(fetch)
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect((await screen.findAllByText('Desarrollo local')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Perfil local').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear nueva revisión' })[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar revisión' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/activities/550e8400-e29b-41d4-a716-446655440000/revisions',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('uses the local profile stepper and persists a profile revision through Hono', async () => {
    window.location.hash = '#' + '/profiles'
    const fetchMock = vi.mocked(fetch)
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    await screen.findByText('Perfil local')
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear nueva revisión' })[1]!)
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar revisión' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/profiles/${profileId}/revisions`,
      expect.objectContaining({ method: 'POST' }),
    ))
  })

  it('keeps an invalid local profile on the first step and never posts it', async () => {
    window.location.hash = '#' + '/profiles'
    const fetchMock = vi.mocked(fetch)
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    await screen.findByText('Perfil local')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Ingresa un nombre para el perfil.')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/profiles(?:\/|$)/),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows activity detail and linked local activities on revision cards', async () => {
    window.location.hash = '#' + '/profiles'
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByText('Servicios de desarrollo.')).not.toBeNull()
    expect(screen.getByText('Actividades: Desarrollo local')).not.toBeNull()
  })

  it('opens local profile guides and keeps profile creation available without a cloud eligibility gate', async () => {
    window.location.hash = '#' + '/profiles'
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver guía sobre actividades económicas' }))
    expect(await screen.findByRole('dialog', { name: 'Guía de actividades económicas' })).not.toBeNull()
    fireEvent.click(screen.getByRole('dialog', { name: 'Guía de actividades económicas' }).querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Ver guía sobre perfiles tributarios' }))
    expect(await screen.findByText(/puedes crear un perfil aunque todavía no tengas RUC/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Agregar perfil' }).hasAttribute('disabled')).toBe(false)
  })

  it('mounts the deep-linked local sections without rendering collection content everywhere', async () => {
    window.location.hash = '#' + '/official-sources'
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect((await screen.findAllByRole('heading', { name: 'Fuentes oficiales' })).length).toBeGreaterThan(0)
    expect(screen.getByText('Snapshot local de solo lectura incluido con este visor. No se consulta al SRI mientras navegas estas fuentes.')).not.toBeNull()
    expect(screen.queryByText('Importar factura')).toBeNull()
    expect(screen.queryByText('Conexión local-GPU')).toBeNull()
  })

  it('shows local source metadata, fragment tags, and its dedicated detail state', async () => {
    window.location.hash = '#' + '/official-sources'
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/official-sources')) return Response.json({ items: [{ id: 'ec-sri-lrti', title: 'Ley tributaria local', issuer: 'SRI', jurisdiction: 'EC', sourceKind: 'law', officialUrl: null, resolvedUrl: null, contentHash: 'sha256:test', effectiveFrom: '2026-01-01', effectiveTo: null, reviewStatus: 'reviewed', sectionCount: 1 }] })
      if (input.endsWith('/official-sources/ec-sri-lrti')) return Response.json({ id: 'ec-sri-lrti', title: 'Ley tributaria local', issuer: 'SRI', jurisdiction: 'EC', sourceKind: 'law', officialUrl: null, resolvedUrl: null, contentHash: 'sha256:test', effectiveFrom: '2026-01-01', effectiveTo: null, reviewStatus: 'reviewed', sectionCount: 1, fragments: [{ id: 'art-1', articleOrSection: 'Artículo 1', effectiveFrom: '2026-01-01', effectiveTo: null, purposes: ['personal_expenses'], taxRegimes: ['general'], reviewStatus: 'reviewed', contentMarkdown: 'Primera línea\nSegunda línea', sourcePages: [4] }], ruleset: { id: 'ec-sri-2026.3', version: '3', jurisdiction: 'EC', reviewStatus: 'local-snapshot' } })
      if (input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices') || input.endsWith('/activities') || input.endsWith('/profiles') || input.endsWith('/collections')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver secciones' }))
    expect(await screen.findByText('Hash: sha256:test')).not.toBeNull()
    expect(screen.getByText('personal_expenses')).not.toBeNull()
    expect(screen.getByText('general')).not.toBeNull()
    expect(screen.getByText((_, element) => element?.textContent === 'Primera línea\nSegunda línea')).not.toBeNull()
  })

  it('distinguishes a successfully empty local library and describes its non-destructive boundary', async () => {
    window.location.hash = '#' + '/library'
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/library/summary')) return Response.json({ invoiceCount: 0, collectionCount: 0, profileCount: 0, activityCount: 0, runCount: 0, ruleset: null })
      if (input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices') || input.endsWith('/activities') || input.endsWith('/profiles') || input.endsWith('/collections')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByText('Tu biblioteca local está vacía')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver guía sobre biblioteca local' }))
    expect(await screen.findByText(/No expone rutas de disco, no sincroniza con la cloud/i)).not.toBeNull()
  })

  it('opens the mobile drawer control and closes it after local navigation', async () => {
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    const navigationButton = screen.getByRole('button', { name: 'Abrir navegación' })
    expect(navigationButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(navigationButton)
    expect(navigationButton.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getAllByText('Biblioteca local').at(0)!)
    expect(navigationButton.getAttribute('aria-expanded')).toBe('false')
  })

  it('renders a collection without a context revision safely and creates another only through Hono', async () => {
    const fetchMock = vi.mocked(fetch)
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByRole('button', { name: 'Abrir colección Colección local sin nombre' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva colección' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Nombre' }), {
      target: { value: 'Gastos personales' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear colección' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/collections',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(await screen.findByText('Esta colección todavía no tiene una revisión de contexto.')).not.toBeNull()
  })

  it('selects the collection identified by a local deep link after loading multiple collections', async () => {
    const secondCollectionId = '550e8400-e29b-41d4-a716-446655440099'
    window.location.hash = '#' + `/collections/${secondCollectionId}`
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/collections')) return Response.json({
        items: [
          { id: collectionId, latestRevision: null },
          { id: secondCollectionId, latestRevision: null },
        ],
      })
      if (input.endsWith(`/collections/${secondCollectionId}`)) return Response.json({ id: secondCollectionId, latestRevision: null, invoices: [], runs: [] })
      if (input.endsWith('/activities') || input.endsWith('/profiles') || input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))

    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByText('Contexto pendiente')).not.toBeNull()
    expect(window.location.hash).toBe('#' + `/collections/${secondCollectionId}`)
  })

  it('falls back safely when a local collection deep link does not exist', async () => {
    window.location.hash = '#' + '/collections/missing-local-collection'
    render(<MantineProvider><LocalViewer /></MantineProvider>)

    expect(await screen.findByText('La colección local solicitada no existe en esta biblioteca.')).not.toBeNull()
    expect(window.location.hash).toBe('#' + '/collections')
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
    window.location.hash = '#' + `/collections/${collectionId}`
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
      if (input.endsWith(`/collections/${collectionId}`)) return Response.json({ id: collectionId, latestRevision: null, invoices: [], runs: [] })
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

  it('renders collection-scoped invoices from the typed detail aggregate', async () => {
    window.location.hash = '#' + `/collections/${collectionId}`
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/collections')) return Response.json({ items: [{ id: collectionId, latestRevision: null }] })
      if (input.endsWith(`/collections/${collectionId}`)) return Response.json({
        id: collectionId, latestRevision: null, invoices: [{ id: activityId, fileName: 'IVA-septiembre.xml', createdAt: '2026-09-18T00:00:00.000Z' }], runs: [],
      })
      if (input.endsWith('/activities') || input.endsWith('/profiles') || input.endsWith('/connections') || input.endsWith('/runs')) return Response.json({ items: [] })
      if (input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)
    expect(await screen.findByText('IVA-septiembre.xml')).not.toBeNull()
    expect(screen.getByRole('table')).not.toBeNull()
    expect(screen.getByText('Asociada')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Quitar' })).not.toBeNull()
  })

  it('filters, selects, and asks for collection-scoped detach confirmation', async () => {
    window.location.hash = '#' + `/collections/${collectionId}`
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/collections')) return Response.json({ items: [{ id: collectionId, latestRevision: null }] })
      if (input.endsWith(`/collections/${collectionId}`)) return Response.json({ id: collectionId, latestRevision: null, invoices: [{ id: activityId, fileName: 'IVA-septiembre.xml', createdAt: '2026-09-18T00:00:00.000Z' }, { id: profileId, fileName: 'IR-anual.xml', createdAt: '2026-09-18T00:00:00.000Z' }], runs: [] })
      if (input.endsWith('/activities') || input.endsWith('/profiles') || input.endsWith('/connections') || input.endsWith('/runs') || input.endsWith('/invoices')) return Response.json({ items: [] })
      if (input.endsWith('/rulesets')) return Response.json({ items: [] })
      return new Response(null, { status: 404 })
    }))
    render(<MantineProvider><LocalViewer /></MantineProvider>)
    expect(await screen.findByText('IVA-septiembre.xml')).not.toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Filtrar facturas de la colección' }), { target: { value: 'anual' } })
    expect(screen.queryByText('IVA-septiembre.xml')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todas las facturas visibles' }))
    expect(screen.getByText('1 seleccionada(s)')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar seleccionadas' }))
    expect(await screen.findByRole('dialog', { name: 'Quitar facturas de la colección' })).not.toBeNull()
    expect(screen.getByText(/seguirán disponibles en la biblioteca local/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quitar facturas de la colección' })).toBeNull())
  })
})
