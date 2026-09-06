// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  AnalysisHistoryDrawer,
  getAnalysisPurposeLabel,
  getAnalysisRunStatusCopy,
} from '../analysis-history-drawer'

const useTRPCMock = vi.hoisted(() => vi.fn())

vi.mock('#/integrations/trpc/react', () => ({ useTRPC: useTRPCMock }))

const period = {
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-01-31T00:00:00.000Z'),
}

function createRun(
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked',
) {
  return {
    id: `run-${status}`,
    status,
    blockCode: status === 'blocked' ? 'MISSING_CONTEXT' : null,
    blockMessage:
      status === 'blocked' ? 'Configura el contexto antes de continuar.' : null,
    provider: 'OPENAI',
    modelId: 'gpt-4.1-mini',
    promptVersion: 'tax-analysis-1',
    createdAt: new Date('2026-09-05T12:00:00.000Z'),
    completedAt:
      status === 'completed' ? new Date('2026-09-05T12:01:00.000Z') : null,
    invoiceCount: 2,
    executionMode: 'real' as 'real' | 'smoke',
    snapshotStatus: 'available' as const,
    purpose: 'vat_credit',
    period,
    results: [],
  }
}

function createAvailableResult(
  purpose: 'vat_credit' | 'business_income_tax' | 'personal_expenses',
  classification: 'eligible' | 'ineligible' | 'needs_review' = 'eligible',
) {
  const base = {
    classification,
    reasoning: 'La documentación disponible permite esta orientación.',
    uncertainties: ['Confirma el comprobante original antes de declarar.'],
    advisoryNotice:
      'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.',
    references: {
      official: [{ articleOrSection: 'Art. 45' }],
      user: [{ name: 'Guía de respaldo' }],
    },
  }

  switch (purpose) {
    case 'vat_credit':
      return {
        purpose,
        classification,
        createdAt: new Date('2026-09-05T12:01:00.000Z'),
        status: 'available' as const,
        result: {
          ...base,
          purpose,
          invoiceVatAmount: 12,
          potentialCreditableVatAmount: 9,
          creditablePercentage: 75,
          creditType: 'partial' as const,
          proportionalityRequired: true,
          missingEvidence: ['Verifica el destino del gasto.'],
        },
      }
    case 'business_income_tax':
      return {
        purpose,
        classification,
        createdAt: new Date('2026-09-05T12:01:00.000Z'),
        status: 'available' as const,
        result: {
          ...base,
          purpose,
          businessUsePercentage: 80,
          potentialExpenseAmount: 120,
          mixedUseDetected: true,
          substantiationIssues: ['Relaciona el gasto con la actividad.'],
          missingEvidence: [],
        },
      }
    case 'personal_expenses':
      return {
        purpose,
        classification,
        createdAt: new Date('2026-09-05T12:01:00.000Z'),
        status: 'available' as const,
        result: {
          ...base,
          purpose,
          personalExpenseCategory: 'Salud',
          potentialEligibleAmount: 48.5,
          beneficiaryRelationship: 'Titular',
          missingEvidence: [],
        },
      }
  }
}

function createDetail(
  status: 'completed' | 'failed' | 'blocked',
  results: Array<ReturnType<typeof createAvailableResult>> = [],
) {
  return {
    ...createRun(status),
    results,
    frozenContext: {
      status: 'available' as const,
      execution: { mode: 'real' as const },
      context: { revision: 1, purpose: 'vat_credit', period },
      ruleset: { version: 2 },
      rawInput: 'contenido-super-secreto',
    },
  }
}

function setTrpcResponses({
  runs = [createRun('completed')],
  detail = createDetail('completed'),
  pending = false,
}: {
  runs?: Array<ReturnType<typeof createRun>>
  detail?: ReturnType<typeof createDetail>
  pending?: boolean
} = {}) {
  useTRPCMock.mockReturnValue({
    collections: {
      listAnalysisRunHistory: {
        queryOptions: (input: { collectionId: string; cursor?: unknown }) => ({
          queryKey: ['history', input.collectionId, input.cursor ?? 'first'],
          queryFn: async () =>
            pending
              ? await new Promise<never>(() => undefined)
              : { items: runs, nextCursor: null },
        }),
      },
      getAnalysisRunDetail: {
        queryOptions: (input: { collectionId: string; runId: string }) => ({
          queryKey: ['detail', input.collectionId, input.runId],
          queryFn: async () => detail,
        }),
      },
    },
  })
}

function renderDrawer({
  collectionId = '11111111-1111-4111-8111-111111111111',
}: {
  collectionId?: string
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const props = {
    collectionId,
    collectionName: 'Enero 2026',
    isMobile: false,
    opened: true,
    onClose: vi.fn(),
    onOpenGuide: vi.fn(),
  }
  const view = render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <AnalysisHistoryDrawer {...props} />
      </QueryClientProvider>
    </MantineProvider>,
  )

  return {
    ...view,
    rerenderForCollection(nextCollectionId: string) {
      view.rerender(
        <MantineProvider>
          <QueryClientProvider client={queryClient}>
            <AnalysisHistoryDrawer {...props} collectionId={nextCollectionId} />
          </QueryClientProvider>
        </MantineProvider>,
      )
    },
  }
}

