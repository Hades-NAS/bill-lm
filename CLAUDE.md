# bill-lm — Project Context for AI Assistants

## What is this project?

A web app for managing and analyzing invoice collections. Users can upload XML/PDF invoices grouped into collections, then trigger an AI-powered analysis per invoice. Results are shown in real-time via Firebase Firestore.

---

## Tech Stack

| Layer               | Technology                         |
| ------------------- | ---------------------------------- |
| Framework           | TanStack Start (Release Candidate) |
| Routing             | TanStack Router (file-based)       |
| API                 | tRPC v11                           |
| ORM                 | Prisma v7 (PostgreSQL)             |
| Auth                | Clerk (`@clerk/clerk-react`)       |
| Real-time / BG Jobs | Firebase Firestore                 |
| File Storage        | Minio (pre-configured bucket)      |
| Styling             | Tailwind CSS v4                    |
| Server runtime      | Nitro (via TanStack Start)         |
| Package manager     | Bun                                |
| Logger              | Pino (server-only)                 |
| Env validation      | T3 Env (`@t3-oss/env-core`) + Zod  |
| XML Parsing         | `fast-xml-parser` + Zod (server)   |

---

## XML Parsing & Validation

For parsing and validating XML invoice files:

**Library:** `fast-xml-parser` (fast, lightweight, no external deps)
**Validation:** Zod (type-safe, runtime validation with nice error messages)
**Location:** Server-side only (in tRPC routers or background jobs)

### Pattern

1. **Parse XML** → `XMLParser.parse(xmlString)` returns raw JS object
2. **Validate with Zod** → create a Zod schema matching your invoice structure
3. **Get typed object** → Zod returns validated, typed data

### Example

```typescript
// src/integrations/xml/invoice-schema.ts (server-only)
import { z } from 'zod'

export const InvoiceXMLSchema = z.object({
  invoice: z.object({
    id: z.string(),
    date: z.string().pipe(z.coerce.date()),
    amount: z.string().pipe(z.coerce.number()),
    vendor: z.object({
      name: z.string(),
      taxId: z.string(),
    }),
    lineItems: z.array(
      z.object({
        description: z.string(),
        quantity: z.string().pipe(z.coerce.number()),
        unitPrice: z.string().pipe(z.coerce.number()),
      }),
    ),
  }),
})

export type InvoiceXML = z.infer<typeof InvoiceXMLSchema>
```

