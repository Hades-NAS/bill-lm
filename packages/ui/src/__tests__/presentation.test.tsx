// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ContextGuideButton, EmptyState, FieldHelpLabel, InvoiceDetails } from '../index'

describe('shared presentation components', () => {
  beforeAll(() => {
    vi.stubGlobal('matchMedia', () => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  })

  it('renders an empty state with its supplied action', () => {
    render(
      <MantineProvider>
        <EmptyState
          action={<button type="button">Crear perfil</button>}
          description="Agrega primero una actividad económica."
          title="Aún no tienes perfiles"
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Aún no tienes perfiles')).toBeTruthy()
    expect(screen.getByText('Agrega primero una actividad económica.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Crear perfil' })).toBeTruthy()
  })

  it('uses caller-owned callbacks for context help', () => {
    const onClick = vi.fn()

    render(
      <MantineProvider>
        <ContextGuideButton title="perfiles tributarios" onClick={onClick} />
        <FieldHelpLabel hint="Dato de contexto." label="Nombre del perfil" />
      </MantineProvider>,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver guía sobre perfiles tributarios' }),
    )
    expect(onClick).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Ayuda sobre Nombre del perfil' }),
    ).toBeTruthy()
  })

  it('normalizes only known Ecuadorian currency aliases in invoice totals', () => {
    const invoice = { fileName: 'factura.xml', typeLabel: 'Factura', buyer: { name: 'Comprador', identifierLabel: 'RUC', identifier: '1' }, seller: { name: 'Emisor', identifier: '2' }, totals: { subtotal: 100, taxes: 0, total: 100, currency: 'DOLAR' }, items: [] }
    const { rerender } = render(<MantineProvider><InvoiceDetails analysis={<span>Análisis</span>} invoice={invoice} /></MantineProvider>)
    expect(screen.getAllByText(/\$\s?100/).length).toBeGreaterThan(0)
    rerender(<MantineProvider><InvoiceDetails analysis={<span>Análisis</span>} invoice={{ ...invoice, totals: { ...invoice.totals, currency: 'EURO' } }} /></MantineProvider>)
    expect(screen.getAllByText(/€\s?100/).length).toBeGreaterThan(0)
  })
})