describe('AnalysisHistoryDrawer', () => {
  beforeAll(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('renders the loading state', () => {
    setTrpcResponses({ pending: true })
    renderDrawer()

    expect(screen.getByLabelText('Cargando historial de análisis')).toBeTruthy()
  })

  it('renders an actionable empty state', async () => {
    setTrpcResponses({ runs: [] })
    renderDrawer()

    expect(await screen.findByText('Aún no hay ejecuciones')).toBeTruthy()
    expect(
      screen.getByText(/Configura el contexto y analiza facturas/i),
    ).toBeTruthy()
  })

  it('renders a blocked run with its safe action message', async () => {
    setTrpcResponses({
      runs: [createRun('blocked')],
      detail: createDetail('blocked'),
    })
    renderDrawer()

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )

    expect(await screen.findByText('Acción necesaria')).toBeTruthy()
    expect(
      screen.getByText('Configura el contexto antes de continuar.'),
    ).toBeTruthy()
    expect(screen.queryByText('contenido-super-secreto')).toBeNull()
  })

  it('renders recovery guidance instead of a failed-run internal error', async () => {
    setTrpcResponses({
      runs: [createRun('failed')],
      detail: createDetail('failed'),
    })
    renderDrawer()

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )

    expect(await screen.findByText('Revisa la configuración')).toBeTruthy()
    expect(
      screen.getByText(
        'Configura el contexto y la conexión antes de iniciar otra ejecución.',
      ),
    ).toBeTruthy()
  })

  it('renders a completed run summary', async () => {
    setTrpcResponses()
    renderDrawer()

    expect(await screen.findByText('Completado')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )

    expect(
      await screen.findByText(
        'El análisis terminó y sus resultados están disponibles.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('Ruleset oficial')).toBeTruthy()
  })

  it('labels smoke executions as simulated and non-fiscal', async () => {
    setTrpcResponses({
      runs: [{ ...createRun('completed'), executionMode: 'smoke' }],
      detail: { ...createDetail('completed'), executionMode: 'smoke' },
    })
    renderDrawer()

    expect(await screen.findByText('Simulado')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )
    expect(await screen.findByText('Ejecución simulada')).toBeTruthy()
    expect(screen.getByText(/sin consultar al proveedor/i)).toBeTruthy()
  })

  it.each([
    ['vat_credit', 'Tipo de crédito de IVA'],
    ['business_income_tax', 'Uso estimado para la actividad'],
    ['personal_expenses', 'Categoría de gasto personal'],
  ] as const)(
    'renders the specialized %s result inside the same drawer',
    async (purpose, fieldLabel) => {
      const result = createAvailableResult(purpose)
      setTrpcResponses({
        detail: createDetail('completed', [result]),
      })
      renderDrawer()

      fireEvent.click(
        await screen.findByRole('button', {
          name: /Ver resumen del análisis Declaración de IVA/i,
        }),
      )
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Ver resultado de la factura 1',
        }),
      )

      expect(await screen.findByText(fieldLabel)).toBeTruthy()
      expect(screen.getByText('Resultado orientativo')).toBeTruthy()
      expect(screen.getByText(/Fuente oficial.*Art\. 45/)).toBeTruthy()
    },
  )

  it('makes a needs-review result actionable without presenting it as final', async () => {
    const result = createAvailableResult('business_income_tax', 'needs_review')
    setTrpcResponses({ detail: createDetail('completed', [result]) })
    renderDrawer()

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ver resultado de la factura 1',
      }),
    )

    expect(await screen.findByText('Revisión necesaria')).toBeTruthy()
    expect(
      screen.getByText(
        'Revisa la documentación indicada antes de tomar una decisión fiscal.',
      ),
    ).toBeTruthy()
  })

  it('returns from an invoice result to its run summary', async () => {
    const result = createAvailableResult('personal_expenses')
    setTrpcResponses({ detail: createDetail('completed', [result]) })
    renderDrawer()

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ver resultado de la factura 1',
      }),
    )
    await screen.findByText('Categoría de gasto personal')

    fireEvent.click(
      screen.getByRole('button', { name: 'Volver al resumen del análisis' }),
    )

    expect(await screen.findByText('Resultados por factura')).toBeTruthy()
    expect(screen.queryByText('Categoría de gasto personal')).toBeNull()
  })

  it('does not render internal identifiers or hashes from the result projection', async () => {
    const result = createAvailableResult('vat_credit')
    setTrpcResponses({ detail: createDetail('completed', [result]) })
    renderDrawer()

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ver resultado de la factura 1',
      }),
    )
    await screen.findByText('Tipo de crédito de IVA')

    expect(screen.queryByText(/11111111-1111-4111/i)).toBeNull()
    expect(screen.queryByText(/contenido-super-secreto/i)).toBeNull()
  })

  it('resets selection when the collection changes', async () => {
    setTrpcResponses()
    const view = renderDrawer()

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    )
    await screen.findByText('Ruleset oficial')

    view.rerenderForCollection('22222222-2222-4222-8222-222222222222')

    expect(
      await screen.findByRole('button', {
        name: /Ver resumen del análisis Declaración de IVA/i,
      }),
    ).toBeTruthy()
    expect(screen.queryByText('Ruleset oficial')).toBeNull()
  })

  it('keeps the approved safe labels stable', () => {
    expect(getAnalysisRunStatusCopy('blocked')).toContain('no llamó al modelo')
    expect(getAnalysisPurposeLabel('vat_credit')).toBe('Declaración de IVA')
  })
})
