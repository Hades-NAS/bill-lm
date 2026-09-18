import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import type {
  CreateLocalConnection,
  LocalConnection,
  LocalAnalysisRunStatus,
  ModelTaxAnalysisPayload,
} from '@bill-lm/contracts'
import { parseAndValidateInvoiceXML } from '@bill-lm/contracts'
import type {
  ActorScope,
  CollectionContextRepository,
  ProfileActivityRepository,
} from '@bill-lm/application'

import { createLocalCollectionContextRepository } from './local-collection-context-repository'
import { createLocalProfileActivityRepository } from './profile-activity-repository'

export class LocalLibrary {
  readonly database: Database
  private readonly localScope: ActorScope
  private readonly collectionContextRepository: CollectionContextRepository
  private readonly profileActivityRepository: ProfileActivityRepository

  constructor(
    readonly rootPath: string,
    private readonly rulesetBundlePath = join(
      import.meta.dir,
      '../../../resources/tax-rules/ec/sri/rulesets/ec-sri-2026.3.bundle.json',
    ),
  ) {
    mkdirSync(join(rootPath, '.bill-lm', 'objects'), { recursive: true })
    this.recoverTemporaryObjects()
    this.database = new Database(join(rootPath, 'library.sqlite'))
    this.database.run('PRAGMA foreign_keys = ON')
    this.database.run('PRAGMA journal_mode = WAL')
    this.database.run(`CREATE TABLE IF NOT EXISTS local_library_metadata (
      scope_id TEXT PRIMARY KEY
    )`)
    const persistedScope = this.database
      .query('SELECT scope_id FROM local_library_metadata LIMIT 1')
      .get() as { scope_id: string } | null
    const scopeId = persistedScope?.scope_id ?? crypto.randomUUID()
    if (!persistedScope)
      this.database
        .query('INSERT INTO local_library_metadata (scope_id) VALUES (?)')
        .run(scopeId)
    this.localScope = Object.freeze({ userId: scopeId })
    this.database.run(`CREATE TABLE IF NOT EXISTS local_economic_activities (
      id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_economic_activity_revisions (
      id TEXT PRIMARY KEY, activity_id TEXT NOT NULL, scope_id TEXT NOT NULL,
      revision INTEGER NOT NULL, revision_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE (activity_id, revision),
      FOREIGN KEY (activity_id) REFERENCES local_economic_activities(id),
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_taxpayer_profiles (
      id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_taxpayer_profile_revisions (
      id TEXT PRIMARY KEY, taxpayer_profile_id TEXT NOT NULL, scope_id TEXT NOT NULL,
      revision INTEGER NOT NULL, revision_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE (taxpayer_profile_id, revision),
      FOREIGN KEY (taxpayer_profile_id) REFERENCES local_taxpayer_profiles(id),
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_taxpayer_profile_activity_revisions (
      taxpayer_profile_revision_id TEXT NOT NULL,
      economic_activity_revision_id TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      PRIMARY KEY (taxpayer_profile_revision_id, economic_activity_revision_id),
      FOREIGN KEY (taxpayer_profile_revision_id) REFERENCES local_taxpayer_profile_revisions(id),
      FOREIGN KEY (economic_activity_revision_id) REFERENCES local_economic_activity_revisions(id),
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_collections (
      id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_collection_context_revisions (
      id TEXT PRIMARY KEY, collection_id TEXT NOT NULL, scope_id TEXT NOT NULL,
      revision INTEGER NOT NULL, revision_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE (collection_id, revision),
      FOREIGN KEY (collection_id) REFERENCES local_collections(id),
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_collection_context_activity_revisions (
      collection_context_revision_id TEXT NOT NULL,
      economic_activity_revision_id TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      PRIMARY KEY (collection_context_revision_id, economic_activity_revision_id),
      FOREIGN KEY (collection_context_revision_id) REFERENCES local_collection_context_revisions(id),
      FOREIGN KEY (economic_activity_revision_id) REFERENCES local_economic_activity_revisions(id),
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_connections (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, api_flavor TEXT NOT NULL,
      base_url TEXT NOT NULL, model TEXT NOT NULL, secret_ref TEXT,
      is_default INTEGER NOT NULL, last_probed_at TEXT, last_probe_error TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_invoices (
      id TEXT PRIMARY KEY, content_hash TEXT UNIQUE NOT NULL, file_name TEXT NOT NULL,
      object_path TEXT NOT NULL, normalized_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )`)
    try {
      this.database.run(
        "ALTER TABLE local_invoices ADD COLUMN normalized_json TEXT NOT NULL DEFAULT '{}'",
      )
    } catch {
      // The column is already present in libraries created by this daemon.
    }
    this.database.run(`CREATE TABLE IF NOT EXISTS local_runs (
      id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, connection_id TEXT NOT NULL,
      ruleset_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_run_events (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, status TEXT NOT NULL,
      message TEXT NOT NULL, created_at TEXT NOT NULL
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_analysis_results (
      id TEXT PRIMARY KEY, run_id TEXT UNIQUE NOT NULL, invoice_id TEXT NOT NULL,
      purpose TEXT NOT NULL, classification TEXT NOT NULL, result_snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`)
    this.profileActivityRepository = createLocalProfileActivityRepository({
      database: this.database,
      transaction: (work) => this.database.transaction(work)(),
    })
    this.collectionContextRepository = createLocalCollectionContextRepository({
      database: this.database,
      transaction: (work) => this.database.transaction(work)(),
    })
  }

