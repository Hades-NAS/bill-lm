import { Alert, Badge, Button, Card, Divider, Drawer, Group, List, Loader, Select, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'

import type { LocalCollectionDetail, LocalCollectionRunDetail, LocalConnectionResponse } from '@bill-lm/contracts'
import { EmptyState } from '@bill-lm/ui'

import { LocalDaemonClient } from './api'

const statusLabel = {
  queued: 'En cola', running: 'En ejecución', completed: 'Completado', failed: 'Fallido', blocked: 'Bloqueado',
} as const
const purposeLabel = {
  vat_credit: 'Declaración de IVA', business_income_tax: 'Impuesto a la Renta', personal_expenses: 'Gastos personales',
} as const
const classificationLabel = {
  eligible: 'Elegible', ineligible: 'No elegible', needs_review: 'Requiere revisión',
} as const

function statusColor(status: keyof typeof statusLabel) {
  return status === 'completed' ? 'green' : status === 'failed' || status === 'blocked' ? 'red' : 'yellow'
}

function RunDetail({ detail, collection }: { detail: LocalCollectionRunDetail; collection: LocalCollectionDetail }) {
  const fileName = collection.invoices.find((invoice) => invoice.id === detail.invoiceId)?.fileName ?? 'Factura local'
  return <Stack gap="md">
    <div><Text fw={600}>{fileName}</Text><Text c="dimmed" size="sm">{new Date(detail.createdAt).toLocaleString('es-EC')}</Text></div>
    <Group><Badge color={statusColor(detail.status)}>{statusLabel[detail.status]}</Badge>{detail.result && <Badge variant="light">{purposeLabel[detail.result.purpose]}</Badge>}</Group>
    <Divider label="Eventos locales" labelPosition="center" />
    {detail.events.length === 0
      ? <EmptyState title="Sin eventos registrados" description="Esta ejecución todavía no registró eventos locales." />
      : <List spacing="xs">{detail.events.map((event) => <List.Item key={event.id}><Text size="sm">{event.message}</Text><Text c="dimmed" size="xs">{new Date(event.createdAt).toLocaleString('es-EC')} · {statusLabel[event.status]}</Text></List.Item>)}</List>}
    <Divider label="Resultado" labelPosition="center" />
    {!detail.result
      ? <Alert color="yellow" title="Resultado no disponible">La ejecución no produjo un resultado validado. Revisa los eventos locales antes de volver a intentarlo.</Alert>
      : <Stack gap="xs"><Group><Badge color="violet">{classificationLabel[detail.result.classification]}</Badge><Text size="sm">{purposeLabel[detail.result.purpose]}</Text></Group><Text size="sm">{detail.result.payload.reasoning}</Text>{detail.result.payload.uncertainties.length > 0 && <><Text fw={500} size="sm">Aspectos por revisar</Text><List size="sm">{detail.result.payload.uncertainties.map((item) => <List.Item key={item}>{item}</List.Item>)}</List></>}</Stack>}
  </Stack>
}

export function LocalCollectionAnalysis({ client, collection, onChanged, onOpenSettings = () => {} }: { client: LocalDaemonClient; collection: LocalCollectionDetail; onChanged: () => Promise<void>; onOpenSettings?: () => void }) {
  const [connections, setConnections] = useState<Array<LocalConnectionResponse>>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<LocalCollectionRunDetail | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  async function refresh() {
    try {
      const next = await client.listConnections()
      setConnections(next)
      setConnectionId((current) => current && next.some((item) => item.id === current) ? current : (next.find((item) => item.isDefault)?.id ?? next[0]?.id ?? null))
    } catch { setError('No se pudieron leer las conexiones Local-GPU del daemon local.') }
  }
  useEffect(() => { void refresh() }, [])

  async function probe() {
    if (!connectionId) return
    setBusy('probe'); setError(null)
    try { const response = await client.probeConnection(connectionId); if (!response.ok) setError(response.message ?? 'La prueba de Local-GPU falló.'); await refresh() }
    catch { setError('No se pudo probar el host Local-GPU.') } finally { setBusy(null) }
  }
  async function loadRun(runId: string) {
    setSelectedRunId(runId); setSelectedRun(null); setDetailError(null)
    try { setSelectedRun(await client.getCollectionRunDetail(collection.id, runId)) }
    catch { setDetailError('No se pudo cargar el detalle local de esta ejecución.') }
  }
  async function analyze(invoiceId: string) {
    if (!connectionId) { setError('Agrega y selecciona una conexión Local-GPU antes de analizar.'); return }
    setBusy(invoiceId); setError(null)
    try { const run = await client.analyze({ collectionId: collection.id, connectionId, invoiceId }); await onChanged(); await loadRun(run.id) }
    catch { setError('El análisis local no se pudo completar. Verifica el host y vuelve a probarlo. OAuth sigue siendo una guía provisional y no se usó ningún servicio cloud.') } finally { setBusy(null) }
  }

  return <Stack gap="md">
    <Card withBorder><Stack><div><Title order={3}>Analizar facturas</Title><Text c="dimmed" size="sm">Selecciona el host global que se utilizará para esta ejecución. El perfil y las actividades vienen de la revisión de contexto de la colección.</Text></div>{error && <Alert color="red" title="Análisis local no disponible">{error}</Alert>}{connections.length === 0 ? <EmptyState title="No hay conexiones Local-GPU" description="Configura un host global antes de ejecutar análisis para esta colección." action={<Button onClick={onOpenSettings}>Ir a Configuración</Button>} /> : <><Select data={connections.map((item) => ({ value: item.id, label: `${item.label} · ${item.model}` }))} label="Conexión para este análisis" onChange={setConnectionId} value={connectionId} />{connections.filter((item) => item.id === connectionId).map((item) => <Group key={item.id} justify="space-between"><Text c="dimmed" size="sm">{item.apiFlavor} · {item.baseUrl}</Text><Button loading={busy === 'probe'} onClick={() => void probe()} variant="light">Probar conexión</Button></Group>)}{collection.invoices.length === 0 ? <EmptyState title="Aún no hay facturas para analizar" description="Importa o asocia un XML a esta colección primero." /> : collection.invoices.map((invoice) => <Group key={invoice.id} justify="space-between"><Text size="sm">{invoice.fileName}</Text><Button aria-label={`Analizar ${invoice.fileName}`} disabled={!connectionId} loading={busy === invoice.id} onClick={() => void analyze(invoice.id)}>Analizar</Button></Group>)}</>}</Stack></Card>
    <Card withBorder><Stack><div><Title order={3}>Historial local de análisis</Title><Text c="dimmed" size="sm">Selecciona una ejecución para consultar sus eventos y resultado local.</Text></div>{collection.runs.length === 0 ? <EmptyState title="Aún no hay análisis locales" description="Los resultados de esta colección aparecerán aquí." /> : collection.runs.map((run) => <Group key={run.id} justify="space-between"><div><Text size="sm">{collection.invoices.find((invoice) => invoice.id === run.invoiceId)?.fileName ?? 'Factura local'}</Text><Text c="dimmed" size="xs">{new Date(run.createdAt).toLocaleString('es-EC')}</Text></div><Group gap="xs"><Badge color={statusColor(run.status)}>{statusLabel[run.status]}</Badge><Button aria-label={`Ver detalle de ${collection.invoices.find((invoice) => invoice.id === run.invoiceId)?.fileName ?? 'Factura local'}`} onClick={() => void loadRun(run.id)} size="xs" variant="light">Ver detalle</Button></Group></Group>)}</Stack></Card>
    <Drawer opened={selectedRunId !== null} onClose={() => { setSelectedRunId(null); setSelectedRun(null); setDetailError(null) }} position="right" size="md" title="Detalle del análisis local"><Stack>{selectedRunId && !selectedRun && !detailError && <Group><Loader size="sm" /><Text size="sm">Cargando ejecución local…</Text></Group>}{detailError && <Alert color="red" title="No se pudo cargar el detalle" withCloseButton={false}>{detailError}<Group mt="sm"><Button onClick={() => selectedRunId && void loadRun(selectedRunId)} size="xs" variant="light">Reintentar</Button></Group></Alert>}{selectedRun && <RunDetail collection={collection} detail={selectedRun} />}</Stack></Drawer>
  </Stack>
}
