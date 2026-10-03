import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'

import type { LocalCollectionDetail, LocalConnectionResponse } from '@bill-lm/contracts'
import { ConnectionProbeStatus, EmptyState } from '@bill-lm/ui'

import { LocalDaemonClient } from './api'

export function LocalCollectionAnalysis({ client, collection, onChanged, onOpenSettings = () => {}, opened = true, onClose = () => {} }: { client: LocalDaemonClient; collection: LocalCollectionDetail; onChanged: () => Promise<void>; onOpenSettings?: () => void; opened?: boolean; onClose?: () => void }) {
  const [connections, setConnections] = useState<Array<LocalConnectionResponse>>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [probeFeedback, setProbeFeedback] = useState<{ status: 'idle' | 'pending' | 'success' | 'error'; message?: string }>({ status: 'idle' })
  const [busy, setBusy] = useState<string | null>(null)
  const probeGeneration = useRef(0)
  const analyzeGeneration = useRef(0)

  async function refresh() {
    try {
      const next = await client.listConnections()
      setConnections(next)
      setConnectionId((current) => current && next.some((item) => item.id === current) ? current : (next.find((item) => item.isDefault)?.id ?? next[0]?.id ?? null))
    } catch { setError('No se pudieron leer las conexiones Local-GPU del daemon local.') }
  }
  useEffect(() => { probeGeneration.current += 1; analyzeGeneration.current += 1; setProbeFeedback({ status: 'idle' }); if (opened) void refresh() }, [opened, collection.id])

  async function probe() {
    if (!connectionId) return
    const selectedId = connectionId
    const generation = ++probeGeneration.current
    setProbeFeedback({ status: 'pending' }); setError(null)
    try {
      const response = await client.probeConnection(selectedId)
      if (generation !== probeGeneration.current) return
      setProbeFeedback(response.ok ? { status: 'success', message: response.message ?? 'El host Local-GPU respondió correctamente.' } : { status: 'error', message: response.message ?? 'La prueba de Local-GPU falló.' })
      await refresh()
    }
    catch { if (generation === probeGeneration.current) setProbeFeedback({ status: 'error', message: 'No se pudo probar el host Local-GPU.' }) }
  }
  async function analyze(invoiceId: string) {
    if (!connectionId) { setError('Agrega y selecciona una conexión Local-GPU antes de analizar.'); return }
    const generation = ++analyzeGeneration.current
    setBusy(invoiceId); setError(null)
    try { await client.analyze({ collectionId: collection.id, connectionId, invoiceId }); if (generation !== analyzeGeneration.current) return; await onChanged(); if (generation === analyzeGeneration.current) onClose() }
    catch { if (generation === analyzeGeneration.current) setError('El análisis local no se pudo completar. Verifica el host y vuelve a probarlo.') } finally { if (generation === analyzeGeneration.current) setBusy(null) }
  }

  function close() { probeGeneration.current += 1; analyzeGeneration.current += 1; onClose() }
  return <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar análisis de colección' }} opened={opened} onClose={close} size="lg" title="Analizar colección"><Stack gap="md"><Text c="dimmed" size="sm">El perfil y las actividades se toman de la revisión de contexto actual. Selecciona el host global para esta ejecución local.</Text>{error && <Alert color="red" title="Análisis local no disponible">{error}</Alert>}{!collection.latestRevision ? <EmptyState title="Configura el contexto de la colección" description="Define propósito, período y perfil tributario antes de analizar facturas localmente." /> : connections.length === 0 ? <EmptyState title="No hay conexiones Local-GPU" description="Configura un host global antes de ejecutar análisis para esta colección." action={<Button onClick={onOpenSettings}>Ir a Configuración</Button>} /> : <><Select data={connections.map((item) => ({ value: item.id, label: `${item.label} · ${item.model}` }))} label="Conexión" onChange={(id) => { probeGeneration.current += 1; setConnectionId(id); setProbeFeedback({ status: 'idle' }) }} value={connectionId} />{connections.filter((item) => item.id === connectionId).map((item) => <Stack gap={2} key={item.id}><Text c="dimmed" size="sm">{item.apiFlavor} · {item.baseUrl}</Text><Group gap="xs" wrap="nowrap"><ConnectionProbeStatus message={probeFeedback.message} status={probeFeedback.status} /><Button disabled={probeFeedback.status === 'pending'} loading={probeFeedback.status === 'pending'} onClick={() => void probe()} variant="light">Probar conexión</Button></Group></Stack>)}{collection.invoices.length === 0 ? <EmptyState title="Aún no hay facturas para analizar" description="Sube o asocia un XML a esta colección primero." /> : <Text c="dimmed" size="sm">{collection.invoices.length} factura{collection.invoices.length === 1 ? '' : 's'} lista{collection.invoices.length === 1 ? '' : 's'} para analizar.</Text>}{collection.invoices.map((invoice) => <Group key={invoice.id} justify="space-between"><Text size="sm">{invoice.fileName}</Text><Button aria-label={`Analizar ${invoice.fileName}`} disabled={!connectionId} loading={busy === invoice.id} onClick={() => void analyze(invoice.id)}>Analizar</Button></Group>)}</>}</Stack></Modal>
}
