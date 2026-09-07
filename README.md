Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
bun install
bun --bun run dev
```

# Building For Production

To build this application for production:

```bash
bun --bun run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
bun --bun run test
```

Para ejecutar la validación completa de tipado, build, Vitest y Playwright:

```bash
bash health.sh
```

`health.sh` usa el fixture público e inerte `.env.health` y crea un entorno
hijo limpio para cada comprobación. No carga tu `.env`, `.env.local` ni
credenciales reales. Puedes omitir Playwright o seleccionar su puerto sin
perder ese aislamiento:

```bash
SKIP_E2E=true PLAYWRIGHT_PORT=3100 bash health.sh
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Uninstall the packages: `bun install @tailwindcss/vite tailwindcss -D`

## Linting & Formatting

This project uses [eslint](https://eslint.org/) and [prettier](https://prettier.io/) for linting and formatting. Eslint is configured using [tanstack/eslint-config](https://tanstack.com/config/latest/docs/eslint). The following scripts are available:

```bash
bun --bun run lint
bun --bun run format
bun --bun run check
```

## Firebase Authentication

- Configure the `VITE_FIREBASE_*` variables in `.env.local`.
- Habilita Email/Password y Google en Firebase Authentication.

## Rulesets tributarios oficiales

Bill-LM usa únicamente fuentes oficiales revisadas y publicadas para dar
contexto a sus análisis. El material descargado no se activa por sí solo: una
persona responsable debe revisarlo y aprobarlo antes de que pueda formar parte
de un ruleset.

- [Fuentes oficiales para los análisis](docs/guides/fuentes-oficiales-para-analisis.md): guía en lenguaje simple sobre el origen del material, su revisión, cómo se usa en una colección y sus límites.
- [Flujo técnico de fuentes oficiales y rulesets SRI](docs/architecture/sri-rulesets-flujo-tecnico.md): detalle de web, servidor, DB, worker, snapshots y gates.
- [README operativo de rulesets SRI](resources/tax-rules/ec/sri/README.md): comandos para revisar, preparar, publicar, sincronizar y activar fuentes.

## Cómo se organiza la documentación

La documentación separa el contenido por audiencia y propósito:

- `docs/guides/`: explica el producto y sus límites con lenguaje simple.
- `docs/architecture/`: describe los contratos y decisiones técnicas vigentes.
- `docs/operations/`: reúne procedimientos de prueba, despliegue y mantenimiento.
- `docs/internal/`: conserva planes, auditorías, reportes e investigación del equipo. No funciona como guía de producto.

El [índice de documentación](docs/README.md) enlaza cada documento y explica
cuándo usarlo. Las fuentes, secciones revisadas y bundles operativos del SRI se
mantienen aparte en `resources/tax-rules/`, porque son artifacts versionados y
no documentación general.

## Ejecución de análisis y trazabilidad

Cada ejecución selecciona el ruleset por propósito, régimen, periodicidad y
período completo. Solo conserva los fragmentos oficiales vigentes y aplicables;
también guarda los hashes y el Markdown exacto usado. El worker procesa ese
snapshot fijo, por lo que cambios posteriores en las reglas no modifican el
análisis ya encolado. El detalle técnico está en
[docs/architecture/analysis-flow.md](docs/architecture/analysis-flow.md).

Antes de enviarlo a la cola y otra vez en el worker, el servidor comprueba los
prerrequisitos del envelope y que la conexión activa siga siendo exactamente la
misma conexión y modelo fijados. Si falta o cambió algo, el run queda
**bloqueado** sin descifrar la clave ni llamar al proveedor; fallos operativos
de cola, almacenamiento o proveedor quedan como **fallidos**.

## T3Env

- You can use T3Env to add type safety to your environment variables.
- Add Environment variables to the `src/env.mjs` file.
- Use the environment variables in your code.

### Usage

```ts
import { env } from '#/env'

console.log(env.VITE_APP_TITLE)
```

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')

  useEffect(() => {
    getServerTime().then(setTime)
  }, [])

  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
