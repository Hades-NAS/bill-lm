// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { ContextGuideButton, EmptyState, FieldHelpLabel } from '../index'

describe('shared presentation components', () => {
  beforeAll(() => {
    vi.stubGlobal('matchMedia', () => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }))
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
})
