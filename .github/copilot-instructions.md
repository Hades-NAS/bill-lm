# Copilot Instructions — bill-lm

For full project context, always refer to `CLAUDE.md` in the root. Below is a summary optimized for code generation.

---

## Stack

- **Framework**: TanStack Start (RC) + TanStack Router (file-based) https://tanstack.com/router/v1/docs/routing/file-naming-conventions
- **API**: tRPC v11 — the ONLY data layer. No server functions.
- **ORM**: Prisma v7 on PostgreSQL — used only inside tRPC routers.
- **Auth**: Clerk (`@clerk/clerk-react`)
- **Real-time**: Firebase Firestore (`onSnapshot` on client, Admin SDK on server)
- **File storage**: Minio
- **Styling**: Tailwind CSS v4
- **Package manager**: Bun
- **Logger**: Pino (server-only — never import in React components)

---

## Non-negotiable Rules

1. **tRPC only** for data access. Never use `createServerFn` or direct Prisma calls from components.
2. **Firebase Admin** (`firebase.server.ts`) → server files only. **Firebase Web SDK** (`firebase.client.ts`) → React components only.
3. **Logger** (`logger.server.ts`) → server files only. Use `console.*` in components.
4. **File naming**: `*.server.ts` for server-only, `*.client.ts` for client-only.
5. **Env vars**: server vars in `process.env`, client vars must be `VITE_` prefixed and accessed via `import.meta.env`.
6. **File name conventions**: follow `demo-example.tsx` pattern for components, `example.router.ts` for tRPC routers, etc. use `-` instead of camelCase or snake_case for file names.

---

## Commit Format (enforced by commitlint)

```
type(scope): description
```

- Scope is **mandatory** — commits without scope are rejected.
- Types: `feat` | `fix` | `chore` | `docs` | `style` | `refactor` | `test` | `ci` | `revert`

```
feat(collections): add create collection form
fix(invoices): correct minio upload path
chore(deps): update firebase to v12
```

---

## Key Paths

| What                | Path                                           |
| ------------------- | ---------------------------------------------- |
| tRPC router         | `src/integrations/trpc/router.ts`              |
| tRPC init + context | `src/integrations/trpc/init.ts`                |
| Firebase Admin      | `src/integrations/firebase/firebase.server.ts` |
| Firebase Web SDK    | `src/integrations/firebase/firebase.client.ts` |
| Logger (server)     | `src/integrations/logger.server.ts`            |
| Prisma client       | `src/db.ts`                                    |
| Env schema          | `src/env.ts`                                   |
| Routes              | `src/routes/`                                  |
| Components          | `src/components/`                              |

---

## Data Models

```ts
// Collection: name, description, year, userId (Clerk)
// Invoice: filename, fileType (xml|pdf), storagePath (Minio), percentage?, analyze?, collectionId
// Firestore bg_jobs: jobId, userId, collectionId, status, progress (0-100), step, message?
```

## Analyze Flow

User clicks "Analyze" → tRPC mutation → creates Firestore `bg_jobs` doc → returns `jobDocId` → client subscribes with `onSnapshot` → async worker processes each invoice → calls `BillAnalyze` → updates invoice in Postgres + Firestore progress → on finish: `status: "complete"`, `progress: 100`.

## Structure

- src/components: reusable UI (buttons, inputs, modals)
- src/routes: page-level components (one per route)
- src/integrations: external services (tRPC, Firebase, Logger, Clerk). This project has a firebase server and client integration, use them correctly, server for tRPC routers and API routes, client for React components.
- src/utils: shared utilities (formatting, helpers)
- src/constants: shared constants (enums, config)
- src/generated: auto-generated code (e.g. Prisma client)
- src/hooks: custom React hooks (e.g. useAuth, useInvoices for useQuery or useMutation)
- src/env.ts: env var schema and validation (using zod)

- /prisma/schema.prisma: data models and Prisma config

## UI Components

All UI components must be in `src/components`. All route-level components must be in `src/routes`. Never mix them.
Follow guide Mantine under https://mantine.dev/llms.txt

## API / Endpoints

Please define and create new `routers` on src/integrations/trpc/routers/, then use it and add it under src/integrations/trpc/router.ts. Never create new API routes or tRPC routers outside of this pattern.
For now the todo router is the only that is defined on router.ts, but as you add new features, you should create new routers for them and import them in router.ts. For example, if you add a collection feature, you should create a collections.router.ts file and define all the collection related tRPC procedures there, then import it in router.ts.

Also please always try to export in the same file of router, all single-type of entity returned by the procedures. For example, if you have a collection router, and it has procedures that return a Collection type, you should export the Collection type in the same file as the router, so that when you import the router in other files, you can also import the Collection type from the same file. This will help to keep the code organized and maintainable.
