// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
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
          return Response.json({
            items: [
              {
                id: 'ec-sri-lrti',
                title: 'Ley tributaria local',
                issuer: 'SRI',
                jurisdiction: 'EC',
                sourceKind: 'law',
                officialUrl: null,
                resolvedUrl: null,
                contentHash: 'sha256:test',
                effectiveFrom: '2026-01-01',
                effectiveTo: null,
                reviewStatus: 'reviewed',
                sectionCount: 1,
              },
            ],
          })
        if (input.includes('/official-sources/'))
          return Response.json({
            id: 'ec-sri-lrti',
            title: 'Ley tributaria local',
            issuer: 'SRI',
            jurisdiction: 'EC',
            sourceKind: 'law',
            officialUrl: null,
            resolvedUrl: null,
            contentHash: 'sha256:test',
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            reviewStatus: 'reviewed',
            sectionCount: 1,
            fragments: [],
            ruleset: {
              id: 'ec-sri-2026.3',
              version: '3',
              jurisdiction: 'EC',
              reviewStatus: 'local-snapshot',
            },
          })
        if (input.endsWith('/library/summary'))
          return Response.json({
            invoiceCount: 0,
            collectionCount: 1,
            profileCount: 1,
            activityCount: 1,
            runCount: 0,
            ruleset: {
              id: 'ec-sri-2026.3',
              version: '3',
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          })
        if (input.endsWith('/runs')) return Response.json({ items: [] })
        if (input.endsWith('/invoices')) return Response.json({ items: [] })
        if (input.endsWith('/activities'))
          return Response.json({
            items: [
              {
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
              },
            ],
          })
        if (input.endsWith('/profiles'))
          return Response.json({
            items: [
              {
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
              },
            ],
          })
        if (input.endsWith('/collections')) {
          if (init?.method === 'POST')
            return Response.json(
              {
                id: collectionId,
                name: 'Gastos personales',
                year: 2026,
                description: null,
                invoiceCount: 0,
                latestRevision: null,
              },
              { status: 201 },
            )
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Colección local sin nombre',
                year: 2026,
                description: null,
                invoiceCount: 0,
                latestRevision: null,
              },
            ],
          })
        }
        if (input.includes('/collections/') && input.endsWith('/revisions'))
          return Response.json(
            {
              id: '550e8400-e29b-41d4-a716-446655440005',
              collectionId,
              revision: 1,
              createdAt: '2026-09-18T00:00:00.000Z',
            },
            { status: 201 },
          )
        if (input.includes('/revisions'))
          return Response.json({ id: activityRevisionId })
        return new Response(null, { status: 404 })
      }),
    )
  })

  it('shows loading before local profile data resolves, then its empty state', async () => {
    window.location.hash = '#' + '/profiles'
    let resolveActivities: (value: Response) => void = () => {}
    let resolveProfiles: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/activities'))
          return new Promise<Response>((resolve) => {
            resolveActivities = resolve
          })
        if (input.endsWith('/profiles'))
          return new Promise<Response>((resolve) => {
            resolveProfiles = resolve
          })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(screen.queryByText('Aún no tienes actividades')).toBeNull()
    expect(screen.queryByText('Aún no tienes perfiles')).toBeNull()

    resolveActivities(Response.json({ items: [] }))
    resolveProfiles(Response.json({ items: [] }))
    expect(await screen.findByText('Aún no tienes actividades')).not.toBeNull()
    expect(screen.getByText('Aún no tienes perfiles')).not.toBeNull()
  })

  it('reports a profile-data loading error after requests settle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/activities'))
          return new Response(null, { status: 503 })
        if (input.endsWith('/profiles')) return Response.json({ items: [] })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      await screen.findByText(
        'No se pudieron cargar los perfiles y actividades locales.',
      ),
    ).not.toBeNull()
    expect(screen.queryByText('Cargando actividades locales…')).toBeNull()
    expect(screen.queryByText('Cargando perfiles locales…')).toBeNull()
  })

  it('renders a Firebase-free local XML workflow and configures global GPU hosts in settings', async () => {
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )
    expect(
      await screen.findByRole('heading', { name: 'Colecciones' }),
    ).not.toBeNull()
    expect(screen.getByText(/Sólo se importan comprobantes XML/)).not.toBeNull()
    fireEvent.click(screen.getAllByText('Configuración').at(0)!)
    expect(await screen.findByText('Conexiones Local-GPU')).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Guardar conexión' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar conexión' }))
  })

  it('uses the web-app navigation order and canonical local hash fallback', async () => {
    window.location.hash = '#' + '/unknown-route'
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Colecciones' }),
    ).not.toBeNull()
    expect(window.location.hash).toBe('#' + '/collections')
    expect(
      [
        'Colecciones',
        'Perfiles y actividades',
        'Configuración',
        'Fuentes oficiales',
        'Biblioteca local',
      ].map((label) => screen.getAllByText(label).at(0)?.textContent),
    ).toEqual([
      'Colecciones',
      'Perfiles y actividades',
      'Configuración',
      'Fuentes oficiales',
      'Biblioteca local',
    ])

    fireEvent.click(screen.getAllByText('Perfiles y actividades').at(0)!)
    expect(
      (
        await screen.findAllByRole('heading', {
          name: 'Perfiles y actividades',
        })
      ).length,
    ).toBeGreaterThan(0)
    expect(
      document.querySelector('[aria-current="page"]')?.textContent,
    ).toContain('Perfiles y actividades')
  })

  it('keeps a failed collection-create draft open for correction', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input.endsWith('/collections') && init?.method === 'POST')
          return new Response(null, { status: 500 })
        if (input.endsWith('/collections')) return Response.json({ items: [] })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices') ||
          input.endsWith('/activities') ||
          input.endsWith('/profiles')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva colección' }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Nueva colección local',
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nombre' }), {
      target: { value: 'Borrador local' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Crear colección' }),
    )
    expect(
      await screen.findByText('No se pudo crear la colección local.'),
    ).not.toBeNull()
    expect(within(dialog).getByDisplayValue('Borrador local')).not.toBeNull()
  })

  it('keeps failed collection metadata and context dialogs open with their drafts', async () => {
    window.location.hash = '#' + `/collections/${collectionId}`
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (
          input.endsWith(`/collections/${collectionId}`) &&
          init?.method === 'PATCH'
        )
          return new Response(null, { status: 500 })
        if (
          input.includes(`/collections/${collectionId}/revisions`) &&
          init?.method === 'POST'
        )
          return new Response(null, { status: 500 })
        if (input.endsWith('/collections'))
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Gastos locales',
                year: 2026,
                description: 'Original',
                invoiceCount: 0,
                latestRevision: {
                  id: '550e8400-e29b-41d4-a716-446655440005',
                  collectionId,
                  revision: 1,
                  createdAt: '2026-09-18T00:00:00.000Z',
                  purpose: 'personal_expenses',
                  period: { startDate: '2026-01-01', endDate: '2026-01-31' },
                  taxpayerProfileRevisionId: profileRevisionId,
                  activityRevisionIds: [],
                  notes: 'Contexto original',
                },
              },
            ],
          })
        if (input.endsWith(`/collections/${collectionId}`))
          return Response.json({
            id: collectionId,
            name: 'Gastos locales',
            year: 2026,
            description: 'Original',
            latestRevision: null,
            invoices: [],
            runs: [],
          })
        if (input.endsWith('/activities')) return Response.json({ items: [] })
        if (input.endsWith('/profiles'))
          return Response.json({
            items: [
              {
                id: profileId,
                latestRevision: {
                  id: profileRevisionId,
                  taxpayerProfileId: profileId,
                  revision: 1,
                  createdAt: '2026-09-17T00:00:00.000Z',
                  displayName: 'Perfil local',
                  activityRevisionIds: [],
                },
              },
            ],
          })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Editar datos' }))
    const metadata = await screen.findByRole('dialog', {
      name: 'Editar datos de colección',
    })
    fireEvent.change(
      within(metadata).getByRole('textbox', { name: 'Nombre' }),
      { target: { value: 'Borrador de metadatos' } },
    )
    fireEvent.click(
      within(metadata).getByRole('button', { name: 'Guardar datos' }),
    )
    expect(
      await screen.findByText(
        'No se pudieron actualizar los datos de la colección local.',
      ),
    ).not.toBeNull()
    expect(
      within(metadata).getByDisplayValue('Borrador de metadatos'),
    ).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Contexto' }))
    const context = await screen.findByRole('dialog', {
      name: 'Configurar contexto de análisis',
    })
    fireEvent.change(
      within(context).getByRole('textbox', { name: 'Notas (opcional)' }),
      { target: { value: 'Borrador de contexto' } },
    )
    fireEvent.click(
      within(context).getByRole('button', { name: 'Guardar contexto' }),
    )
    expect(
      await within(context).findByText(
        'No se pudo guardar el contexto de la colección local.',
      ),
    ).not.toBeNull()
    expect(
      within(context).getByDisplayValue('Borrador de contexto'),
    ).not.toBeNull()
  })

  it('ignores a slower collection history response after switching scopes', async () => {
    const secondCollectionId = '550e8400-e29b-41d4-a716-446655440007'
    let resolveFirstHistory: (response: Response) => void = () => {}
    const run = (id: string, collection: string, name: string) => ({
      id,
      collectionId: collection,
      collectionName: name,
      invoiceId: activityId,
      fileName: `${name}.xml`,
      status: 'completed',
      readAt: null,
      provider: 'Local-GPU',
      apiFlavor: 'openai-like',
      model: 'bonsai',
      purpose: 'personal_expenses',
      period: null,
      contextRevision: 1,
      ruleset: null,
      timing: {
        createdAt: '2026-10-02T18:30:00.000Z',
        startedAt: null,
        terminalAt: null,
        durationMs: null,
      },
      error: null,
      progress: null,
      eventCount: 0,
    })
    window.location.hash = '#' + `/collections/${collectionId}`
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/collections'))
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Primera',
                year: 2026,
                description: null,
                invoiceCount: 0,
                latestRevision: null,
              },
              {
                id: secondCollectionId,
                name: 'Segunda',
                year: 2026,
                description: null,
                invoiceCount: 0,
                latestRevision: null,
              },
            ],
          })
        if (input.endsWith(`/collections/${collectionId}/runs`))
          return new Promise<Response>((resolve) => {
            resolveFirstHistory = resolve
          })
        if (input.endsWith(`/collections/${secondCollectionId}/runs`))
          return Response.json({
            items: [
              run(
                '550e8400-e29b-41d4-a716-446655440008',
                secondCollectionId,
                'Segunda',
              ),
            ],
          })
        if (input.endsWith(`/collections/${collectionId}`))
          return Response.json({
            id: collectionId,
            name: 'Primera',
            year: 2026,
            description: null,
            latestRevision: null,
            invoices: [],
            runs: [],
          })
        if (input.endsWith(`/collections/${secondCollectionId}`))
          return Response.json({
            id: secondCollectionId,
            name: 'Segunda',
            year: 2026,
            description: null,
            latestRevision: null,
            invoices: [],
            runs: [],
          })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices') ||
          input.endsWith('/activities') ||
          input.endsWith('/profiles')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Historial' }))
    window.location.hash = '#' + `/collections/${secondCollectionId}`
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await screen.findByRole('heading', { name: 'Segunda' })
    fireEvent.click(screen.getByRole('button', { name: 'Historial' }))
    expect(
      await screen.findByRole('button', { name: 'Abrir Segunda' }),
    ).not.toBeNull()
    await act(async () => {
      resolveFirstHistory(
        Response.json({
          items: [
            run(
              '550e8400-e29b-41d4-a716-446655440009',
              collectionId,
              'Primera',
            ),
          ],
        }),
      )
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: 'Abrir Segunda' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir Primera' })).toBeNull()
  })

  it('does not show stale run details after closing or opening another run', async () => {
    const firstRunId = '550e8400-e29b-41d4-a716-446655440010'
    const secondRunId = '550e8400-e29b-41d4-a716-446655440011'
    let resolveFirstDetail: (response: Response) => void = () => {}
    let resolveSecondDetail: (response: Response) => void = () => {}
    let resolveClosedDetail: (response: Response) => void = () => {}
    let firstDetailRequests = 0
    const run = (id: string, fileName: string) => ({
      id,
      collectionId: null,
      collectionName: null,
      invoiceId: activityId,
      fileName,
      status: 'completed',
      readAt: null,
      provider: 'Local-GPU',
      apiFlavor: 'openai-like',
      model: 'bonsai',
      purpose: 'personal_expenses',
      period: null,
      contextRevision: 1,
      ruleset: null,
      timing: {
        createdAt: '2026-10-02T18:30:00.000Z',
        startedAt: null,
        terminalAt: null,
        durationMs: null,
      },
      error: null,
      progress: null,
      eventCount: 0,
    })
    const first = run(firstRunId, 'primera.xml')
    const second = run(secondRunId, 'segunda.xml')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith(`/runs/${firstRunId}`))
          return new Promise<Response>((resolve) => {
            firstDetailRequests += 1
            if (firstDetailRequests === 1) resolveFirstDetail = resolve
            else resolveClosedDetail = resolve
          })
        if (input.endsWith(`/runs/${secondRunId}`))
          return new Promise<Response>((resolve) => {
            resolveSecondDetail = resolve
          })
        if (
          input.endsWith(`/runs/${firstRunId}/read`) ||
          input.endsWith(`/runs/${secondRunId}/read`)
        )
          return Response.json({ changed: 1 })
        if (input.endsWith('/runs'))
          return Response.json({ items: [first, second] })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/invoices') ||
          input.endsWith('/activities') ||
          input.endsWith('/profiles')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        if (input.endsWith('/collections')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir centro de ejecuciones: 2 sin leer',
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir primera.xml' }),
    )
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/v1/runs/${firstRunId}`,
        expect.anything(),
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir segunda.xml' }))
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/v1/runs/${secondRunId}`,
        expect.anything(),
      ),
    )
    await act(async () => {
      resolveSecondDetail(
        Response.json({
          ...second,
          events: [
            {
              id: '550e8400-e29b-41d4-a716-446655440012',
              runId: secondRunId,
              status: 'completed',
              message: 'Detalle de segunda ejecución',
              createdAt: '2026-10-02T18:31:00.000Z',
            },
          ],
        }),
      )
      await Promise.resolve()
    })
    expect(
      await screen.findByText('Detalle de segunda ejecución'),
    ).not.toBeNull()
    await act(async () => {
      resolveFirstDetail(
        Response.json({
          ...first,
          events: [
            {
              id: '550e8400-e29b-41d4-a716-446655440013',
              runId: firstRunId,
              status: 'completed',
              message: 'Detalle de primera ejecución',
              createdAt: '2026-10-02T18:31:00.000Z',
            },
          ],
        }),
      )
      await Promise.resolve()
    })
    expect(screen.getByText('Detalle de segunda ejecución')).not.toBeNull()
    expect(screen.queryByText('Detalle de primera ejecución')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir primera.xml' }))
    await waitFor(() => expect(firstDetailRequests).toBe(2))
    fireEvent.click(
      screen.getByRole('button', { name: 'Cerrar ejecuciones locales' }),
    )
    await act(async () => {
      resolveClosedDetail(
        Response.json({
          ...first,
          events: [
            {
              id: '550e8400-e29b-41d4-a716-446655440014',
              runId: firstRunId,
              status: 'completed',
              message: 'Detalle cerrado',
              createdAt: '2026-10-02T18:31:00.000Z',
            },
          ],
        }),
      )
      await Promise.resolve()
    })
    expect(
      screen.queryByRole('heading', { name: 'Detalle de ejecución local' }),
    ).toBeNull()
    expect(screen.queryByText('Detalle cerrado')).toBeNull()
  })

  it('keeps one page h1 across local navigation and collection detail', async () => {
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )
    await screen.findByRole('heading', { name: 'Colecciones' })
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    for (const label of [
      'Perfiles y actividades',
      'Configuración',
      'Fuentes oficiales',
      'Biblioteca local',
    ]) {
      fireEvent.click(screen.getAllByText(label).at(0)!)
      await screen.findByRole('heading', { name: label })
      expect(document.querySelectorAll('h1')).toHaveLength(1)
    }
    fireEvent.click(screen.getAllByText('Colecciones').at(0)!)
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir colección Colección local sin nombre',
      }),
    )
    await screen.findByRole('heading', { name: 'Colección local sin nombre' })
    expect(document.querySelectorAll('h1')).toHaveLength(1)
  })

  it('opens a failed local run with its recorded cause from the history drawer', async () => {
    const runId = '550e8400-e29b-41d4-a716-446655440099'
    const eventId = '550e8400-e29b-41d4-a716-446655440098'
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        const run = {
          id: runId,
          collectionId,
          collectionName: 'Gastos locales',
          invoiceId: activityId,
          fileName: 'factura.xml',
          status: 'failed',
          readAt: null,
          provider: 'Local-GPU',
          apiFlavor: 'openai-like',
          model: 'bonsai',
          purpose: 'personal_expenses',
          period: { startDate: '2026-10-01', endDate: '2026-10-31' },
          contextRevision: 2,
          ruleset: { id: 'ec-sri-2026.3', version: '3' },
          timing: {
            createdAt: '2026-10-02T18:30:00.000Z',
            startedAt: '2026-10-02T18:30:01.000Z',
            terminalAt: '2026-10-02T18:30:02.000Z',
            durationMs: 1000,
          },
          error: 'El servidor Local-GPU rechazó la solicitud.',
          progress: null,
          eventCount: 1,
        }
        if (input.endsWith(`/runs/${runId}`))
          return Response.json({
            ...run,
            events: [
              {
                id: eventId,
                runId,
                status: 'failed',
                message: 'El servidor Local-GPU rechazó la solicitud.',
                createdAt: '2026-10-02T18:30:02.000Z',
              },
            ],
          })
        if (input.endsWith('/runs')) return Response.json({ items: [run] })
        if (input.endsWith(`/runs/${runId}/read`) && init?.method === 'PATCH')
          return Response.json({ changed: 1 })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/invoices') ||
          input.endsWith('/activities') ||
          input.endsWith('/profiles')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        if (input.endsWith('/collections'))
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Gastos locales',
                year: 2026,
                description: null,
                invoiceCount: 0,
                latestRevision: null,
              },
            ],
          })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Abrir centro de ejecuciones: 1 sin leer',
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Abrir Gastos locales' }),
    )

    expect(
      (
        await screen.findAllByText(
          'El servidor Local-GPU rechazó la solicitud.',
        )
      ).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('La ejecución registró un error')).not.toBeNull()
    expect(screen.getByText('Contexto congelado')).not.toBeNull()
    expect(screen.queryByText('Resultado de la factura analizada')).toBeNull()
  })

  it('renders latest revisions and sends an activity revision through the local daemon', async () => {
    window.location.hash = '#' + '/profiles'
    const fetchMock = vi.mocked(fetch)
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      (await screen.findAllByText('Desarrollo local')).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/Perfil local/).length).toBeGreaterThan(0)
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Crear nueva revisión' })[0],
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Guardar revisión' }),
    )

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
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    await screen.findByText(/Perfil local/)
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Crear nueva revisión' })[1],
    )
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Nombre del perfil' }),
      { target: { value: 'Perfil actualizado' } },
    )
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Nombre del perfil',
        }) as HTMLInputElement
      ).value,
    ).toBe('Perfil actualizado')
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Guardar revisión' }),
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/profiles/${profileId}/revisions`,
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  }, 15_000)

  it('keeps an invalid local profile on the first step and never posts it', async () => {
    window.location.hash = '#' + '/profiles'
    const fetchMock = vi.mocked(fetch)
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    await screen.findByText(/Perfil local/)
    fireEvent.click(screen.getByRole('button', { name: 'Agregar perfil' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Ingresa un nombre para el perfil.'),
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Continuar' })).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/\/profiles(?:\/|$)/),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows activity detail and linked local activities on revision cards', async () => {
    window.location.hash = '#' + '/profiles'
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(await screen.findByText('Servicios de desarrollo.')).not.toBeNull()
    expect(screen.getByText(/Actividades: Desarrollo local/)).not.toBeNull()
  })

  it('opens local profile guides and keeps profile creation available without a cloud eligibility gate', async () => {
    window.location.hash = '#' + '/profiles'
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ver guía sobre actividades económicas',
      }),
    )
    expect(
      await screen.findByRole('dialog', {
        name: 'Guía de actividades económicas',
      }),
    ).not.toBeNull()
    fireEvent.click(
      screen
        .getByRole('dialog', { name: 'Guía de actividades económicas' })
        .querySelector('button')!,
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver guía sobre perfiles tributarios',
      }),
    )
    expect(
      await screen.findByText(
        /puedes crear un perfil aunque todavía no tengas RUC/i,
      ),
    ).not.toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Agregar perfil' })
        .hasAttribute('disabled'),
    ).toBe(false)
  })

  it('mounts the deep-linked local sections without rendering collection content everywhere', async () => {
    window.location.hash = '#' + '/official-sources'
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      (await screen.findAllByRole('heading', { name: 'Fuentes oficiales' }))
        .length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(
        'Snapshot local de solo lectura incluido con este visor. No se consulta al SRI mientras navegas estas fuentes.',
      ),
    ).not.toBeNull()
    expect(screen.queryByText('Importar factura')).toBeNull()
    expect(screen.queryByText('Conexión local-GPU')).toBeNull()
  })

  it('shows local source metadata, fragment tags, and its dedicated detail state', async () => {
    window.location.hash = '#' + '/official-sources'
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/official-sources'))
          return Response.json({
            items: [
              {
                id: 'ec-sri-lrti',
                title: 'Ley tributaria local',
                issuer: 'SRI',
                jurisdiction: 'EC',
                sourceKind: 'law',
                officialUrl: null,
                resolvedUrl: null,
                contentHash: 'sha256:test',
                effectiveFrom: '2026-01-01',
                effectiveTo: null,
                reviewStatus: 'reviewed',
                sectionCount: 1,
              },
            ],
          })
        if (input.endsWith('/official-sources/ec-sri-lrti'))
          return Response.json({
            id: 'ec-sri-lrti',
            title: 'Ley tributaria local',
            issuer: 'SRI',
            jurisdiction: 'EC',
            sourceKind: 'law',
            officialUrl: null,
            resolvedUrl: null,
            contentHash: 'sha256:test',
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            reviewStatus: 'reviewed',
            sectionCount: 1,
            fragments: [
              {
                id: 'art-1',
                articleOrSection: 'Artículo 1',
                effectiveFrom: '2026-01-01',
                effectiveTo: null,
                purposes: ['personal_expenses'],
                taxRegimes: ['general'],
                reviewStatus: 'reviewed',
                contentMarkdown: 'Primera línea\nSegunda línea',
                sourcePages: [4],
              },
            ],
            ruleset: {
              id: 'ec-sri-2026.3',
              version: '3',
              jurisdiction: 'EC',
              reviewStatus: 'local-snapshot',
            },
          })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices') ||
          input.endsWith('/activities') ||
          input.endsWith('/profiles') ||
          input.endsWith('/collections')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Ver secciones' }),
    )
    expect(await screen.findByText('Hash: sha256:test')).not.toBeNull()
    expect(screen.getByText('Gastos personales')).not.toBeNull()
    expect(screen.getByText('Régimen general')).not.toBeNull()
    expect(
      screen.getByText(
        (_, element) => element?.textContent === 'Primera línea\nSegunda línea',
      ),
    ).not.toBeNull()
  })

  it('distinguishes a successfully empty local library and describes its non-destructive boundary', async () => {
    window.location.hash = '#' + '/library'
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/library/summary'))
          return Response.json({
            invoiceCount: 0,
            collectionCount: 0,
            profileCount: 0,
            activityCount: 0,
            runCount: 0,
            ruleset: null,
          })
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices') ||
          input.endsWith('/activities') ||
          input.endsWith('/profiles') ||
          input.endsWith('/collections')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      await screen.findByText('Tu biblioteca local está vacía'),
    ).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver guía sobre biblioteca local' }),
    )
    expect(
      await screen.findByText(
        /No expone rutas de disco, no sincroniza con la cloud/i,
      ),
    ).not.toBeNull()
  })

  it('opens the mobile drawer control and closes it after local navigation', async () => {
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    const navigationButton = screen.getByRole('button', {
      name: 'Abrir navegación',
    })
    expect(navigationButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(navigationButton)
    expect(navigationButton.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getAllByText('Biblioteca local').at(0)!)
    expect(navigationButton.getAttribute('aria-expanded')).toBe('false')
  })

  it('renders a collection without a context revision safely and creates another only through Hono', async () => {
    const fetchMock = vi.mocked(fetch)
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      await screen.findByRole('button', {
        name: 'Abrir colección Colección local sin nombre',
      }),
    ).not.toBeNull()
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
    expect(await screen.findByText('Contexto pendiente')).not.toBeNull()
  }, 15_000)

  it('selects the collection identified by a local deep link after loading multiple collections', async () => {
    const secondCollectionId = '550e8400-e29b-41d4-a716-446655440099'
    window.location.hash = '#' + `/collections/${secondCollectionId}`
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/collections'))
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Colección uno',
                year: 2026,
                description: null,
                invoiceCount: 0,
                latestRevision: null,
              },
              {
                id: secondCollectionId,
                name: 'Colección dos',
                year: 2026,
                description: null,
                invoiceCount: 0,
                latestRevision: null,
              },
            ],
          })
        if (input.endsWith(`/collections/${secondCollectionId}`))
          return Response.json({
            id: secondCollectionId,
            name: 'Colección dos',
            year: 2026,
            description: null,
            latestRevision: null,
            invoices: [],
            runs: [],
          })
        if (
          input.endsWith('/activities') ||
          input.endsWith('/profiles') ||
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )

    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(await screen.findByText('Contexto pendiente')).not.toBeNull()
    expect(window.location.hash).toBe(
      '#' + `/collections/${secondCollectionId}`,
    )
  })

  it('falls back safely when a local collection deep link does not exist', async () => {
    window.location.hash = '#' + '/collections/missing-local-collection'
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      await screen.findByText(
        'La colección local solicitada no existe en esta biblioteca.',
      ),
    ).not.toBeNull()
    expect(window.location.hash).toBe('#' + '/collections')
  })

  it('shows collection loading before resolving its empty state', async () => {
    let resolveCollections: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/collections'))
          return new Promise<Response>((resolve) => {
            resolveCollections = resolve
          })
        if (
          input.endsWith('/activities') ||
          input.endsWith('/profiles') ||
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(screen.getByText('Cargando colecciones locales…')).not.toBeNull()
    expect(screen.queryByText('No hay colecciones locales')).toBeNull()

    resolveCollections(Response.json({ items: [] }))
    expect(await screen.findByText('No hay colecciones locales')).not.toBeNull()
  })

  it('retries collection loading after a local Hono GET failure', async () => {
    let collectionRequests = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/collections')) {
          collectionRequests += 1
          return collectionRequests === 1
            ? new Response(null, { status: 503 })
            : Response.json({ items: [] })
        }
        if (
          input.endsWith('/activities') ||
          input.endsWith('/profiles') ||
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    expect(
      (
        await screen.findAllByText(
          'No se pudieron cargar las colecciones locales.',
        )
      ).length,
    ).toBeGreaterThan(0)
    fireEvent.click(
      screen.getByRole('button', { name: 'Reintentar colecciones' }),
    )
    expect(await screen.findByText('No hay colecciones locales')).not.toBeNull()
    expect(collectionRequests).toBe(2)
  })

  it('hydrates a selected collection context and posts its next revision only through Hono', async () => {
    window.location.hash = '#' + `/collections/${collectionId}`
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/collections'))
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Gastos locales',
                year: 2026,
                description: null,
                invoiceCount: 0,
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
              },
            ],
          })
        if (input.endsWith(`/collections/${collectionId}`))
          return Response.json({
            id: collectionId,
            name: 'Gastos locales',
            year: 2026,
            description: null,
            latestRevision: null,
            invoices: [],
            runs: [],
          })
        if (input.endsWith('/activities'))
          return Response.json({
            items: [
              {
                id: activityId,
                latestRevision: {
                  id: activityRevisionId,
                  activityId,
                  revision: 1,
                  createdAt: '2026-09-17T00:00:00.000Z',
                  displayName: 'Desarrollo local',
                },
              },
            ],
          })
        if (input.endsWith('/profiles'))
          return Response.json({
            items: [
              {
                id: profileId,
                latestRevision: {
                  id: profileRevisionId,
                  taxpayerProfileId: profileId,
                  revision: 1,
                  createdAt: '2026-09-17T00:00:00.000Z',
                  displayName: 'Perfil local',
                  activityRevisionIds: [activityRevisionId],
                },
              },
            ],
          })
        if (input.includes('/collections/') && input.endsWith('/revisions'))
          return Response.json(
            { id: '550e8400-e29b-41d4-a716-446655440006' },
            { status: 201 },
          )
        if (
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    const fetchMock = vi.mocked(fetch)
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Contexto' }))
    expect(await screen.findByDisplayValue('Contexto inicial')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contexto' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/collections/${collectionId}/revisions`,
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('renders collection-scoped invoices from the typed detail aggregate', async () => {
    window.location.hash = '#' + `/collections/${collectionId}`
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/collections'))
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Gastos locales',
                year: 2026,
                description: null,
                invoiceCount: 1,
                latestRevision: null,
              },
            ],
          })
        if (
          input.endsWith(`/collections/${collectionId}/invoices/${activityId}`)
        )
          return Response.json({
            id: activityId,
            fileName: 'IVA-septiembre.xml',
            issueDate: '2026-09-18',
            seller: {
              name: 'Proveedor local',
              identifier: '1790000000001',
              tradeName: null,
              address: null,
            },
            buyer: { name: 'Comprador local', identifier: null },
            totals: {
              subtotal: null,
              discount: null,
              tax: null,
              total: null,
              currency: null,
            },
            taxes: [],
            lineItems: [],
            latestAnalysis: null,
          })
        if (input.endsWith(`/collections/${collectionId}`))
          return Response.json({
            id: collectionId,
            name: 'Gastos locales',
            year: 2026,
            description: null,
            latestRevision: null,
            invoices: [
              {
                id: activityId,
                fileName: 'IVA-septiembre.xml',
                createdAt: '2026-09-18T00:00:00.000Z',
                latestAnalysis: {
                  runId: profileId,
                  purpose: 'personal_expenses',
                  classification: 'eligible',
                  payload: {
                    purpose: 'personal_expenses',
                    classification: 'eligible',
                    reasoning: 'Gasto personal con documentación suficiente.',
                    uncertainties: [],
                    missingEvidence: [],
                    potentialEligibleAmount: 48.5,
                  },
                  createdAt: '2026-09-18T00:00:00.000Z',
                },
              },
            ],
            runs: [],
          })
        if (
          input.endsWith('/activities') ||
          input.endsWith('/profiles') ||
          input.endsWith('/connections') ||
          input.endsWith('/runs')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/invoices')) return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )
    expect(await screen.findByText('IVA-septiembre.xml')).not.toBeNull()
    expect(screen.getByRole('table')).not.toBeNull()
    expect(screen.getByText('Asociada')).not.toBeNull()
    expect(screen.getByText('Aplicable')).not.toBeNull()
    expect(screen.getByText('$48,50')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
    expect(
      await screen.findByRole('dialog', { name: 'Detalle de factura' }),
    ).not.toBeNull()
    expect(screen.getByText('Sin análisis todavía')).not.toBeNull()
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Quitar' })).not.toBeNull()
  })

  it('filters, selects, and asks for collection-scoped detach confirmation', async () => {
    window.location.hash = '#' + `/collections/${collectionId}`
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input.endsWith('/collections'))
          return Response.json({
            items: [
              {
                id: collectionId,
                name: 'Gastos locales',
                year: 2026,
                description: null,
                invoiceCount: 2,
                latestRevision: null,
              },
            ],
          })
        if (input.endsWith(`/collections/${collectionId}`))
          return Response.json({
            id: collectionId,
            name: 'Gastos locales',
            year: 2026,
            description: null,
            latestRevision: null,
            invoices: [
              {
                id: activityId,
                fileName: 'IVA-septiembre.xml',
                createdAt: '2026-09-18T00:00:00.000Z',
                latestAnalysis: null,
              },
              {
                id: profileId,
                fileName: 'IR-anual.xml',
                createdAt: '2026-09-18T00:00:00.000Z',
                latestAnalysis: null,
              },
            ],
            runs: [],
          })
        if (
          input.endsWith('/activities') ||
          input.endsWith('/profiles') ||
          input.endsWith('/connections') ||
          input.endsWith('/runs') ||
          input.endsWith('/invoices')
        )
          return Response.json({ items: [] })
        if (input.endsWith('/rulesets')) return Response.json({ items: [] })
        return new Response(null, { status: 404 })
      }),
    )
    render(
      <MantineProvider>
        <LocalViewer />
      </MantineProvider>,
    )
    expect(await screen.findByText('IVA-septiembre.xml')).not.toBeNull()
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Filtrar facturas de la colección' }),
      { target: { value: 'anual' } },
    )
    expect(screen.queryByText('IVA-septiembre.xml')).toBeNull()
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Seleccionar todas las facturas visibles',
      }),
    )
    expect(screen.getByText('1 seleccionada(s)')).not.toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Quitar seleccionadas' }),
    )
    expect(
      await screen.findByRole('dialog', {
        name: 'Quitar facturas de la colección',
      }),
    ).not.toBeNull()
    expect(
      screen.getByText(/seguirán disponibles en la biblioteca local/),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: 'Quitar facturas de la colección',
        }),
      ).toBeNull(),
    )
  })
})
