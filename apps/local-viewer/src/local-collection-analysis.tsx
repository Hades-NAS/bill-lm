import { ConnectionProbeStatus, EmptyState } from '@bill-lm/ui'
import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'

import type { LocalDaemonClient } from './api'
import type {
  LocalCollectionDetail,
  LocalConnectionResponse,
} from '@bill-lm/contracts'

type Props = {
  client: LocalDaemonClient
  collection: LocalCollectionDetail
  onChanged: () => Promise<void> | void
  onQueued?: (batch: {
    batchId: string
    invoiceCount: number
    queuedAt: string
  }) => void
  onOpenSettings?: () => void
  opened?: boolean
  onClose?: () => void
}

export function LocalCollectionAnalysis({
  client,
  collection,
  onChanged,
  onQueued = () => {},
  onOpenSettings = () => {},
  opened = true,
  onClose = () => {},
}: Props) {
  const [connections, setConnections] = useState<LocalConnectionResponse[]>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [probeFeedback, setProbeFeedback] = useState<{
    status: 'idle' | 'pending' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const probeGeneration = useRef(0)
  const analyzeGeneration = useRef(0)

  async function refresh() {
    try {
      const next = await client.listConnections()
      setConnections(next)
      setConnectionId((current) =>
        current && next.some((item) => item.id === current)
          ? current
          : (next.find((item) => item.isDefault)?.id ?? next[0]?.id ?? null),
      )
    } catch {
      setError('No se pudieron leer las conexiones Local-GPU del daemon local.')
    }
  }

  useEffect(() => {
    probeGeneration.current += 1
    analyzeGeneration.current += 1
    setProbeFeedback({ status: 'idle' })
    setSubmitting(false)
    if (opened) void refresh()
  }, [opened, collection.id])

  async function probe() {
    if (!connectionId) return
    const generation = ++probeGeneration.current
    setProbeFeedback({ status: 'pending' })
    setError(null)
    try {
      const response = await client.probeConnection(connectionId)
      if (generation !== probeGeneration.current) return
      setProbeFeedback(
        response.ok
          ? {
              status: 'success',
              message:
                response.message ??
                'El host Local-GPU respondió correctamente.',
            }
          : {
              status: 'error',
              message: response.message ?? 'La prueba de Local-GPU falló.',
            },
      )
      await refresh()
    } catch {
      if (generation === probeGeneration.current)
        setProbeFeedback({
          status: 'error',
          message: 'No se pudo probar el host Local-GPU.',
        })
    }
  }

  async function analyzeCollection() {
    if (!connectionId || submitting || collection.invoices.length === 0) return
    const generation = ++analyzeGeneration.current
    setSubmitting(true)
    setError(null)
    try {
      const batch = await client.analyzeCollection({
        collectionId: collection.id,
        connectionId,
      })
      if (generation !== analyzeGeneration.current) return
      await onChanged()
      if (generation === analyzeGeneration.current) {
        onClose()
        onQueued(batch)
      }
    } catch {
      if (generation === analyzeGeneration.current)
        setError(
          'El daemon no pudo iniciar el análisis de esta colección. Verifica el host y vuelve a probarlo.',
        )
    } finally {
      if (generation === analyzeGeneration.current) setSubmitting(false)
    }
  }

  function close() {
    probeGeneration.current += 1
    analyzeGeneration.current += 1
    onClose()
  }

  return (
    <Modal
      centered
      closeButtonProps={{ 'aria-label': 'Cerrar análisis de colección' }}
      opened={opened}
      size="lg"
      title="Analizar colección"
      onClose={close}
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          El perfil y las actividades se toman de la revisión de contexto
          actual. Selecciona el host global para esta ejecución local.
        </Text>
        {error && (
          <Alert color="red" title="Análisis local no disponible">
            {error}
          </Alert>
        )}
        {!collection.latestRevision ? (
          <EmptyState
            description="Define propósito, período y perfil tributario antes de analizar facturas localmente."
            title="Configura el contexto de la colección"
          />
        ) : connections.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={onOpenSettings}>Ir a Configuración</Button>
            }
            description="Configura un host global antes de ejecutar análisis para esta colección."
            title="No hay conexiones Local-GPU"
          />
        ) : (
          <>
            <Select
              data={connections.map((item) => ({
                value: item.id,
                label: `${item.label} · ${item.model}`,
              }))}
              label="Conexión"
              value={connectionId}
              onChange={(id) => {
                probeGeneration.current += 1
                setConnectionId(id)
                setProbeFeedback({ status: 'idle' })
              }}
            />
            {connections
              .filter((item) => item.id === connectionId)
              .map((item) => (
                <Stack gap={2} key={item.id}>
                  <Text c="dimmed" size="sm">
                    {item.apiFlavor} · {item.baseUrl}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <ConnectionProbeStatus
                      message={probeFeedback.message}
                      status={probeFeedback.status}
                    />
                    <Button
                      disabled={probeFeedback.status === 'pending'}
                      loading={probeFeedback.status === 'pending'}
                      variant="light"
                      onClick={() => void probe()}
                    >
                      Probar conexión
                    </Button>
                  </Group>
                </Stack>
              ))}
            {collection.invoices.length === 0 ? (
              <EmptyState
                description="Sube o asocia un XML a esta colección primero."
                title="Aún no hay facturas para analizar"
              />
            ) : (
              <>
                <Text c="dimmed" size="sm">
                  {collection.invoices.length} factura
                  {collection.invoices.length === 1 ? '' : 's'} lista
                  {collection.invoices.length === 1 ? '' : 's'} para analizar.
                  El daemon las enviará una por una y continuará aunque alguna
                  falle.
                </Text>
                <Group justify="flex-end">
                  <Button
                    disabled={!connectionId}
                    loading={submitting}
                    onClick={() => void analyzeCollection()}
                  >
                    Analizar colección
                  </Button>
                </Group>
              </>
            )}
          </>
        )}
      </Stack>
    </Modal>
  )
}
