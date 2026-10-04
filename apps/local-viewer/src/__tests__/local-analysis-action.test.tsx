// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LocalAnalysisAction } from '../local-analysis-action'

describe('LocalAnalysisAction', () => {
  it('supports Mantine color-scheme media queries in jsdom', () => {
    vi.stubGlobal('matchMedia', () => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }))
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(
      false,
    )
  })

  it('keeps Analyze visible and opens OAuth guidance without a GPU connection', () => {
    render(
      <MantineProvider>
        <LocalAnalysisAction
          availability={{
            kind: 'oauth-guidance',
            title: 'Continúa con OAuth',
            message: 'Configura OAuth para continuar.',
          }}
          onStartGpu={vi.fn()}
        />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Analizar' }))
    expect(screen.getByText('Configura OAuth para continuar.')).toBeTruthy()
  })
})
