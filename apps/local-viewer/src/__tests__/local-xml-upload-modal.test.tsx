// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocalXmlUploadModal } from '../local-xml-upload-modal'

async function selectFiles(files: File[]) {
  const input = document.querySelector('input[type="file"]')
  if (!input) throw new Error('Dropzone input was not rendered')
  fireEvent.change(input, { target: { files } })
  await Promise.resolve()
  await Promise.resolve()
}

describe('LocalXmlUploadModal', () => {
  afterEach(cleanup)
  beforeEach(() => {
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
  })

  it('selects, removes, and discards a local XML draft', async () => {
    const onClose = vi.fn()
    render(
      <MantineProvider>
        <LocalXmlUploadModal
          opened
          client={{ importCollectionXml: vi.fn() } as never}
          collectionId="collection-a"
          onClose={onClose}
          onCompleted={vi.fn()}
        />
      </MantineProvider>,
    )

    await selectFiles([
      new File(['<factura/>'], 'primera.xml', { type: 'application/xml' }),
    ])
    expect(await screen.findByText('primera.xml')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar primera.xml' }))
    expect(screen.queryByText('primera.xml')).toBeNull()

    await selectFiles([
      new File(['<factura/>'], 'segunda.xml', { type: 'application/xml' }),
    ])
    expect(await screen.findByText('segunda.xml')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('¿Descartar la carga?')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a reject message for a non-XML selection', async () => {
    render(
      <MantineProvider>
        <LocalXmlUploadModal
          opened
          client={{ importCollectionXml: vi.fn() } as never}
          collectionId="collection-a"
          onClose={vi.fn()}
          onCompleted={vi.fn()}
        />
      </MantineProvider>,
    )

    await selectFiles([
      new File(['texto'], 'notas.txt', { type: 'text/plain' }),
    ])
    expect(await screen.findByText(/notas\.txt:/)).not.toBeNull()
  })

  it('clears imported drafts, keeps failures, and refreshes collection detail once after sequential attempts', async () => {
    const importCollectionXml = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'imported', invoiceId: 'one' })
      .mockResolvedValueOnce({ kind: 'duplicate', invoiceId: 'two' })
      .mockResolvedValueOnce({
        kind: 'invalid-xml',
        message: 'XML mal formado.',
      })
      .mockRejectedValueOnce(new Error('offline'))
    const onCompleted = vi.fn().mockResolvedValue(undefined)
    render(
      <MantineProvider>
        <LocalXmlUploadModal
          opened
          client={{ importCollectionXml } as never}
          collectionId="collection-a"
          onClose={vi.fn()}
          onCompleted={onCompleted}
        />
      </MantineProvider>,
    )

    await selectFiles([
      new File(['one'], 'uno.xml', { type: 'application/xml' }),
      new File(['two'], 'dos.xml', { type: 'application/xml' }),
      new File(['three'], 'tres.xml', { type: 'application/xml' }),
      new File(['four'], 'cuatro.xml', { type: 'application/xml' }),
    ])
    await screen.findByText('uno.xml')
    fireEvent.click(screen.getByRole('button', { name: 'Importar 4 archivos' }))

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1))
    expect(importCollectionXml.mock.calls.map((call) => call[1].name)).toEqual([
      'uno.xml',
      'dos.xml',
      'tres.xml',
      'cuatro.xml',
    ])
    expect(screen.queryByText('uno.xml')).toBeNull()
    expect(screen.queryByText('dos.xml')).toBeNull()
    expect(screen.getByText('XML mal formado.')).not.toBeNull()
    expect(
      screen.getByText('No se pudo conectar al daemon local.'),
    ).not.toBeNull()
  })

  it('closes without a discard prompt after all files were imported', async () => {
    const onClose = vi.fn()
    const importCollectionXml = vi
      .fn()
      .mockResolvedValue({ kind: 'imported', invoiceId: 'one' })
    render(
      <MantineProvider>
        <LocalXmlUploadModal
          opened
          client={{ importCollectionXml } as never}
          collectionId="collection-a"
          onClose={onClose}
          onCompleted={vi.fn()}
        />
      </MantineProvider>,
    )

    await selectFiles([
      new File(['one'], 'uno.xml', { type: 'application/xml' }),
    ])
    fireEvent.click(
      await screen.findByRole('button', { name: 'Importar 1 archivo' }),
    )

    await waitFor(() => expect(screen.queryByText('uno.xml')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('¿Descartar la carga?')).toBeNull()
  })
})
