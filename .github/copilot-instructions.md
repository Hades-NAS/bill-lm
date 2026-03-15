# Copilot Instructions — bill-lm

For full project context, always refer to `CLAUDE.md` in the root. Below is a summary optimized for code generation.

---

## Stack

- **Framework**: TanStack Start (RC) + TanStack Router (file-based)
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

| What | Path |
|------|------|
| tRPC router | `src/integrations/trpc/router.ts` |
| tRPC init + context | `src/integrations/trpc/init.ts` |
| Firebase Admin | `src/integrations/firebase/firebase.server.ts` |
| Firebase Web SDK | `src/integrations/firebase/firebase.client.ts` |
| Logger (server) | `src/integrations/logger.server.ts` |
| Prisma client | `src/db.ts` |
| Env schema | `src/env.ts` |
| Routes | `src/routes/` |
| Components | `src/components/` |

---

## Data Models

```ts
// Collection: name, description, year, userId (Clerk)
// Invoice: filename, fileType (xml|pdf), storagePath (Minio), percentage?, analyze?, collectionId
// Firestore bg_jobs: jobId, userId, collectionId, status, progress (0-100), step, message?
```

## Analyze Flow

User clicks "Analyze" → tRPC mutation → creates Firestore `bg_jobs` doc → returns `jobDocId` → client subscribes with `onSnapshot` → async worker processes each invoice → calls `BillAnalyze` → updates invoice in Postgres + Firestore progress → on finish: `status: "complete"`, `progress: 100`.
