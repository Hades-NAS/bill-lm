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
  UpdateLocalConnection,
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
      name TEXT, year INTEGER,
      FOREIGN KEY (scope_id) REFERENCES local_library_metadata(scope_id)
    )`)
    for (const statement of [
      'ALTER TABLE local_collections ADD COLUMN name TEXT',
      'ALTER TABLE local_collections ADD COLUMN year INTEGER',
    ]) {
      try {
        this.database.run(statement)
      } catch {
        // The column is already present in libraries created by this daemon.
      }
    }
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
    this.database.run(`CREATE TABLE IF NOT EXISTS local_collection_invoices (
      collection_id TEXT NOT NULL, invoice_id TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY (collection_id, invoice_id),
      FOREIGN KEY (collection_id) REFERENCES local_collections(id),
      FOREIGN KEY (invoice_id) REFERENCES local_invoices(id)
    )`)
    this.database.run(`CREATE TABLE IF NOT EXISTS local_runs (
      id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, collection_id TEXT,
      connection_id TEXT NOT NULL,
      ruleset_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL,
      read_at TEXT, snapshot_json TEXT
    )`)
    for (const statement of [
      'ALTER TABLE local_runs ADD COLUMN collection_id TEXT',
      'ALTER TABLE local_runs ADD COLUMN read_at TEXT',
      'ALTER TABLE local_runs ADD COLUMN snapshot_json TEXT',
    ]) try { this.database.run(statement) } catch { /* Existing library. */ }
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

  updateConnection(id: string, input: UpdateLocalConnection): LocalConnection | null {
    const current = this.getConnection(id)
    if (!current) return null
    const next = { ...current, ...input }
    const now = new Date().toISOString()
    if (input.makeDefault) this.database.run('UPDATE local_connections SET is_default = 0')
    this.database.query(`UPDATE local_connections SET label = ?, api_flavor = ?, base_url = ?, model = ?, is_default = ?, updated_at = ? WHERE id = ?`).run(
      next.label, next.apiFlavor, next.baseUrl, next.model,
      Number(input.makeDefault ?? current.isDefault), now, id,
    )
    return this.getConnection(id)
  }

  deleteConnection(id: string) {
    const activeRuns = Number((this.database.query(`SELECT COUNT(*) AS count FROM local_runs WHERE connection_id = ? AND status IN ('queued', 'running')`).get(id) as { count: number }).count)
    if (activeRuns > 0) return { kind: 'active-runs' as const }
    return this.database.run('DELETE FROM local_connections WHERE id = ?', [id]).changes > 0
      ? { kind: 'deleted' as const } : { kind: 'not-found' as const }
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

  hasCollection(id: string) {
    return Boolean(
      this.database
        .query('SELECT 1 FROM local_collections WHERE id = ? AND scope_id = ?')
        .get(id, this.localScope.userId),
    )
  }

  setCollectionMetadata(id: string, input: { name: string; year: number }) {
    this.database
      .query(
        `UPDATE local_collections SET name = ?, year = ?
         WHERE id = ? AND scope_id = ?`,
      )
      .run(input.name, input.year, id, this.localScope.userId)
  }

  listCollectionMetadata() {
    return this.database
      .query(
        `SELECT collection.id, collection.name, collection.year,
                COUNT(membership.invoice_id) AS invoice_count
         FROM local_collections collection
         LEFT JOIN local_collection_invoices membership
           ON membership.collection_id = collection.id
         WHERE collection.scope_id = ?
         GROUP BY collection.id, collection.name, collection.year
         ORDER BY collection.created_at ASC`,
      )
      .all(this.localScope.userId)
      .map((row) => {
        const collection = row as Record<string, unknown>
        return {
          id: String(collection.id),
          name: typeof collection.name === 'string' && collection.name.trim()
            ? collection.name
            : 'Colección local sin nombre',
          year: typeof collection.year === 'number'
            ? collection.year
            : new Date().getFullYear(),
          invoiceCount: Number(collection.invoice_count),
        }
      })
  }

  hasCollectionInvoice(collectionId: string, invoiceId: string) {
    return Boolean(
      this.database
        .query(
          `SELECT 1 FROM local_collection_invoices
           WHERE collection_id = ? AND invoice_id = ?`,
        )
        .get(collectionId, invoiceId),
    )
  }

  attachInvoiceToCollection(collectionId: string, invoiceId: string) {
    if (!this.hasCollection(collectionId)) return { kind: 'collection-not-found' as const }
    if (!this.hasInvoice(invoiceId)) return { kind: 'invoice-not-found' as const }
    if (this.hasCollectionInvoice(collectionId, invoiceId))
      return { kind: 'already-attached' as const }
    this.database
      .query(
        `INSERT INTO local_collection_invoices (collection_id, invoice_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(collectionId, invoiceId, new Date().toISOString())
    return { kind: 'attached' as const }
  }

  detachInvoiceFromCollection(collectionId: string, invoiceId: string) {
    if (!this.hasCollection(collectionId)) return { kind: 'collection-not-found' as const }
    if (!this.hasCollectionInvoice(collectionId, invoiceId))
      return { kind: 'membership-not-found' as const }
    this.database
      .query(
        `DELETE FROM local_collection_invoices
         WHERE collection_id = ? AND invoice_id = ?`,
      )
      .run(collectionId, invoiceId)
    return { kind: 'detached' as const }
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

  listCollectionInvoices(collectionId: string) {
    return this.database
      .query(
        `SELECT invoice.id, invoice.file_name, invoice.created_at
         FROM local_collection_invoices membership
         JOIN local_invoices invoice ON invoice.id = membership.invoice_id
         WHERE membership.collection_id = ?
         ORDER BY membership.created_at DESC`,
      )
      .all(collectionId)
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
    collectionId?: string
    connectionId: string
    rulesetId: string
    snapshot?: unknown
  }) {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    this.database
      .query(
        `INSERT INTO local_runs
         (id, invoice_id, collection_id, connection_id, ruleset_id, status, created_at, snapshot_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.invoiceId,
        input.collectionId ?? null,
        input.connectionId,
        input.rulesetId,
        'queued',
        createdAt,
        JSON.stringify(input.snapshot ?? null),
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

  getCollectionRunDetail(collectionId: string, runId: string) {
    const row = this.database
      .query('SELECT * FROM local_runs WHERE id = ? AND collection_id = ?')
      .get(runId, collectionId) as Record<string, unknown> | null
    if (!row) return null
    return {
      id: String(row.id),
      invoiceId: String(row.invoice_id),
      collectionId: String(row.collection_id),
      status: row.status as LocalAnalysisRunStatus,
      createdAt: new Date(String(row.created_at)),
      readAt: row.read_at ? new Date(String(row.read_at)) : null,
      snapshot: row.snapshot_json ? JSON.parse(String(row.snapshot_json)) : null,
      events: this.listRunEvents(runId),
      result: this.getRunResult(runId),
    }
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

  listRuns(collectionId?: string) {
    const query = collectionId
      ? 'SELECT * FROM local_runs WHERE collection_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM local_runs ORDER BY created_at DESC'
    return this.database
      .query(query)
      .all(...(collectionId ? [collectionId] : []))
      .map((row) => {
        const run = row as Record<string, unknown>
        return {
          id: String(run.id),
          invoiceId: String(run.invoice_id),
          collectionId: run.collection_id ? String(run.collection_id) : null,
          status: run.status as LocalAnalysisRunStatus,
          createdAt: new Date(String(run.created_at)),
          readAt: run.read_at ? new Date(String(run.read_at)) : null,
        }
      })
  }

  markRunRead(runId: string) {
    const result = this.database.run('UPDATE local_runs SET read_at = ? WHERE id = ?', [new Date().toISOString(), runId])
    return result.changes > 0
  }

  getInvoiceSnapshot(id: string) {
    const row = this.database.query('SELECT normalized_json FROM local_invoices WHERE id = ?').get(id) as { normalized_json: string } | null
    return row ? JSON.parse(row.normalized_json) : null
  }

  getExecutionContext(collectionId: string) {
    const contextRow = this.database.query(`SELECT revision_json FROM local_collection_context_revisions WHERE collection_id = ? AND scope_id = ? ORDER BY revision DESC LIMIT 1`).get(collectionId, this.localScope.userId) as { revision_json: string } | null
    if (!contextRow) return { collectionContext: null, taxpayerProfile: null, activities: [] as unknown[] }
    const collectionContext = JSON.parse(contextRow.revision_json) as { taxpayerProfileRevisionId?: string; activityRevisionIds?: string[] }
    const taxpayerProfile = collectionContext.taxpayerProfileRevisionId
      ? this.database.query('SELECT revision_json FROM local_taxpayer_profile_revisions WHERE id = ? AND scope_id = ?').get(collectionContext.taxpayerProfileRevisionId, this.localScope.userId) as { revision_json: string } | null
      : null
    const activityIds = collectionContext.activityRevisionIds ?? []
    const activities = activityIds.map((id) => this.database.query('SELECT revision_json FROM local_economic_activity_revisions WHERE id = ? AND scope_id = ?').get(id, this.localScope.userId) as { revision_json: string } | null).flatMap((row) => row ? [JSON.parse(row.revision_json)] : [])
    return { collectionContext, taxpayerProfile: taxpayerProfile ? JSON.parse(taxpayerProfile.revision_json) : null, activities }
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
    const bundle = this.readRulesetBundle()
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

  listOfficialSources() {
    const bundle = this.readRulesetBundle()
    const sections = Array.isArray(bundle.sections) ? bundle.sections : []
    const manifests = Array.isArray(bundle.sourceManifests)
      ? bundle.sourceManifests
      : []
    return manifests.flatMap((manifest) => {
      if (!manifest || typeof manifest !== 'object') return []
      const source = manifest as Record<string, unknown>
      if (typeof source.id !== 'string') return []
      return [{
        id: source.id,
        title: String(source.title ?? source.id),
        issuer: String(source.issuer ?? 'Sin emisor declarado'),
        jurisdiction: String(source.jurisdiction ?? bundle.jurisdiction ?? ''),
        sourceKind: String(source.sourceKind ?? 'other'),
        officialUrl: typeof source.officialUrl === 'string' ? source.officialUrl : null,
        resolvedUrl: typeof source.resolvedUrl === 'string' ? source.resolvedUrl : null,
        contentHash: typeof source.contentHash === 'string' ? source.contentHash : null,
        effectiveFrom: typeof source.effectiveFrom === 'string' ? source.effectiveFrom : null,
        effectiveTo: typeof source.effectiveTo === 'string' ? source.effectiveTo : null,
        reviewStatus: String(source.reviewStatus ?? 'local-snapshot'),
        sectionCount: sections.filter(
          (section) => section && typeof section === 'object' && (section as Record<string, unknown>).sourceId === source.id,
        ).length,
      }]
    })
  }

  getOfficialSource(sourceId: string) {
    const source = this.listOfficialSources().find((item) => item.id === sourceId)
    if (!source) return null
    const bundle = this.readRulesetBundle()
    const sections = Array.isArray(bundle.sections) ? bundle.sections : []
    return {
      ...source,
      fragments: sections.flatMap((section) => {
        if (!section || typeof section !== 'object') return []
        const item = section as Record<string, unknown>
        if (item.sourceId !== sourceId || typeof item.id !== 'string') return []
        return [{
          id: item.id,
          articleOrSection: String(item.articleOrSection ?? item.id),
          effectiveFrom: typeof item.effectiveFrom === 'string' ? item.effectiveFrom : null,
          effectiveTo: typeof item.effectiveTo === 'string' ? item.effectiveTo : null,
          purposes: Array.isArray(item.purposes) ? item.purposes.map(String) : [],
          taxRegimes: Array.isArray(item.taxRegimes) ? item.taxRegimes.map(String) : [],
          reviewStatus: String(item.reviewStatus ?? 'local-snapshot'),
          contentMarkdown: typeof item.contentMarkdown === 'string' ? item.contentMarkdown : null,
          sourcePages: Array.isArray(item.sourcePages) ? item.sourcePages.map(Number) : [],
        }]
      }),
      ruleset: {
        id: String(bundle.rulesetId),
        version: String(bundle.version),
        jurisdiction: String(bundle.jurisdiction),
        reviewStatus: 'local-snapshot' as const,
      },
    }
  }

  getLibrarySummary() {
    const count = (table: string) =>
      Number((this.database.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count)
    const ruleset = this.listRulesets()[0] ?? null
    return {
      invoiceCount: count('local_invoices'),
      collectionCount: count('local_collections'),
      profileCount: count('local_taxpayer_profiles'),
      activityCount: count('local_economic_activities'),
      runCount: count('local_runs'),
      ruleset: ruleset
        ? {
            id: ruleset.id,
            version: ruleset.version,
            effectiveFrom: ruleset.effectiveFrom,
            effectiveTo: ruleset.effectiveTo,
          }
        : null,
    }
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

  private readRulesetBundle() {
    return JSON.parse(readFileSync(this.rulesetBundlePath, 'utf-8')) as Record<string, unknown>
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