  actorScope(): ActorScope {
    return this.localScope
  }

  profileActivities(): ProfileActivityRepository {
    return this.profileActivityRepository
  }

  collectionContexts(): CollectionContextRepository {
    return this.collectionContextRepository
  }

  createConnection(input: CreateLocalConnection): LocalConnection {
    const now = new Date()
    const id = crypto.randomUUID()
    if (input.makeDefault)
      this.database.run('UPDATE local_connections SET is_default = 0')
    this.database
      .query(
        `INSERT INTO local_connections VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .run(
        id,
        input.label,
        input.apiFlavor,
        input.baseUrl,
        input.model,
        input.secretRef ?? null,
        Number(input.makeDefault),
        now.toISOString(),
        now.toISOString(),
      )
    return this.getConnection(id)!
  }

  listConnections(): Array<LocalConnection> {
    return this.database
      .query(
        'SELECT * FROM local_connections ORDER BY is_default DESC, created_at ASC',
      )
      .all()
      .map((row) => this.toConnection(row as Record<string, unknown>))
  }

  getConnection(id: string): LocalConnection | null {
    const row = this.database
      .query('SELECT * FROM local_connections WHERE id = ?')
      .get(id)
    return row ? this.toConnection(row as Record<string, unknown>) : null
  }

  recordProbe(id: string, result: { ok: boolean; message?: string }) {
    const now = new Date().toISOString()
    this.database
      .query(
        `UPDATE local_connections
         SET last_probed_at = ?, last_probe_error = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        now,
        result.ok ? null : (result.message ?? 'La prueba falló.'),
        now,
        id,
      )
  }

  hasInvoice(id: string) {
    return Boolean(
      this.database.query('SELECT 1 FROM local_invoices WHERE id = ?').get(id),
    )
  }

  listInvoices() {
    return this.database
      .query(
        'SELECT id, file_name, created_at FROM local_invoices ORDER BY created_at DESC',
      )
      .all()
      .map((row) => {
        const invoice = row as Record<string, unknown>
        return {
          id: String(invoice.id),
          fileName: String(invoice.file_name),
          createdAt: new Date(String(invoice.created_at)),
        }
      })
  }

  createRun(input: {
    invoiceId: string
    connectionId: string
    rulesetId: string
  }) {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    this.database
      .query('INSERT INTO local_runs VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        id,
        input.invoiceId,
        input.connectionId,
        input.rulesetId,
        'queued',
        createdAt,
      )
    this.appendRunEvent({
      runId: id,
      status: 'queued',
      message: 'El análisis local está en cola.',
    })
    return { id, status: 'queued' as const, createdAt: new Date(createdAt) }
  }

  appendRunEvent(input: {
    runId: string
    status: LocalAnalysisRunStatus
    message: string
  }) {
    this.database
      .query('INSERT INTO local_run_events VALUES (?, ?, ?, ?, ?)')
      .run(
        crypto.randomUUID(),
        input.runId,
        input.status,
        input.message,
        new Date().toISOString(),
      )
  }

  startRun(runId: string) {
    this.database.run("UPDATE local_runs SET status = 'running' WHERE id = ?", [runId])
    this.appendRunEvent({ runId, status: 'running', message: 'El análisis local está en ejecución.' })
  }

