import {
  ColorSchemeScript,
  MantineProvider,
  createTheme,
  mantineHtmlProps,
} from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
// import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
// import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import { FirebaseAuthProvider } from '#/integrations/firebase/auth-provider'
// import TanStackQueryDevtools from '#/integrations/tanstack-query/devtools'
import TanStackQueryProvider from '#/integrations/tanstack-query/root-provider'

import { useJobsSubscriptionManager } from '#/hooks/use-jobs-subscription-manager'

import appCss from '../styles.css?url'

import type { TRPCRouter } from '#/integrations/trpc/router'
import type { QueryClient } from '@tanstack/react-query'
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query'

import './__root.css'

interface MyRouterContext {
  queryClient: QueryClient

  trpc: TRPCOptionsProxy<TRPCRouter>
}

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-lg text-gray-600">Página no encontrada</p>
      </div>
    </div>
  )
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=5',
      },
      {
        name: 'description',
        content:
          'Bill LM - Simplifica la gestión de tus gastos deducibles. Carga, organiza y analiza tus facturas con inteligencia artificial para maximizar deducciones fiscales.',
      },
      {
        name: 'keywords',
        content:
          'gestión de facturas, gastos deducibles, análisis de facturas, software contable, deducciones fiscales, Bill LM',
      },
      {
        name: 'author',
        content: 'Bill LM',
      },
      {
        name: 'robots',
        content: 'index, follow',
      },
      {
        name: 'application-name',
        content: 'Bill LM',
      },
      {
        name: 'msapplication-TileColor',
        content: '#7c3aed',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:title',
        content: 'Bill LM - Gestión Inteligente de Gastos Deducibles',
      },
      {
        property: 'og:description',
        content:
          'Carga, organiza y analiza tus facturas con inteligencia artificial. Maximiza deducciones fiscales de forma automática.',
      },
      {
        property: 'og:image',
        content: '/logo512.png',
      },
      {
        property: 'og:url',
        content: 'https://bill-lm.cardor.dev',
      },
      {
        property: 'og:site_name',
        content: 'Bill LM',
      },
      {
        property: 'og:locale',
        content: 'es_ES',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Bill LM - Gestión Inteligente de Gastos Deducibles',
      },
      {
        name: 'twitter:description',
        content:
          'Carga, organiza y analiza tus facturas con inteligencia artificial.',
      },
      {
        name: 'twitter:image',
        content: '/logo512.png',
      },
      {
        title: 'Bill LM - Simplifica la gestión de tus gastos deducibles',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
    scripts: import.meta.env.DEV
      ? [
          {
            type: 'module',
            suppressHydrationWarning: true,
            children: `
            import RefreshRuntime from "/_build/@react-refresh";
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {};
            window.$RefreshSig$ = () => (type) => type;
            window.__vite_plugin_react_preamble_installed__ = true;
          `,
          },
        ]
      : [
          {
            defer: true,
            'data-domain': 'bill-lm.cardor.dev',
            src: 'https://plau.cardor.dev/js/script.js',
          },
        ],
  }),
  shellComponent: RootDocument,
})

const theme = createTheme({
  primaryColor: 'violet',
  components: {
    Button: {
      defaultProps: {
        loaderProps: { type: 'dots' },
      },
    },
  },
})

/**
 * Initialize global job subscriptions
 * This component ensures the subscription manager hook runs at root level
 */
function JobsSubscriptionProvider({ children }: { children: React.ReactNode }) {
  useJobsSubscriptionManager()
  return <>{children}</>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <HeadContent />
        <ColorSchemeScript defaultColorScheme="auto" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased wrap-anywhere selection:bg-[rgba(128,79,184,0.24)]">
        <TanStackQueryProvider>
          <MantineProvider defaultColorScheme="auto" theme={theme}>
            <ModalsProvider>
              <Notifications position="bottom-right" />
              <FirebaseAuthProvider>
                <JobsSubscriptionProvider>
                  {children}
                  {/* <TanStackDevtools
                    config={{
                      position: 'bottom-right',
                    }}
                    plugins={
                      [
                        {
                          name: 'Tanstack Router',
                          render: <TanStackRouterDevtoolsPanel />,
                        },
                        TanStackQueryDevtools,
                      ]
                    }
                  /> */}
                </JobsSubscriptionProvider>
              </FirebaseAuthProvider>
            </ModalsProvider>
          </MantineProvider>
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  )
}
