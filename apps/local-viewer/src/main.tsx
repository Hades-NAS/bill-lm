import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { MantineProvider } from '@mantine/core'
import { billLmTheme } from '@bill-lm/ui'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { createRoot } from 'react-dom/client'

import { LocalViewer } from './local-viewer'

import './styles.css'

const rootElement = document.getElementById('local-viewer')

if (!rootElement) throw new Error('No se encontró el punto de montaje local.')

createRoot(rootElement).render(
  <MantineProvider defaultColorScheme="auto" theme={billLmTheme}>
    <ModalsProvider>
      <Notifications position="bottom-right" />
      <LocalViewer />
    </ModalsProvider>
  </MantineProvider>,
)
