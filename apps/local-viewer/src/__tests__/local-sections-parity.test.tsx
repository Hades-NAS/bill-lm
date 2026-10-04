// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LocalDaemonClient } from '../api'
import {
  LocalGpuSettingsSection,
  OfficialSourcesSection,
} from '../local-sections'

const firstConnection = {
  id: '550e8400-e29b-41d4-a716-446655440101',
  label: 'GPU de oficina',
  apiFlavor: 'openai-like' as const,
  baseUrl: 'http://127.0.0.1:1234/v1',
  model: 'qwen-local',
  isDefault: true,
  lastProbedAt: null,
  lastProbeError: null,
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}
const secondConnection = {
  ...firstConnection,
  id: '550e8400-e29b-41d4-a716-446655440102',
  label: 'GPU de respaldo',
  model: 'llama-local',
  isDefault: false,
}

function daemon(overrides: Partial<LocalDaemonClient> = {}) {
  return {
    listConnections: vi
      .fn()
      .mockResolvedValue([firstConnection, secondConnection]),
    updateConnection: vi.fn().mockResolvedValue(firstConnection),
    createConnection: vi.fn(),
    deleteConnection: vi.fn(),
    probeConnection: vi.fn(),
    listOfficialSources: vi.fn().mockResolvedValue([]),
    getOfficialSource: vi.fn(),
    ...overrides,
  } as unknown as LocalDaemonClient
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LocalGpuSettingsSection parity', () => {
  it('keeps probe feedback attributed to its row and preserves a fixed status slot', async () => {
    const pending = deferred<{ ok: boolean; message?: string | null }>()
    const client = daemon({
      probeConnection: vi.fn().mockReturnValue(pending.promise),
    })
    render(
      <MantineProvider>
        <LocalGpuSettingsSection client={client} />
      </MantineProvider>,
    )

    await screen.findByText('GPU de oficina')
    expect(screen.getAllByRole('status')).toHaveLength(2)
    fireEvent.click(
      screen.getByRole('button', { name: 'Probar GPU de oficina' }),
    )

    await screen.findByRole('status', { name: 'Probando conexión…' })
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(
      screen
        .getByRole('button', { name: 'Probar GPU de oficina' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Probar GPU de respaldo' })
        .hasAttribute('disabled'),
    ).toBe(false)
    expect(screen.queryByText('Agregar conexión local-GPU')).toBeNull()

    pending.resolve({ ok: false, message: 'Host sin respuesta' })
    await screen.findByRole('status', { name: 'Host sin respuesta' })
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('ignores a stale successful probe after execution fields are saved', async () => {
    const pending = deferred<{ ok: boolean; message?: string | null }>()
    const client = daemon({
      probeConnection: vi.fn().mockReturnValue(pending.promise),
    })
    render(
      <MantineProvider>
        <LocalGpuSettingsSection client={client} />
      </MantineProvider>,
    )

    await screen.findByText('GPU de oficina')
    fireEvent.click(
      screen.getByRole('button', { name: 'Probar GPU de oficina' }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]!)
    const dialog = await screen.findByRole('dialog', {
      name: 'Editar conexión Local-GPU',
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Modelo' }), {
      target: { value: 'modelo-nuevo' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Guardar cambios' }),
    )
    await waitFor(() =>
      expect(client.updateConnection).toHaveBeenCalledWith(
        firstConnection.id,
        expect.objectContaining({ model: 'modelo-nuevo' }),
      ),
    )

    pending.resolve({ ok: true, message: 'Conexión validada' })
    await waitFor(() =>
      expect(screen.queryByText('Conexión validada')).toBeNull(),
    )
    expect(screen.getAllByText('http://127.0.0.1:1234/v1')).toHaveLength(2)
    expect(screen.queryByText('Activa')).toBeNull()
  })
})

describe('OfficialSourcesSection parity', () => {
  it('shows local provenance, localized enums, and text-only source fragments', async () => {
    const client = daemon({
      listOfficialSources: vi.fn().mockResolvedValue([
        {
          id: 'source-1',
          title: 'Ley local',
          issuer: 'SRI',
          jurisdiction: 'EC',
          sourceKind: 'law',
          officialUrl: null,
          resolvedUrl: null,
          contentHash: null,
          effectiveFrom: null,
          effectiveTo: null,
          reviewStatus: 'reviewed',
          sectionCount: 1,
        },
      ]),
      getOfficialSource: vi.fn().mockResolvedValue({
        id: 'source-1',
        title: 'Ley local',
        issuer: 'SRI',
        jurisdiction: 'EC',
        sourceKind: 'law',
        officialUrl: null,
        resolvedUrl: null,
        contentHash: null,
        effectiveFrom: null,
        effectiveTo: null,
        reviewStatus: 'reviewed',
        sectionCount: 1,
        fragments: [
          {
            id: 'fragment-1',
            articleOrSection: 'Artículo 1',
            effectiveFrom: null,
            effectiveTo: null,
            purposes: ['personal_expenses'],
            taxRegimes: ['general'],
            reviewStatus: 'reviewed',
            contentMarkdown: '<!-- oculto -->Texto sin HTML ejecutable',
            sourcePages: [1],
          },
        ],
        ruleset: {
          id: 'ec-2026',
          version: '1',
          jurisdiction: 'EC',
          reviewStatus: 'local-snapshot',
        },
      }),
    })
    render(
      <MantineProvider>
        <OfficialSourcesSection client={client} />
      </MantineProvider>,
    )

    await screen.findByText('Ley local')
    expect(screen.getByText(/SRI · EC · Ley/)).not.toBeNull()
    expect(
      screen.getByText(/Origen: ruleset local incluido · Revisada/),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver secciones' }))
    await screen.findByText('Texto sin HTML ejecutable')
    expect(screen.queryByText('oculto')).toBeNull()
    expect(screen.getByText('Gastos personales')).not.toBeNull()
    expect(screen.getByText('Régimen general')).not.toBeNull()
  })

  it('ignores a closed source response after another source is opened', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    const client = daemon({
      listOfficialSources: vi.fn().mockResolvedValue([
        {
          id: 'source-a',
          title: 'Fuente A',
          issuer: 'SRI',
          jurisdiction: 'EC',
          sourceKind: 'law',
          officialUrl: null,
          resolvedUrl: null,
          contentHash: null,
          effectiveFrom: null,
          effectiveTo: null,
          reviewStatus: 'reviewed',
          sectionCount: 0,
        },
        {
          id: 'source-b',
          title: 'Fuente B',
          issuer: 'SRI',
          jurisdiction: 'EC',
          sourceKind: 'law',
          officialUrl: null,
          resolvedUrl: null,
          contentHash: null,
          effectiveFrom: null,
          effectiveTo: null,
          reviewStatus: 'reviewed',
          sectionCount: 0,
        },
      ]),
      getOfficialSource: vi.fn((id: string) =>
        id === 'source-a' ? first.promise : second.promise,
      ),
    })
    render(
      <MantineProvider>
        <OfficialSourcesSection client={client} />
      </MantineProvider>,
    )
    await screen.findByText('Fuente A')
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Ver secciones' })[0]!,
    )
    await screen.findByRole('dialog', { name: 'Fuente oficial' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Cerrar fuente oficial' }),
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Ver secciones' })[1]!,
    )
    second.resolve({
      id: 'source-b',
      title: 'Fuente B',
      issuer: 'SRI',
      jurisdiction: 'EC',
      sourceKind: 'law',
      reviewStatus: 'reviewed',
      fragments: [],
      ruleset: { id: 'ec', version: '1' },
    })
    await screen.findByRole('dialog', { name: 'Fuente B' })
    first.resolve({
      id: 'source-a',
      title: 'Fuente A',
      issuer: 'SRI',
      jurisdiction: 'EC',
      sourceKind: 'law',
      reviewStatus: 'reviewed',
      fragments: [],
      ruleset: { id: 'ec', version: '1' },
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Fuente A' })).toBeNull(),
    )
  })
})
