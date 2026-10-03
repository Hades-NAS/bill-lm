// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocalProfilesSection } from '../local-profiles-section'
import type { LocalDaemonClient } from '../api'

const activity = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  latestRevision: {
    id: '550e8400-e29b-41d4-a716-446655440002', activityId: '550e8400-e29b-41d4-a716-446655440001', revision: 2, createdAt: '2026-10-02T00:00:00.000Z',
    displayName: 'Servicios locales', registeredActivityCode: '', registeredActivityName: 'Servicios profesionales', activityDescription: 'Descripción completa de la actividad sin truncar.', necessaryPurchases: '', revenueVatTreatment: 'unknown' as const, revenueVatTreatmentOther: '', mixedUseDescription: '', additionalFacts: '',
  },
}

const profile = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  latestRevision: {
    id: '550e8400-e29b-41d4-a716-446655440004', taxpayerProfileId: '550e8400-e29b-41d4-a716-446655440003', revision: 3, createdAt: '2026-10-02T00:00:00.000Z',
    displayName: 'Servicios', personalIdNumber: '', professionalIdNumber: '1790000001001', hasEmploymentIncome: false, hasRuc: true, taxRegime: 'rimpe_entrepreneur' as const, vatFilingFrequency: 'monthly' as const, activityRevisionIds: [activity.latestRevision.id], additionalFacts: '',
  },
}

function client(overrides: Partial<LocalDaemonClient> = {}) {
  return {
    listActivities: vi.fn().mockResolvedValue([activity]),
    listProfiles: vi.fn().mockResolvedValue([]),
    createActivity: vi.fn().mockResolvedValue(activity.latestRevision),
    reviseActivity: vi.fn(), createProfile: vi.fn(), reviseProfile: vi.fn(),
    ...overrides,
  } as unknown as LocalDaemonClient
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

describe('LocalProfilesSection parity', () => {
  it('keeps no-RUC/no-activity profiles valid across Datos then Actividades', async () => {
    const daemon = client()
    render(<MantineProvider><LocalProfilesSection client={daemon} /></MantineProvider>)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Agregar perfil' }))[0]!)
    await screen.findByRole('textbox', { name: 'Nombre del perfil' })
    expect(screen.getByText('Datos')).not.toBeNull()
    expect(screen.getByText('Actividades')).not.toBeNull()
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del perfil' }), { target: { value: 'Sin RUC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Agregar perfil' }))
    await waitFor(() => expect(daemon.createProfile).toHaveBeenCalledWith(expect.objectContaining({
      displayName: 'Sin RUC', hasRuc: false, activityRevisionIds: [], vatFilingFrequency: 'none',
    })))
  })

  it('keeps an activity draft open with its error after a failed save', async () => {
    const daemon = client({ createActivity: vi.fn().mockRejectedValue(new Error('offline')) })
    render(<MantineProvider><LocalProfilesSection client={daemon} /></MantineProvider>)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Agregar actividad' }))[0]!)
    await screen.findByRole('textbox', { name: 'Nombre de actividad' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de actividad' }), { target: { value: 'Diseño' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de actividad registrada' }), { target: { value: 'Diseño gráfico' } })
    fireEvent.change(screen.getByRole('textbox', { name: '¿En qué consiste esta actividad?' }), { target: { value: 'Diseño para clientes.' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Agregar actividad' }))
    expect(await screen.findByText('No se pudo guardar la actividad económica local.')).not.toBeNull()
    expect((screen.getByRole('textbox', { name: 'Nombre de actividad' }) as HTMLInputElement).value).toBe('Diseño')
  })

  it('localizes the frozen regime, identifies activity revisions, and labels guide close', async () => {
    const daemon = client({ listProfiles: vi.fn().mockResolvedValue([profile]) })
    render(<MantineProvider><LocalProfilesSection client={daemon} /></MantineProvider>)
    await screen.findByText('Servicios · RIMPE emprendedor')
    expect(screen.getByText(/Servicios locales \(Rev\. 2\)/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver guía sobre perfiles tributarios' }))
    expect(await screen.findByRole('button', { name: 'Cerrar guía' })).not.toBeNull()
  })
})
