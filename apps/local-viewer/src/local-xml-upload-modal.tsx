import '@mantine/dropzone/styles.css'

import { Alert, Badge, Button, Group, List, Modal, Stack, Text } from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { useEffect, useRef, useState } from 'react'

import type { LocalDaemonClient } from './api'

type UploadStatus = 'pending' | 'uploading' | 'imported' | 'duplicate' | 'invalid-xml' | 'network'
type UploadItem = { id: string; file: File; status: UploadStatus; message?: string }

const xmlAccept = { 'application/xml': ['.xml'], 'text/xml': ['.xml'] }
const maxFiles = 10
const maxSize = 5 * 1024 ** 2

function uploadMessage(item: UploadItem) {
  if (item.status === 'imported') return 'Importada y asociada'
  if (item.status === 'duplicate') return 'Ya existía en la biblioteca'
  if (item.status === 'invalid-xml') return item.message ?? 'El daemon no pudo leer este XML.'
  if (item.status === 'network') return 'No se pudo conectar al daemon local.'
  return item.status === 'uploading' ? 'Importando…' : 'Pendiente'
}

export function LocalXmlUploadModal({
  client,
  collectionId,
  opened,
  onClose,
  onCompleted,
}: {
  client: LocalDaemonClient
  collectionId: string
  opened: boolean
  onClose: () => void
  onCompleted: () => Promise<void>
}) {
  const [items, setItems] = useState<Array<UploadItem>>([])
  const [rejections, setRejections] = useState<Array<string>>([])
  const [submitting, setSubmitting] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const mounted = useRef(true)
  const generation = useRef(0)

  useEffect(() => () => { mounted.current = false; generation.current += 1 }, [])

  function resetAndClose() {
    generation.current += 1
    setItems([])
    setRejections([])
    setDiscarding(false)
    onClose()
  }

  function requestClose() {
    if (submitting) return
    if (items.length || rejections.length) {
      setDiscarding(true)
      return
    }
    resetAndClose()
  }

  function addFiles(files: File[]) {
    setItems((current) => {
      const available = Math.max(0, maxFiles - current.length)
      return [...current, ...files.slice(0, available).map((file, index) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${current.length + index}`, file, status: 'pending' as const }))]
    })
  }

  async function submit() {
    const pending = items.filter((item) => item.status === 'pending')
    if (!pending.length || submitting) return
    const currentGeneration = generation.current
    setSubmitting(true)
    let completedRequest = false
    for (const item of pending) {
      if (!mounted.current || currentGeneration !== generation.current) return
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: 'uploading' } : candidate))
      try {
        const result = await client.importCollectionXml(collectionId, item.file)
        completedRequest = true
        if (!mounted.current || currentGeneration !== generation.current) return
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: result.kind, message: result.kind === 'invalid-xml' ? result.message : undefined } : candidate))
      } catch {
        completedRequest = true
        if (!mounted.current || currentGeneration !== generation.current) return
        setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: 'network' } : candidate))
      }
    }
    if (!mounted.current || currentGeneration !== generation.current) return
    if (completedRequest) await onCompleted()
    if (mounted.current && currentGeneration === generation.current) setSubmitting(false)
  }

  const pendingCount = items.filter((item) => item.status === 'pending').length

  return <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar carga de facturas XML' }} opened={opened} onClose={requestClose} title="Subir facturas XML">
    <Stack>
      <Text c="dimmed" size="sm">Selecciona o arrastra hasta 10 XML de máximo 5 MB. Cada archivo se importa por separado a esta colección local.</Text>
      {rejections.length > 0 && <Alert color="red" title="Archivos rechazados"><List size="sm">{rejections.map((rejection) => <List.Item key={rejection}>{rejection}</List.Item>)}</List></Alert>}
      <Dropzone accept={xmlAccept} disabled={submitting} maxFiles={maxFiles} maxSize={maxSize} multiple onDrop={addFiles} onReject={(files) => setRejections(files.map(({ file, errors }) => `${file.name}: ${errors.map((error) => error.message).join(', ')}`))}>
        <Group justify="center" mih={110} p="md"><Stack gap={2} align="center"><Text fw={600}>Arrastra XML aquí</Text><Text c="dimmed" size="sm">o selecciónalos desde tu equipo</Text></Stack></Group>
      </Dropzone>
      {items.length > 0 && <List spacing="xs">{items.map((item) => <List.Item key={item.id} icon={<Badge color={item.status === 'imported' ? 'green' : item.status === 'duplicate' ? 'blue' : item.status === 'invalid-xml' || item.status === 'network' ? 'red' : 'gray'}>{item.status}</Badge>}>
        <Group justify="space-between" wrap="nowrap"><div><Text size="sm">{item.file.name}</Text><Text c="dimmed" size="xs">{uploadMessage(item)}</Text></div>{item.status === 'pending' && <Button aria-label={`Quitar ${item.file.name}`} disabled={submitting} onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} size="compact-xs" variant="subtle">Quitar</Button>}</Group>
      </List.Item>)}</List>}
      {discarding && <Alert color="orange" title="¿Descartar la carga?">Se perderán los archivos y resultados visibles de esta carga.<Group mt="sm"><Button onClick={resetAndClose} size="xs" color="red">Descartar</Button><Button onClick={() => setDiscarding(false)} size="xs" variant="default">Seguir aquí</Button></Group></Alert>}
      <Group justify="flex-end"><Button disabled={submitting} onClick={requestClose} variant="default">Cerrar</Button><Button disabled={!pendingCount || submitting} loading={submitting} onClick={() => void submit()}>{pendingCount ? `Importar ${pendingCount} archivo${pendingCount === 1 ? '' : 's'}` : 'Sin archivos pendientes'}</Button></Group>
    </Stack>
  </Modal>
}
