import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalLibrary } from '../../../apps/local-daemon/src/library'
import { startLocalDaemon } from '../../../apps/local-daemon/src/server'

const port = Number(process.env.PLAYWRIGHT_LOCAL_DAEMON_PORT ?? 4418)
const root = process.env.BILL_LM_LOCAL_LIBRARY_DIR ?? mkdtempSync(join(tmpdir(), 'bill-lm-local-viewer-fixture-'))
const library = new LocalLibrary(root)
const now = '2026-10-02T00:00:00.000Z'
const scope = library.database.query('SELECT scope_id FROM local_library_metadata LIMIT 1').get() as { scope_id: string }
const alpha = '00000000-0000-4000-8000-000000000001'
const beta = '00000000-0000-4000-8000-000000000002'
const sharedInvoice = '00000000-0000-4000-8000-000000000010'
const pendingInvoice = '00000000-0000-4000-8000-000000000011'
const connection = '00000000-0000-4000-8000-000000000020'
const invoice = { factura: { infoTributaria: { razonSocial: 'Proveedor sintético S.A.', ruc: '1790012345001' }, infoFactura: { fechaEmision: '2026-10-01', razonSocialComprador: 'Comprador sintético', identificacionComprador: '0912345678', totalSinImpuestos: '100.00', totalDescuento: '0.00', importeTotal: '115.00', moneda: 'DOLAR', totalConImpuestos: { totalImpuesto: [{ codigo: '2', tarifa: '15', baseImponible: '100.00', valor: '15.00' }] } }, detalles: { detalle: [{ codigoPrincipal: 'SERV-001', descripcion: 'Servicio sintético local', cantidad: '1', precioUnitario: '100.00', descuento: '0.00', precioTotalSinImpuesto: '100.00' }] } } }

library.database.query('INSERT INTO local_collections (id, scope_id, created_at, name, year, description) VALUES (?, ?, ?, ?, ?, ?)').run(alpha, scope.scope_id, now, 'Colección Alfa', 2026, 'Evidencia sintética Alfa')
library.database.query('INSERT INTO local_collections (id, scope_id, created_at, name, year, description) VALUES (?, ?, ?, ?, ?, ?)').run(beta, scope.scope_id, now, 'Colección Beta', 2026, 'Evidencia sintética Beta')
library.database.query('INSERT INTO local_connections VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(connection, 'GPU sintética', 'openai-like', 'http://127.0.0.1:19999/v1', 'modelo-fixture', null, 1, now, null, now, now)
for (const [id, name] of [[sharedInvoice, 'factura-compartida.xml'], [pendingInvoice, 'factura-pendiente.xml']] as const) library.database.query('INSERT INTO local_invoices (id, content_hash, file_name, object_path, normalized_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, `fixture-${id}`, name, 'synthetic-fixture', JSON.stringify(invoice), now)
for (const collectionId of [alpha, beta]) library.database.query('INSERT INTO local_collection_invoices (collection_id, invoice_id, created_at) VALUES (?, ?, ?)').run(collectionId, sharedInvoice, now)
library.database.query('INSERT INTO local_collection_invoices (collection_id, invoice_id, created_at) VALUES (?, ?, ?)').run(beta, pendingInvoice, now)

const payload = { purpose: 'personal_expenses' as const, classification: 'eligible' as const, reasoning: 'Resultado sintético para comprobar la presentación local.', uncertainties: [], personalExpenseCategory: 'Salud', potentialEligibleAmount: 115, beneficiaryRelationship: 'Titular', missingEvidence: [] }
const completed = library.createRun({ invoiceId: sharedInvoice, collectionId: alpha, connectionId: connection, rulesetId: 'ec-sri-2026.3' })
library.startRun(completed.id)
library.completeRun({ runId: completed.id, invoiceId: sharedInvoice, payload })
function createStatus(status: 'queued' | 'running' | 'blocked' | 'failed', index: number) {
  const run = library.createRun({ invoiceId: sharedInvoice, collectionId: alpha, connectionId: connection, rulesetId: 'ec-sri-2026.3' })
  if (status === 'running') library.startRun(run.id)
  if (status === 'failed') library.failRun(run.id, 'Fallo sintético operativo.')
  if (status === 'blocked') { library.database.query("UPDATE local_runs SET status = 'blocked' WHERE id = ?").run(run.id); library.appendRunEvent({ runId: run.id, status: 'blocked', message: `Bloqueado sintético ${index}.` }) }
}
createStatus('queued', 1); createStatus('running', 2); createStatus('blocked', 3); createStatus('failed', 4)
for (let index = 0; index < 96; index += 1) createStatus('failed', index + 5)

// Fixture-only records keep profiles, activity and collection context represented in Biblioteca.
library.database.query('INSERT INTO local_economic_activities VALUES (?, ?, ?)').run('00000000-0000-4000-8000-000000000030', scope.scope_id, now)
library.database.query('INSERT INTO local_economic_activity_revisions VALUES (?, ?, ?, ?, ?, ?)').run('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000030', scope.scope_id, 1, JSON.stringify({ id: '00000000-0000-4000-8000-000000000031', activityId: '00000000-0000-4000-8000-000000000030', revision: 1, createdAt: now, displayName: 'Actividad sintética', registeredActivityName: 'Actividad sintética registrada', activityDescription: 'Actividad local para evidencia.', necessaryPurchases: null, revenueVatTreatment: 'taxed_nonzero', revenueVatTreatmentOther: null, mixedUseDescription: null, additionalFacts: null }), now)
library.database.query('INSERT INTO local_taxpayer_profiles VALUES (?, ?, ?)').run('00000000-0000-4000-8000-000000000040', scope.scope_id, now)
library.database.query('INSERT INTO local_taxpayer_profile_revisions VALUES (?, ?, ?, ?, ?, ?)').run('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000040', scope.scope_id, 1, JSON.stringify({ id: '00000000-0000-4000-8000-000000000041', taxpayerProfileId: '00000000-0000-4000-8000-000000000040', revision: 1, createdAt: now, displayName: 'Perfil sintético', personalIdNumber: null, professionalIdNumber: null, hasEmploymentIncome: true, hasRuc: false, taxRegime: 'general', vatFilingFrequency: 'none', additionalFacts: null, activityRevisionIds: [] }), now)
library.database.query('INSERT INTO local_collection_context_revisions VALUES (?, ?, ?, ?, ?, ?)').run('00000000-0000-4000-8000-000000000050', alpha, scope.scope_id, 1, JSON.stringify({ id: '00000000-0000-4000-8000-000000000050', collectionId: alpha, revision: 1, createdAt: now, purpose: 'personal_expenses', period: { startDate: '2026-01-01', endDate: '2026-12-31' }, taxpayerProfileRevisionId: '00000000-0000-4000-8000-000000000041', activityRevisionIds: [] }), now)
const server = startLocalDaemon(library, port)
function stop() { server.stop(true); library.close(); process.exit(0) }
process.once('SIGINT', stop); process.once('SIGTERM', stop)
