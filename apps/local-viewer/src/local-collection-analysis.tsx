import { Alert, Badge, Button, Card, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useState } from 'react'

import type { LocalApiFlavor, LocalConnectionResponse, LocalCollectionDetail } from '@bill-lm/contracts'
import { EmptyState, FieldHelpLabel } from '@bill-lm/ui'

import { LocalDaemonClient } from './api'

export function LocalCollectionAnalysis({
  client,
  collection,
  onChanged,
}: {
  client: LocalDaemonClient
  collection: LocalCollectionDetail
  onChanged: () => Promise<void>
}) {
  const [connections, setConnections] = useState<Array<LocalConnectionResponse>>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [apiFlavor, setApiFlavor] = useState<LocalApiFlavor>('openai-like')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:1234/v1')
  const [model, setModel] = useState('')
  const [result, setResult] = useState<{ classification: string; reasoning?: string } | null>(null)

  async function refresh() {
    try {
      const next = await client.listConnections()
      setConnections(next)
      setConnectionId((current) => current && next.some((item) => item.id === current) ? current : (next.find((item) => item.isDefault)?.id ?? next[0]?.id ?? null))
    } catch { setError('No se pudieron leer las conexiones Local-GPU del daemon local.') }
  }
  useEffect(() => { void refresh() }, [])

  async function saveConnection() {
    setBusy('save'); setError(null)
    try {
      await client.createConnection({ label, apiFlavor, baseUrl, model, makeDefault: connections.length === 0 })
      setLabel(''); setModel(''); await refresh()
    } catch { setError('Revisa los datos del host local y vuelve a intentar.') } finally { setBusy(null) }
  }
  async function probe() {
    if (!connectionId) return
    setBusy('probe'); setError(null)
    try {
      const response = await client.probeConnection(connectionId)
      if (!response.ok) setError(response.message ?? 'La prueba de Local-GPU falló.')
      await refresh()
    } catch { setError('No se pudo probar el host Local-GPU.') } finally { setBusy(null) }
  }
  async function analyze(invoiceId: string) {
    if (!connectionId) { setError('Agrega y selecciona una conexión Local-GPU antes de analizar.'); return }
    setBusy(invoiceId); setError(null); setResult(null)
    try {
      const run = await client.analyze({ collectionId: collection.id, connectionId, invoiceId })
      const nextResult = await client.getRunResult(run.id)
      setResult({ classification: nextResult.classification, reasoning: nextResult.payload.reasoning })
      await onChanged()
    } catch { setError('El análisis local no se pudo completar. Verifica el host y vuelve a probarlo. OAuth sigue siendo una guía provisional y no se usó ningún servicio cloud.') } finally { setBusy(null) }
  }

  return <Stack gap="md">
    <Card withBorder>
      <Stack>
        <div><Title order={2} size="h3">Conexión Local-GPU</Title><Text c="dimmed" size="sm">Esta conexión sólo se usa para analizar facturas de esta colección. El daemon local no envía datos a Bill-LM cloud.</Text></div>
        {error && <Alert color="red" title="Análisis local no disponible">{error}</Alert>}
        {connections.length === 0 ? <EmptyState title="No hay conexión Local-GPU" description="Registra un host local para analizar las facturas de esta colección." /> : <>
          <Select data={connections.map((item) => ({ value: item.id, label: `${item.label} · ${item.model}` }))} label="Host Local-GPU" onChange={setConnectionId} value={connectionId} />
          {connections.filter((item) => item.id === connectionId).map((item) => <Group key={item.id} justify="space-between"><Text c="dimmed" size="sm">{item.apiFlavor} · {item.baseUrl}</Text><Button loading={busy === 'probe'} onClick={() => void probe()} variant="light">Probar conexión</Button></Group>)}
        </>}
      </Stack>
    </Card>
    <Card withBorder><Stack>
      <Title order={3}>Agregar host Local-GPU</Title>
      <TextInput label={<FieldHelpLabel label="Nombre" hint="Un nombre para identificar este host local." />} onChange={(event) => setLabel(event.currentTarget.value)} value={label} />
      <Select data={[{ value: 'openai-like', label: 'OpenAI-like' }, { value: 'claude-like', label: 'Claude-like' }]} label="Tipo de API" onChange={(value) => setApiFlavor((value ?? 'openai-like') as LocalApiFlavor)} value={apiFlavor} />
      <TextInput label="URL base" onChange={(event) => setBaseUrl(event.currentTarget.value)} value={baseUrl} />
      <TextInput label="Modelo" onChange={(event) => setModel(event.currentTarget.value)} value={model} />
      <Group justify="flex-end"><Button disabled={!label || !model} loading={busy === 'save'} onClick={() => void saveConnection()}>Guardar conexión</Button></Group>
    </Stack></Card>
    <Card withBorder><Stack>
      <div><Title order={3}>Analizar facturas</Title><Text c="dimmed" size="sm">Elige una factura asociada a esta colección. Cada ejecución queda en su historial local.</Text></div>
      {collection.invoices.length === 0 ? <EmptyState title="Aún no hay facturas para analizar" description="Importa o asocia un XML a esta colección primero." /> : collection.invoices.map((invoice) => <Group key={invoice.id} justify="flex-end"><Button aria-label={`Analizar ${invoice.fileName}`} disabled={!connectionId} loading={busy === invoice.id} onClick={() => void analyze(invoice.id)}>Analizar</Button></Group>)}
      {result && <Alert color="violet" title={`Resultado: ${result.classification}`}>{result.reasoning ?? 'El análisis local se completó.'}</Alert>}
    </Stack></Card>
    <Card withBorder><Stack><Title order={3}>Historial local de análisis</Title>{collection.runs.length === 0 ? <EmptyState title="Aún no hay análisis locales" description="Los resultados de esta colección aparecerán aquí." /> : collection.runs.map((run) => <Group key={run.id} justify="space-between"><Text size="sm">{new Date(run.createdAt).toLocaleString('es-EC')}</Text><Badge color={run.status === 'completed' ? 'green' : run.status === 'failed' ? 'red' : 'yellow'}>{run.status}</Badge></Group>)}</Stack></Card>
  </Stack>
}
