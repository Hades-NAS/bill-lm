# Bill-LM: Arquitectura de Análisis de Facturas

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura de Capas](#arquitectura-de-capas)
3. [Flujo Completo de Análisis](#flujo-completo-de-análisis)
4. [Componentes Principales](#componentes-principales)
5. [Telemetría y Observabilidad](#telemetría-y-observabilidad)
6. [Patrones de Implementación](#patrones-de-implementación)

---

## 🎯 Visión General

**Bill-LM** es una aplicación web que permite a usuarios subir colecciones de facturas (XML/PDF) y analizarlas automáticamente usando IA. El análisis se realiza de forma **asíncrona en background** con actualizaciones en **tiempo real** a través de Firestore.

### ¿Por qué esta arquitectura?

- **Escalabilidad**: Múltiples facturas simultáneamente sin bloquear UI
- **Resiliencia**: CircuitBreaker protege contra fallos del LLM
- **Observabilidad**: Telemetría completa de cada análisis
- **Mantenibilidad**: Separación clara de responsabilidades

---

## 🧱 Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────┐
│ 📱 User Interface (React Components)                        │
│    ↓                                                        │
│ tRPC Mutations (procedure collections/analyze)            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 📋 Job Handler (analyze-job.ts)                            │
│    Responsabilidad: Entrada al worker                       │
│    - Recibe job data                                        │
│    - Instancia Use Case                                     │
│    - Maneja resultado final                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Use Case (analyze-bills.use-case.ts)                    │
│    Responsabilidad: Orquestación de negocio                │
│    - Valida input (Zod)                                     │
│    - Crea AnalysisContext                                   │
│    - Instancia servicio                                     │
│    - Maneja errores globales                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ ⚙️ Service (bill-analysis.service.ts)                      │
│    Responsabilidad: Implementación técnica                  │
│    - Fetch bills desde DB                                   │
│    - Parse XMLs desde Minio                                 │
│    - Loop de análisis por bill                              │
│    - Update Firestore (progreso)                            │
│    - Update PostgreSQL (resultados)                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Agent Engine (agents/index.ts)                          │
│    Responsabilidad: Protección del LLM                      │
│    - CircuitBreaker (evita cascadas de fallos)             │
│    - Configuración por preset                               │
│    - Telemetría completa                                    │
│    - Manejo de tokens                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo de Análisis

### Fase 1: Inicio (UI → Job Handler)

```
1. Usuario click "Analyze" en colección
   ↓
2. tRPC procedure: collections.analyzeCollection()
   - Valida billIds
   - Crea Firestore doc: bg_jobs/{jobId}
   - Enqueue job a BullMQ
   ↓
3. Job Handler recibe:
   {
     jobId: "uuid",
     billIds: [1, 2, 3],
     collectionId: 5,
     collectionName: "2024",
     instructions: "custom rules" | null,
     preset: "balanced",
     type: "ANALYZE_COLLECTION"
   }
```

### Fase 2: Orquestación (Use Case)

```
AnalyzeBillsUseCase.execute(billIds, jobData, preset)
  ↓
  1. Valida input con Zod
  2. Crea AnalysisContext
     {
       jobId: "uuid",
userId: "internal_user_id",
       collectionId: 5,
       preset: "balanced",
       instructions: "custom" | undefined,
       retryCount: 0
     }
  3. Instancia BillAnalysisService
  4. Llama service.analyzeBills(billIds, jobData, context)
  5. Maneja errores globales
     - Si falla: UPDATE Firestore status='error'
     - Registra en logs
  6. Retorna AnalysisResult[]
```

### Fase 3: Implementación (Service)

```
BillAnalysisService.analyzeBills(billIds, jobData, context)
  ↓
  PASO 1: ensureModelLoaded()
    - Verifica que LM Studio esté disponible
  ↓
  PASO 2: fetchBillsForAnalysis(billIds)
    - SELECT bills FROM billHeader
    - WHERE id IN (billIds)
    - Retorna: Bill[]
  ↓
  PASO 3: fetchAndParseXmls(bills)
    - FOR EACH bill:
      a) Fetch XML desde Minio
      b) parseAndValidateInvoiceXML() → valida con Zod
      c) transformRawToParsed() → normaliza estructura
      d) Retorna: ParsedBill[]
  ↓
  PASO 4: analyzeEachBill(billsWithParsedData)
    - FOR EACH ParsedBill:
      a) buildPrompt(jobData, parsedBill)
         - Incluye instrucciones del user o defaults
         - Base template + bill data
      b) CircuitBreaker.execute()
         - Protege llamada al LLM
      c) AgentEngine.process(prompt, preset, context)
         - Llama al LLM con temperatura del preset
      d) parseAnalysisOutput()
         - Extrae percentage y reason
      e) enrichAnalysisMetadata()
         - Agrega version, preset, timestamp
      f) updateFirestoreProgress(jobId)
         - UPDATE ANALYZE_COLLECTION doc
         - status, percentage, step
  ↓
  PASO 5: updateBillsInDatabase(results)
    - Prisma transaction:
      UPDATE billHeader
      SET percentage = ?, reason = ?
      WHERE id IN (resultIds)
```

### Fase 4: Protección del LLM (Agent Engine)

```
AgentEngine.process(prompt, preset, context)
  ↓
  1. getLLMClientConfig(preset)
     - Retorna: { model, baseUrl, temperature, timeout }
     - Preset options:
       • strict:   temperature = 0.1 (determinístico)
       • balanced: temperature = 0.4 (defecto)
       • creative: temperature = 0.7 (variado)
  ↓
  2. CircuitBreaker.execute(async () => {
       - Estado: CLOSED → normal
       - Estado: OPEN → rechaza calls (demasiados fallos)
       - Estado: HALF_OPEN → permite 1 call test

       - Umbrales:
         • 5 fallos consecutivos → abre circuito
         • 60 segundos timeout → intenta recuperarse
  ↓
  3. OpenAI client.chat.completions.create()
     - Temperatura según preset
     - Timeout según config
  ↓
  4. Extrae response:
     - completion text
     - tokens.prompt_tokens
     - tokens.completion_tokens
  ↓
  5. Registra telemetría
     - jobId, billId
     - tokens (input, output, total)
     - model, preset, temperature
     - duration (ms)
     - status (success/error/timeout/circuit_open)
  ↓
  6. Retorna: analysis text
```

### Fase 5: Persistencia y Sincronización

```
Resultados → PostgreSQL (billHeader)
  ├── id
  ├── percentage (0-100)
  ├── analyze (reason text)
  └── updatedAt

Progreso → Firestore (ANALYZE_COLLECTION collection)
  ├── jobId
  ├── userId
  ├── collectionId
  ├── status ("pending" | "in-progress" | "completed" | "error")
  ├── percentage (0-100)
  ├── step (string, human readable)
  ├── message (null | error detail)
  ├── updatedAt
  └── createdAt

Telemetría → Firestore (telemetry collection)
  ├── telemetry/agent_calls/{doc}
  │   ├── jobId, billId
  │   ├── tokensInput, tokensOutput, tokensTotal
  │   ├── model, preset, temperature
  │   ├── duration, attempts, status
  │   └── timestamp
  └── telemetry/job_stats/{jobId}
      ├── totalTokens
      ├── callCount
      ├── avgDuration
      └── lastUpdated
```

---

## 🔧 Componentes Principales

### 1. **analyze-job.ts** (Job Handler)

**Ubicación:** `apps/web/src/integrations/jobs/analyze-job.ts`

**Responsabilidad:** Punto de entrada del worker async

**Qué hace:**

- Recibe job desde BullMQ
- Instancia AnalyzeBillsUseCase
- Llama `useCase.execute(billIds, jobData, preset)`
- Actualiza Firestore con resultado final

**Qué NO hace:**

- ❌ Fetch bills (lo hace el servicio)
- ❌ Parse XML (lo hace el servicio)
- ❌ Llamadas al LLM (lo hace el agent)

**Por qué existe:**

- Separación: Job handler ≠ lógica de negocio
- Facilita testeo: puedes mockear job data
- Reutilizable: mismo use case desde otros contextos (CLI, scheduled tasks, etc.)

```typescript
export const jobHandler = async (job: Job<AnalyzeJobData>) => {
  const { jobId, data } = job.data
  const { billIds, preset } = data

  try {
    const useCase = createAnalyzeBillsUseCase()
    const results = await useCase.execute(
      billIds,
      job.data,
      preset || 'balanced',
    )

    // Actualiza Firestore con resultado
    await adminDb
      .collection(FireCollections.ANALYZE_COLLECTION)
      .doc(jobId)
      .update({
        status: 'completed',
        percentage: 100,
        updatedAt: DateTime.now().toJSDate(),
      })
    return true
  } catch (error) {
    // Manejo de error
    return null
  }
}
```

---

### 2. **analyze-bills.use-case.ts** (Orquestador)

**Ubicación:** `apps/web/src/use-cases/analyze-bills.use-case.ts`

**Responsabilidad:** Orquestar la lógica de negocio

**Qué hace:**

1. Valida input con Zod
2. Crea AnalysisContext (jobId, userId, preset, instructions, retryCount)
3. Instancia BillAnalysisService
4. Llama `service.analyzeBills()`
5. Maneja errores globales
6. Retorna AnalysisResult[]

**Qué NO hace:**

- ❌ Fetch bills
- ❌ Parse XML
- ❌ Llamadas al LLM
- ❌ Updates a DB directamente

**Por qué existe:**

- **Separación de preocupaciones:** Lógica de negocio ≠ detalles técnicos
- **Reutilizable:** Mismo use case desde job handler, API endpoints, CLI, etc.
- **Testeable:** Mock el servicio, no necesitas BD ni LLM
- **DDD (Domain-Driven Design):** El use case es el "caso de uso" del negocio

**Contexto creado:**

```typescript
{
  jobId: "uuid",
userId: "internal_user_id",
  collectionId: 5,
  preset: "balanced" | "strict" | "creative",
  instructions: "custom rules" | undefined,
  retryCount: 0
}
```

---

### 3. **bill-analysis.service.ts** (Máquina Técnica)

**Ubicación:** `apps/web/src/integrations/services/bill-analysis.service.ts`

**Responsabilidad:** Implementar la lógica técnica

**5 Pasos Ejecutados:**

```
1️⃣ ensureModelLoaded()
    └─ Verifica LM Studio disponible

2️⃣ fetchBillsForAnalysis(billIds)
    └─ SELECT FROM PostgreSQL (Prisma)
    └─ Retorna: Bill[]

3️⃣ fetchAndParseXmls(bills)
    └─ FOR EACH bill:
       ├─ Fetch XML desde Minio
       ├─ parseAndValidateInvoiceXML (valida con Zod)
       └─ transformRawToParsed (normaliza)
    └─ Retorna: ParsedBill[]

4️⃣ analyzeEachBill(billsWithParsedData)
    └─ FOR EACH ParsedBill:
       ├─ buildPrompt()
       ├─ CircuitBreaker.execute()
       ├─ AgentEngine.process()
       ├─ parseAnalysisOutput()
       ├─ enrichAnalysisMetadata()
       └─ updateFirestoreProgress()

5️⃣ updateBillsInDatabase(results)
    └─ Prisma transaction:
       UPDATE billHeader SET percentage, reason
```

**Qué NO hace:**

- ❌ Validar input (lo hace el use case)
- ❌ Llamadas al LLM directamente (lo hace el agent)
- ❌ Decidir si reintentar (lo hace CircuitBreaker)

**Por qué existe:**

- **Orquestación técnica:** Coordina múltiples dependencias (Minio, Prisma, Firestore, Agent)
- **Implementación clara:** Cada paso es responsable de una tarea
- **Progreso en tiempo real:** Actualiza Firestore después de cada bill
- **Manejo de errores:** Continúa analizando bills aunque uno falle (partial success)

**Características importantes:**

- **CircuitBreaker:** Protege contra fallos en cascada del LLM
- **Progreso incremental:** Actualiza Firestore per-bill (no espera a terminar todos)
- **Partial analysis:** Si un bill falla, continúa con los siguientes
- **Transacción atómica:** Persiste todos los resultados juntos al final

---

### 4. **agents/index.ts** (Protector del LLM)

**Ubicación:** `apps/web/src/integrations/agents/index.ts`

**Responsabilidad:** Proteger llamadas al LLM

**Qué hace:**

1. Carga configuración del preset (temperatura, modelo, timeout)
2. Crea cliente OpenAI/LM Studio
3. Ejecuta con CircuitBreaker (protección contra fallos)
4. Extrae respuesta + tokens
5. Registra telemetría
6. Retorna análisis text

**Qué NO hace:**

- ❌ Construir prompt (lo hace el servicio)
- ❌ Parsear respuesta (lo hace el servicio)
- ❌ Retry lógico (lo hace CircuitBreaker)

**Por qué existe:**

- **Centralización:** Un único lugar donde ocurren LLM calls
- **Protección:** CircuitBreaker evita cascadas de fallos
- **Configurabilidad:** Presets para diferentes niveles de creatividad
- **Observabilidad:** Telemetría completa de cada call

**Presets Disponibles:**

```
strict:   temperature = 0.1  (determinístico, perfecto para datos exactos)
balanced: temperature = 0.4  (defecto, equilibrio entre precisión y creatividad)
creative: temperature = 0.7  (variado, mejor para análisis subjetivos)
```

**CircuitBreaker Pattern:**

```
CLOSED (normal)
  ↓ (5 fallos consecutivos)
OPEN (rechaza calls)
  ↓ (60s timeout)
HALF_OPEN (intenta 1 call de test)
  ↓ (success?)
CLOSED (normal)
  ↓ (fallo?)
OPEN (rechaza calls)
```

---

## 📊 Telemetría y Observabilidad

### ¿Por qué telemetría?

- **Análisis de costos:** tokens × precio = costo por análisis
- **Optimización:** Cuál preset usa menos tokens?
- **Debugging:** Exactamente qué pasó en cada call
- **Monitoreo:** Detectar anomalías (muchos fallos, latencia alta)

### Datos Registrados

**Agent Calls (Firestore: telemetry/agent_calls)**

```
{
  jobId:           "uuid",
  billId:          "uuid",
  tokensInput:     150,
  tokensOutput:    200,
  tokensTotal:     350,
  model:           "gpt-4",
  preset:          "balanced",
  temperature:     0.4,
  duration:        2500,        // ms
  attempts:        1,
  status:          "success"    // | "error" | "timeout" | "circuit_open"
  error:           null,        // | error message
  promptVersion:   "v1",
  timestamp:       2026-03-24T10:30:00Z
}
```

**Job Stats (Firestore: telemetry/job_stats/{jobId})**

```
{
  totalTokens:     3500,
  callCount:       10,
  avgDuration:     2300,
  lastUpdated:     2026-03-24T10:35:00Z
}
```

### Cómo Acceder a Telemetría

```typescript
// Hook en React
const { data: jobStats } = trpc.telemetry.getJobStats.useQuery({ jobId })
const { data: agentCalls } = trpc.telemetry.getAgentCalls.useQuery({ jobId })
const { data: userMetrics } = trpc.telemetry.getUserMetrics.useQuery()

// Resultados
jobStats = {
  totalTokens: 3500,
  callCount: 10,
  avgDuration: 2300,
  successRate: 95.5,
}
```

---

## 🔌 Patrones de Implementación

### 1. **Separación en Capas (Clean Architecture)**

```
Cada capa:
  - Una responsabilidad única
  - Conoce capas inferiores, no superiores
  - Testeable en aislamiento
  - Reemplazable (swap implementation)
```

### 2. **Dependency Injection**

```typescript
// Service recibe dependencias inyectadas
export class BillAnalysisService {
  constructor(
    private circuitBreaker = new CircuitBreaker(),
    private promptBuilder = new BillPromptBuilder(),
  ) {}
}

// Use case instancia servicio
const service = new BillAnalysisService()
```

### 3. **Schema Validation (Zod)**

```typescript
// Input validation
const AnalysisContextSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string(),
  preset: z.enum(['strict', 'balanced', 'creative']),
})

// Parse + validate
const context = AnalysisContextSchema.parse(data)
```

### 4. **Error Handling (AppError)**

```typescript
enum ErrorType {
  VALIDATION = 'validation',
  STORAGE = 'storage',
  AI_ENGINE = 'ai_engine',
  DATABASE = 'database',
  NETWORK = 'network',
}

class AppError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public context?: Record<string, any>,
    public retryable: boolean = false,
  ) {}
}
```

### 5. **Circuit Breaker Pattern**

```typescript
class CircuitBreaker {
  private failureCount = 0
  private state: 'closed' | 'open' | 'half_open' = 'closed'

  async execute(fn, context) {
    if (this.state === 'open') {
      throw new CircuitBreakerError()
    }

    try {
      return await fn()
    } catch (error) {
      this.failureCount++
      if (this.failureCount >= 5) {
        this.state = 'open'
        setTimeout(() => {
          this.state = 'half_open'
          this.failureCount = 0
        }, 60_000)
      }
      throw error
    }
  }
}
```

---

## 📁 Estructura de Archivos

```
apps/web/src/
├── integrations/
│   ├── jobs/
│   │   └── analyze-job.ts              # Job handler
│   ├── services/
│   │   ├── bill-analysis.service.ts    # Servicio de análisis
│   │   └── telemetry.service.ts        # Telemetría
│   ├── agents/
│   │   └── index.ts                    # Agent Engine
│   ├── prompts/
│   │   └── bill-prompt-builder.ts      # Construcción de prompts
│   ├── errors/
│   │   └── error-handler.ts            # AppError + CircuitBreaker
│   └── trpc/
│       ├── routers/
│       │   └── telemetry.router.ts     # tRPC queries
│       └── procedures/
│           └── collections/index.ts    # analyzeCollection procedure
├── use-cases/
│   └── analyze-bills.use-case.ts       # Orquestador de negocio
├── schema/
│   ├── bill-analysis.ts                # Schemas Zod
│   ├── telemetry.ts                    # Telemetría schemas
│   └── collections.ts                  # Colecciones schemas
├── config/
│   └── llm-config.ts                   # Configuración de LLM
├── hooks/
│   ├── query/
│   │   ├── collection.ts
│   │   ├── bill.ts
│   │   └── telemetry.ts                # Queries centralizadas
│   └── use-jobs-subscription-manager.ts # Suscripción Firestore
└── components/
    └── job-telemetry.tsx               # Componente telemetría UI
```

---

## 🚀 Flujo de Datos Visual

```
┌─────────────────┐
│   User Click    │ "Analyze Collection"
└────────┬────────┘
         ↓
┌─────────────────────────────────┐
│  tRPC: analyzeCollection()      │ Valida billIds, crea job
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│  Firestore: bg_jobs/{jobId}     │ status: "pending"
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│  BullMQ: Enqueue Job            │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│  Job Handler (analyze-job.ts)   │ Recibe job
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│  AnalyzeBillsUseCase.execute()                          │ Orquesta
└────────┬────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│  BillAnalysisService.analyzeBills()                     │ Implementa
│                                                         │
│  ┌──────────┐                                          │
│  │ Paso 1   │ ensureModelLoaded()                      │
│  └────┬─────┘                                          │
│       ↓                                                 │
│  ┌──────────────────────────────────┐                 │
│  │ Paso 2                           │ fetchBillsForAnalysis()
│  │ Prisma: SELECT bills FROM db     │
│  └────┬─────────────────────────────┘                 │
│       ↓                                                 │
│  ┌──────────────────────────────────┐                 │
│  │ Paso 3                           │ fetchAndParseXmls()
│  │ Minio: GET bills.xml             │
│  │ Zod: validate                    │
│  └────┬─────────────────────────────┘                 │
│       ↓                                                 │
│  ┌──────────────────────────────────┐                 │
│  │ Paso 4 (LOOP PER BILL)           │ analyzeEachBill()
│  │  └─ buildPrompt()                 │
│  │  └─ CircuitBreaker.execute()      │
│  │  └─ AgentEngine.process()◄────────┼─────────┐     │
│  │  └─ parseAnalysisOutput()         │         │     │
│  │  └─ updateFirestoreProgress()     │    AgentEngine │
│  └────┬─────────────────────────────┘         │     │
│       ↓                                       ↓     │
│  ┌──────────────────────────────────┐    ┌──────────────────┐
│  │ Paso 5                           │    │ 🤖 LLM Call     │
│  │ Prisma: UPDATE billHeader        │    │ OpenAI/LM Studio│
│  │ SET percentage, reason           │    └────────┬─────────┘
│  └────┬─────────────────────────────┘             │
│       ↓                                           ↓
└───────┼───────────────────────────────────────────┼──────┐
        ↓                                           ↓
┌──────────────────────────────┐    ┌─────────────────────┐
│  Firestore: ANALYZE_COLLECTION  │    │  Telemetry        │
│  status: "completed"            │    │  Tokens, duration  │
│  percentage: 100                │    │  Status            │
└──────────────────────────────┘    └─────────────────────┘
        ↓
┌──────────────────────────────┐
│  React Hook: onSnapshot()    │
│  ↓                            │
│  Update UI in Real-time      │
└──────────────────────────────┘
```

---

## 📚 Referencias

- **Clean Architecture**: Cada capa = responsabilidad única
- **DDD (Domain-Driven Design)**: Use cases = comportamiento del negocio
- **Circuit Breaker Pattern**: Resiliencia ante fallos
- **Telemetría**: Observabilidad completa
- **Zod**: Type-safe validation
- **Firestore**: Real-time updates + progreso
- **PostgreSQL**: Datos permanentes
- **Minio**: Almacenamiento de archivos

---

## 🎯 Resumen

**Bill-LM** implementa una arquitectura moderna y escalable para análisis de facturas:

1. **Separación clara** entre capas (job → use case → service → agent)
2. **Resiliencia** con CircuitBreaker contra fallos del LLM
3. **Observabilidad** completa con telemetría
4. **Real-time** updates vía Firestore
5. **Mantenibilidad** a través de responsabilidades únicas
6. **Reutilizable** para múltiples contextos

Cada componente hace exactamente lo que debe, nada más, nada menos.