  completeRun(input: {
    runId: string
    invoiceId: string
    payload: ModelTaxAnalysisPayload
  }) {
    this.database.transaction(() => {
      this.database.query(`INSERT INTO local_analysis_results VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        crypto.randomUUID(), input.runId, input.invoiceId, input.payload.purpose,
        input.payload.classification, JSON.stringify(input.payload), new Date().toISOString(),
      )
      this.database.run("UPDATE local_runs SET status = 'completed' WHERE id = ?", [input.runId])
      this.appendRunEvent({ runId: input.runId, status: 'completed', message: 'El análisis local terminó.' })
    })()
  }

  failRun(runId: string, message: string) {
    this.database.transaction(() => {
      this.database.run("UPDATE local_runs SET status = 'failed' WHERE id = ?", [runId])
      this.appendRunEvent({ runId, status: 'failed', message })
    })()
  }

  getRunResult(runId: string) {
    const row = this.database.query('SELECT * FROM local_analysis_results WHERE run_id = ?').get(runId) as Record<string, unknown> | null
    return row ? this.toRunResult(row) : null
  }

  listRunResults() {
    return this.database.query('SELECT * FROM local_analysis_results ORDER BY created_at DESC').all()
      .map((row) => this.toRunResult(row as Record<string, unknown>))
  }

  listRunEvents(runId: string, afterId?: string) {
    const query = afterId
      ? `SELECT * FROM local_run_events
         WHERE run_id = ? AND created_at > (SELECT created_at FROM local_run_events WHERE id = ?)
         ORDER BY rowid ASC`
      : 'SELECT * FROM local_run_events WHERE run_id = ? ORDER BY rowid ASC'
    const parameters = afterId ? [runId, afterId] : [runId]
    return this.database
      .query(query)
      .all(...parameters)
      .map((row) => {
        const event = row as Record<string, unknown>
        return {
          id: String(event.id),
          runId: String(event.run_id),
          status: event.status as LocalAnalysisRunStatus,
          message: String(event.message),
          createdAt: new Date(String(event.created_at)),
        }
      })
  }

  listRuns() {
    return this.database
      .query('SELECT * FROM local_runs ORDER BY created_at DESC')
      .all()
      .map((row) => {
        const run = row as Record<string, unknown>
        return {
          id: String(run.id),
          invoiceId: String(run.invoice_id),
          status: run.status as LocalAnalysisRunStatus,
          createdAt: new Date(String(run.created_at)),
        }
      })
  }

  importXml(fileName: string, content: Uint8Array) {
    if (!fileName.toLowerCase().endsWith('.xml'))
      return {
        kind: 'invalid-xml' as const,
        code: 'XML_ONLY',
        message: 'La biblioteca local acepta únicamente archivos XML.',
      }
    let parsed
    try {
      parsed = parseAndValidateInvoiceXML(Buffer.from(content))
    } catch {
      return {
        kind: 'invalid-xml' as const,
        code: 'INVALID_SRI_XML',
        message: 'El XML no contiene una factura autorizada y válida del SRI.',
      }
    }
    if (!parsed.success)
      return {
        kind: 'invalid-xml' as const,
        code: 'INVALID_SRI_XML',
        message: 'El XML no contiene una factura autorizada y válida del SRI.',
      }
    const contentHash = createHash('sha256').update(content).digest('hex')
    const existing = this.database
      .query('SELECT id FROM local_invoices WHERE content_hash = ?')
      .get(contentHash) as { id: string } | null
    if (existing) return { kind: 'duplicate' as const, invoiceId: existing.id }
    const id = crypto.randomUUID()
    const relativePath = join(
      '.bill-lm',
      'objects',
      contentHash.slice(0, 2),
      `${contentHash}.xml`,
    )
    const objectPath = join(this.rootPath, relativePath)
    mkdirSync(
      join(this.rootPath, '.bill-lm', 'objects', contentHash.slice(0, 2)),
      { recursive: true },
    )
    const temporaryPath = `${objectPath}.${crypto.randomUUID()}.tmp`
    writeFileSync(temporaryPath, content)
    const createdObject = !existsSync(objectPath)
    if (createdObject) renameSync(temporaryPath, objectPath)
    else unlinkSync(temporaryPath)
    try {
      this.database
        .query(
          `INSERT INTO local_invoices
           (id, content_hash, file_name, object_path, normalized_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          contentHash,
          fileName,
          relativePath,
          JSON.stringify(parsed.data),
          new Date().toISOString(),
        )
    } catch (error) {
      if (createdObject) unlinkSync(objectPath)
      throw error
    }
    return { kind: 'imported' as const, invoiceId: id }
  }

  listRulesets() {
    const bundle = JSON.parse(
      readFileSync(this.rulesetBundlePath, 'utf-8'),
    ) as Record<string, unknown>
    return [
      {
        id: String(bundle.rulesetId),
        version: String(bundle.version),
        jurisdiction: String(bundle.jurisdiction),
        effectiveFrom: String(bundle.effectiveFrom),
        effectiveTo:
          bundle.effectiveTo === null ? null : String(bundle.effectiveTo),
        sourceCount: Array.isArray(bundle.sourceManifests)
          ? bundle.sourceManifests.length
          : 0,
      },
    ]
  }

  close() {
    this.database.close()
  }

  private toConnection(row: Record<string, unknown>): LocalConnection {
    return {
      id: String(row.id),
      label: String(row.label),
      apiFlavor: row.api_flavor as LocalConnection['apiFlavor'],
      baseUrl: String(row.base_url),
      model: String(row.model),
      ...(row.secret_ref ? { secretRef: String(row.secret_ref) } : {}),
      isDefault: Boolean(row.is_default),
      lastProbedAt: row.last_probed_at
        ? new Date(String(row.last_probed_at))
        : null,
      lastProbeError: row.last_probe_error
        ? String(row.last_probe_error)
        : null,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    }
  }

  private toRunResult(row: Record<string, unknown>) {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      invoiceId: String(row.invoice_id),
      purpose: String(row.purpose),
      classification: String(row.classification),
      payload: JSON.parse(String(row.result_snapshot)) as ModelTaxAnalysisPayload,
      createdAt: new Date(String(row.created_at)),
    }
  }

  private recoverTemporaryObjects() {
    const objectsPath = join(this.rootPath, '.bill-lm', 'objects')
    for (const entry of readdirSync(objectsPath, { recursive: true })) {
      const relativePath = String(entry)
      if (relativePath.endsWith('.tmp'))
        unlinkSync(join(objectsPath, relativePath))
    }
  }
}