```typescript
// src/integrations/xml/parse-invoice.server.ts (server-only)
import { XMLParser } from 'fast-xml-parser'
import { InvoiceXMLSchema } from './invoice-schema'
import { logger } from '../logger.server'

export async function parseAndValidateInvoiceXML(
  xmlBuffer: Buffer,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const xmlString = xmlBuffer.toString('utf-8')
    const parser = new XMLParser({
      ignoreAttributes: false, // include XML attributes
      parseAttributeValue: true, // auto-convert numeric attributes
    })
    const rawData = parser.parse(xmlString)

    // Validate against schema
    const validatedData = InvoiceXMLSchema.parse(rawData)
    return { success: true, data: validatedData }
  } catch (error) {
    logger.error({ error }, 'XML parsing/validation failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

**Use in tRPC router:**

```typescript
// In your invoices.router.ts
export const invoicesRouter = router({
  analyzeInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const xmlBuffer = await fetchFromMinio(/* ... */)
      const { success, data, error } =
        await parseAndValidateInvoiceXML(xmlBuffer)
      if (!success) throw new Error(error)
      // data is now typed as InvoiceXML
      return { percentage: 85, analyze: 'Valid invoice' }
    }),
})
```

---

## Critical Architecture Rules

## Non-negotiable Rules

1. **tRPC only** for data access. Never use `createServerFn` or direct Prisma calls from components.
2. **Firebase Admin** (`firebase.server.ts`) → server files only. **Firebase Web SDK** (`firebase.client.ts`) → React components only.
3. **Logger** (`logger.server.ts`) → server files only. Use `console.*` in components.
4. **File naming**: `*.server.ts` for server-only, `*.client.ts` for client-only.
5. **Env vars**: server vars in `process.env`, client vars must be `VITE_` prefixed and accessed via `import.meta.env`.
6. **File name conventions**: follow `demo-example.tsx` pattern for components, `example.router.ts` for tRPC routers, etc. use `-` instead of camelCase or snake_case for file names.

### tRPC is the ONLY API layer

- All data fetching and mutations go through tRPC.
- Do NOT use TanStack Start server functions (`createServerFn`) for data access.
- Prisma is ONLY used inside tRPC routers (server-side).
- On the client, always use `useQuery` / `useMutation` from `@trpc/tanstack-react-query`.

### Firebase: two separate SDKs, two separate files

- **Server** → `src/integrations/firebase/firebase.server.ts` uses Firebase Admin SDK (`firebase-admin`).
  - Exports: `adminDb`, `adminAuth`
  - Requires: `GOOGLE_APPLICATION_CREDENTIALS` env var (path to service account JSON)
  - Use for: creating/updating Firestore documents from tRPC routers
- **Client** → `src/integrations/firebase/firebase.client.ts` uses Firebase Web SDK (`firebase`).
  - Exports: `db`
  - Use for: `onSnapshot` real-time subscriptions in React components
- Never import a server file from a client component and vice versa.

### Logger is server-only

- `src/integrations/logger.server.ts` uses Pino — Node.js only, will break in the browser.
- For client-side logging, use `console.log/warn/error` directly.
- Never import `logger.server.ts` from a React component or client file.

### File naming conventions

- `*.server.ts` → server-only code (tRPC routers, Prisma access, Firebase Admin, logger)
- `*.client.ts` → client-only code (Firebase Web SDK, browser utilities)
- `*.tsx` → React components (client-side by default in TanStack Start)

### Real-time strategy

- Background job progress is tracked in **Firestore** (not PostgreSQL polling).
- Flow: server creates a Firestore doc → returns `jobDocId` to client → client uses `onSnapshot(doc("bg_jobs/{jobDocId}"))` for live updates.
- For other data (collections, invoices), use standard tRPC `useQuery` with `refetchInterval` if needed.

---

## Folder Structure

```
src/
├── integrations/
│   ├── firebase/
│   │   ├── firebase.server.ts   # Firebase Admin SDK
│   │   └── firebase.client.ts   # Firebase Web SDK
│   ├── trpc/
│   │   ├── init.ts              # tRPC instance + context
│   │   ├── router.ts            # Root router
│   │   └── react.ts             # Client-side tRPC hooks
│   ├── tanstack-query/          # TanStack Query devtools + provider
│   ├── clerk/                   # Clerk auth components
│   └── logger.server.ts         # Pino logger (server-only)
├── routes/                      # File-based routes (TanStack Router) https://tanstack.com/router/v1/docs/routing/file-naming-conventions
├── components/                  # Shared React components
├── hooks/                       # Custom React hooks
├── env.ts                       # T3 Env schema (Zod-validated)
└── db.ts                        # Prisma client instance
```

---

## Features to Build

### 1. Auth

- Login/logout via Clerk (already configured).
- All routes except login are protected.

### 2. Invoice Collections (`/collections`)

- A collection has: `id`, `name`, `description`, `year` (Int), `userId`, `createdAt`, `updatedAt`.
- Users can create, list, and delete their own collections.

### 3. Invoice Items (`/collections/:id`)

- Each invoice belongs to a collection.
- Fields: `id`, `filename`, `fileType` (`xml` | `pdf`), `storagePath` (Minio path), `collectionId`, `percentage` (Float, nullable), `analyze` (String, nullable), `createdAt`, `updatedAt`.
- Users can upload XML/PDF files → stored in Minio → record saved to DB.
- Users can delete individual invoices.
- `percentage` and `analyze` are `null` until the "Analyze" job completes.

### 4. Background Jobs (Firestore collection: `bg_jobs`)

- Firestore document fields: `jobId`, `userId`, `collectionId`, `status` (`processing` | `complete` | `error`), `progress` (0–100), `step` (string), `message` (string, nullable), `createdAt`, `updatedAt`.
- One job per "Analyze" action.

### 5. Analyze Flow

1. User clicks **"Analyze"** on a collection.
2. tRPC mutation:
   - Creates a Firestore `bg_jobs` document.
   - Returns `{ jobDocId }` to the client.
3. Client subscribes to `bg_jobs/{jobDocId}` with `onSnapshot`.
4. Background worker (triggered by the tRPC mutation, runs async):
   - Fetches all invoices for the collection.
   - For each invoice, calls the `BillAnalyze` process → returns `{ percentage: number, analyze: string }`.
   - Updates the invoice row in PostgreSQL (via Prisma) with the result.
   - Updates the Firestore `bg_jobs` doc with current `progress` and `step`.
5. On completion: Firestore doc updated to `status: "complete"`, `progress: 100`.
6. On error: `status: "error"`, `message: "<error detail>"`.

### 6. Background Jobs Center

- A UI panel where users can see all their bg jobs and their live status.
- Uses `onSnapshot` for real-time updates.

---

## Prisma Schema (planned)

```prisma
model Collection {
  id          Int       @id @default(autoincrement())
  name        String
  description String?
  year        Int
  userId      String    // Clerk user ID
  invoices    Invoice[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Invoice {
  id           Int        @id @default(autoincrement())
  filename     String
  fileType     FileType
  storagePath  String
  percentage   Float?
  analyze      String?
  collectionId Int
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

enum FileType {
  xml
  pdf
}
```

---

## Environment Variables

```env
# Server-only
DATABASE_URL=postgresql://...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json

# Clerk (server)
CLERK_SECRET_KEY=...

# Client (VITE_ prefix required)
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Minio (server)
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=...
```

---

## Commit Convention

Uses **Conventional Commits** with **mandatory scope** enforced by commitlint + Husky.

**Format:** `type(scope): description`

**Allowed types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `revert`

**Examples:**

```
feat(collections): add create collection form
fix(invoices): correct minio upload path
chore(deps): update firebase to v12
refactor(trpc): move invoice router to separate file
```

Commits without a scope will be **rejected** by the pre-commit hook.

---

## Key Decisions & Rationale

- **No server functions** → tRPC only, cleaner separation, easier to test.
- **Firebase for real-time** instead of PostgreSQL LISTEN/NOTIFY + SSE → simpler, `onSnapshot` is the best real-time DX available.
- **Firebase Admin on server** → bypasses Firestore security rules for privileged writes.
- **Pino server-only** → browser-incompatible; use `console.*` on client.
- **Polling vs WebSockets** → for non-job data, tRPC `useQuery` with `refetchInterval` is sufficient. No WebSocket infrastructure needed.
- **Clerk over Firebase Auth** → better DX, pre-built UI components, already configured in project template.
- **Minio** → self-hosted S3-compatible storage, bucket already pre-configured.

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
