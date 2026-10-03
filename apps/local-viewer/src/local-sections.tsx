import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { LocalApiFlavor, LocalConnectionResponse } from '@bill-lm/contracts'
import { ConnectionRow, ContextGuideButton, EmptyState, FieldHelpLabel, SourceFragment } from '@bill-lm/ui'

import {
  LocalDaemonClient,
  type LocalLibrarySummary,
  type LocalOfficialSource,
  type LocalOfficialSourceDetail,
} from './api'

type LocalSectionProps = {
  client: LocalDaemonClient
  navigate: (section: 'collections' | 'profiles') => void
}

export function LocalGpuSettingsSection({ client }: Pick<LocalSectionProps, 'client'>) {
  const [connections, setConnections] = useState<Array<LocalConnectionResponse>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [probeFeedback, setProbeFeedback] = useState<Record<string, { status: 'idle' | 'pending' | 'success' | 'error'; message?: string }>>({})
  const [saving, setSaving] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [apiFlavor, setApiFlavor] = useState<LocalApiFlavor>('openai-like')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:1234/v1')
  const [model, setModel] = useState('')
  const [editing, setEditing] = useState<LocalConnectionResponse | null>(null)
  const [connectionModalOpened, setConnectionModalOpened] = useState(false)
  const [deleting, setDeleting] = useState<LocalConnectionResponse | null>(null)
  const probeGeneration = useRef<Record<string, number>>({})

  const refresh = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      setConnections(await client.listConnections())
    } catch {
      setError('No se pudieron cargar las conexiones locales. Verifica que el daemon esté activo.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  function resetConnectionDraft() {
    setLabel('')
    setApiFlavor('openai-like')
    setBaseUrl('http://127.0.0.1:1234/v1')
    setModel('')
  }

  function closeConnectionModal() {
    setConnectionModalOpened(false)
    setEditing(null)
    resetConnectionDraft()
    setConnectionError(null)
  }

  function openCreate() {
    setEditing(null)
    resetConnectionDraft()
    setConnectionError(null)
    setConnectionModalOpened(true)
  }

  function openEdit(connection: LocalConnectionResponse) {
    setEditing(connection)
    setLabel(connection.label)
    setApiFlavor(connection.apiFlavor)
    setBaseUrl(connection.baseUrl)
    setModel(connection.model)
    setConnectionError(null)
    setConnectionModalOpened(true)
  }

  async function saveConnection() {
    setSaving(true)
    setConnectionError(null)
    try {
      if (editing) {
        const executionChanged = editing.apiFlavor !== apiFlavor || editing.baseUrl !== baseUrl || editing.model !== model
        if (executionChanged) {
          probeGeneration.current[editing.id] = (probeGeneration.current[editing.id] ?? 0) + 1
          setProbeFeedback((current) => ({ ...current, [editing.id]: { status: 'idle' } }))
        }
        await client.updateConnection(editing.id, { label, apiFlavor, baseUrl, model })
      } else {
        await client.createConnection({ label, apiFlavor, baseUrl, model, makeDefault: connections.length === 0 })
      }
      closeConnectionModal()
      await refresh()
    } catch {
      setConnectionError('Revisa los datos de la conexión local e inténtalo nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  async function probe(id: string) {
    const generation = (probeGeneration.current[id] ?? 0) + 1
    probeGeneration.current[id] = generation
    setProbeFeedback((current) => ({ ...current, [id]: { status: 'pending' } }))
    try {
      const result = await client.probeConnection(id)
      if (probeGeneration.current[id] !== generation) return
      setProbeFeedback((current) => ({ ...current, [id]: result.ok ? { status: 'success', message: result.message ?? 'Conexión validada' } : { status: 'error', message: result.message ?? 'La prueba de conexión local falló.' } }))
      await refresh(false)
    } catch {
      if (probeGeneration.current[id] !== generation) return
      setProbeFeedback((current) => ({ ...current, [id]: { status: 'error', message: 'No se pudo probar la conexión local.' } }))
    }
  }

  async function makeDefault(connection: LocalConnectionResponse) {
    setSaving(true); setError(null)
    try { await client.updateConnection(connection.id, { makeDefault: true }); await refresh() }
    catch { setError('No se pudo marcar la conexión como predeterminada.') } finally { setSaving(false) }
  }

  async function removeConnection() {
    if (!deleting) return
    setSaving(true); setError(null)
    try { await client.deleteConnection(deleting.id); setDeleting(null); await refresh() }
    catch { setError('No se pudo eliminar la conexión. Si tiene análisis en cola o en ejecución, espera a que terminen.') } finally { setSaving(false) }
  }

  return <Stack gap="lg">
    <Card withBorder>
      <Stack>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2} size="h3">Conexiones Local-GPU</Title>
            <Text c="dimmed" size="sm">Configura un host OpenAI-like o Claude-like disponible en este equipo o en tu red privada.</Text>
          </div>
          <Button onClick={openCreate}>Agregar conexión</Button>
        </Group>
        {error && <Alert color="red" title="Conexión local no disponible">{error}<Group mt="sm"><Button variant="light" onClick={() => void refresh()}>Reintentar</Button></Group></Alert>}
        {loading ? <Stack><Skeleton height={72} /><Skeleton height={72} /></Stack> : connections.length === 0 ? <EmptyState title="No hay conexiones Local-GPU" description="Agrega un host de inferencia local para analizar facturas desde esta biblioteca." /> : connections.map((connection) => <ConnectionRow actions={<Group gap="xs"><Button size="xs" variant="light" onClick={() => openEdit(connection)}>Editar</Button>{!connection.isDefault && <Button loading={saving} size="xs" variant="light" onClick={() => void makeDefault(connection)}>Predeterminada</Button>}<Button color="red" size="xs" variant="light" onClick={() => setDeleting(connection)}>Eliminar</Button></Group>} hostMetadata={connection.baseUrl} probeDisabled={probeFeedback[connection.id]?.status === 'pending'} isDefault={connection.isDefault} key={connection.id} label={connection.label} model={connection.model} probeMessage={probeFeedback[connection.id]?.message ?? connection.lastProbeError ?? (connection.lastProbedAt ? 'Conexión validada' : null)} probeStatus={probeFeedback[connection.id]?.status ?? (connection.lastProbeError ? 'error' : connection.lastProbedAt ? 'success' : 'idle')} provider={connection.apiFlavor} onProbe={() => void probe(connection.id)} />)}
      </Stack>
    </Card>
    <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar conexión Local-GPU' }} opened={connectionModalOpened} onClose={closeConnectionModal} title={editing ? 'Editar conexión Local-GPU' : 'Agregar conexión Local-GPU'}>
      <Stack>
        {connectionError && <Alert color="red" title="No pudimos guardar la conexión">{connectionError}</Alert>}
        <TextInput label={<FieldHelpLabel label="Nombre" hint="Un nombre para reconocer esta GPU o servidor." />} value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
        <Select data={[{ value: 'openai-like', label: 'OpenAI-like' }, { value: 'claude-like', label: 'Claude-like' }]} label="Tipo de API" value={apiFlavor} onChange={(value) => setApiFlavor((value ?? 'openai-like') as LocalApiFlavor)} />
        <TextInput label={<FieldHelpLabel label="URL base" hint="Ejemplo: http://127.0.0.1:1234/v1. No se envía a Bill-LM cloud." />} value={baseUrl} onChange={(event) => setBaseUrl(event.currentTarget.value)} />
        <TextInput label="Modelo" value={model} onChange={(event) => setModel(event.currentTarget.value)} />
        <Group justify="flex-end"><Button variant="default" onClick={closeConnectionModal}>Cancelar</Button><Button disabled={!label || !model} loading={saving} onClick={() => void saveConnection()}>{editing ? 'Guardar cambios' : 'Guardar conexión'}</Button></Group>
      </Stack>
    </Modal>
    <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar eliminación de conexión' }} opened={deleting !== null} onClose={() => setDeleting(null)} title="Eliminar conexión Local-GPU">
      <Stack><Text>Eliminarás “{deleting?.label}”. Esta acción no modifica análisis anteriores ni datos de facturas.</Text><Text c="dimmed" size="sm">No se puede eliminar una conexión con análisis en cola o en ejecución.</Text><Group justify="flex-end"><Button variant="default" onClick={() => setDeleting(null)}>Cancelar</Button><Button color="red" loading={saving} onClick={() => void removeConnection()}>Eliminar conexión</Button></Group></Stack>
    </Modal>
  </Stack>
}

function dateLabel(value: string | null) { return value ?? 'Sin fecha declarada' }

const sourceKindLabel: Record<string, string> = {
  law: 'Ley', regulation: 'Reglamento', resolution: 'Resolución', guidance: 'Guía', other: 'Otra fuente',
}
const reviewStatusLabel: Record<string, string> = {
  reviewed: 'Revisada', draft: 'Borrador', 'local-snapshot': 'Snapshot local',
}
const sourcePurposeLabel: Record<string, string> = {
  personal_expenses: 'Gastos personales', income_tax: 'Impuesto a la renta', vat: 'IVA',
  general: 'Régimen general', rimpe_entrepreneur: 'RIMPE emprendedor', rimpe_popular_business: 'RIMPE negocio popular',
}
function localizedSourceValue(value: string, labels: Record<string, string>) { return labels[value] ?? value.replaceAll('_', ' ') }

export function OfficialSourcesSection({ client }: Pick<LocalSectionProps, 'client'>) {
  const [sources, setSources] = useState<Array<LocalOfficialSource>>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<LocalOfficialSourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [guideOpened, setGuideOpened] = useState(false)
  const detailRequest = useRef(0)

  const refresh = async () => {
    setLoading(true); setSourceError(null)
    try { setSources(await client.listOfficialSources()) } catch { setSourceError('No se pudo leer el snapshot local de fuentes oficiales.') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function openSource(id: string) {
    const request = ++detailRequest.current
    setSelectedId(id)
    setSelected(null)
    setDetailError(null)
    setDetailLoading(true)
    try { const detail = await client.getOfficialSource(id); if (request === detailRequest.current) setSelected(detail) } catch { if (request === detailRequest.current) setDetailError('No se pudieron cargar las secciones de esta fuente local.') } finally { if (request === detailRequest.current) setDetailLoading(false) }
  }

  return <Stack gap="lg">
      <div><Group gap="xs"><Title order={1}>Fuentes oficiales</Title><ContextGuideButton title="fuentes oficiales" onClick={() => setGuideOpened(true)} /></Group><Text c="dimmed" size="sm">Snapshot local de solo lectura incluido con este visor. No se consulta al SRI mientras navegas estas fuentes.</Text></div>
      {sourceError && <Alert color="red" title="Fuentes locales no disponibles">{sourceError}<Group mt="sm"><Button variant="light" onClick={() => void refresh()}>Reintentar</Button></Group></Alert>}
      {loading ? <Stack><Skeleton height={100} /><Skeleton height={100} /></Stack> : sources.length === 0 ? <EmptyState title="No hay fuentes en el snapshot local" description="El daemon no encontró manifiestos de fuentes en el ruleset incluido." /> : sources.map((source) => <Paper key={source.id} withBorder p="md"><Stack gap="xs"><Group justify="space-between"><Text fw={600}>{source.title}</Text><Badge color="violet">Snapshot local</Badge></Group><Text c="dimmed" size="sm">{source.issuer} · {source.jurisdiction} · {localizedSourceValue(source.sourceKind, sourceKindLabel)}</Text><Text c="dimmed" size="xs">Origen: ruleset local incluido · {localizedSourceValue(source.reviewStatus, reviewStatusLabel)}</Text><Text c="dimmed" size="xs">Vigencia: {dateLabel(source.effectiveFrom)} — {dateLabel(source.effectiveTo)} · {source.sectionCount} secciones</Text><Group justify="space-between" wrap="wrap"><Text c="dimmed" size="xs">{source.contentHash ?? 'Sin hash declarado'}</Text><Group gap="xs"><Button variant="light" onClick={() => void openSource(source.id)}>Ver secciones</Button>{(source.officialUrl ?? source.resolvedUrl) && <Anchor href={source.officialUrl ?? source.resolvedUrl ?? undefined} target="_blank" rel="noreferrer" size="sm">Abrir fuente <ExternalLink size={13} /></Anchor>}</Group></Group></Stack></Paper>)}
    <Drawer closeButtonProps={{ 'aria-label': 'Cerrar fuente oficial' }} opened={selectedId !== null} onClose={() => { detailRequest.current += 1; setSelectedId(null); setSelected(null); setDetailError(null) }} position="right" size="lg" scrollAreaComponent={ScrollArea.Autosize} title={selected?.title ?? 'Fuente oficial'}>
      {detailLoading && <Stack><Skeleton height={100} /><Skeleton height={140} /></Stack>}
      {detailError && <Alert color="red" title="Secciones locales no disponibles">{detailError}<Group mt="sm"><Button variant="light" onClick={() => selectedId && void openSource(selectedId)}>Reintentar</Button></Group></Alert>}
      {selected && <Stack><Alert color="violet" title="Snapshot local de solo lectura">{selected.ruleset.id} · versión {selected.ruleset.version}</Alert><Text c="dimmed" size="sm">{selected.issuer} · {selected.jurisdiction} · {localizedSourceValue(selected.sourceKind, sourceKindLabel)}</Text><Text c="dimmed" size="xs">Origen: ruleset local incluido · {localizedSourceValue(selected.reviewStatus, reviewStatusLabel)}</Text><Text c="dimmed" size="xs">Hash: {selected.contentHash ?? 'Sin hash declarado'}</Text><Text c="dimmed" size="sm">{selected.fragments.length} secciones vinculadas a esta fuente.</Text>{selected.fragments.length === 0 ? <EmptyState title="Sin secciones locales" description="Este snapshot no contiene fragmentos indexados para la fuente." /> : selected.fragments.map((fragment) => <SourceFragment content={fragment.contentMarkdown ?? ''} effectiveLabel={`Vigencia: ${dateLabel(fragment.effectiveFrom)} — ${dateLabel(fragment.effectiveTo)}`} key={fragment.id} purposes={[...fragment.purposes, ...fragment.taxRegimes].map((value) => localizedSourceValue(value, sourcePurposeLabel))} rulesets={`Páginas: ${fragment.sourcePages.join(', ') || 'sin referencia'} · ${localizedSourceValue(fragment.reviewStatus, reviewStatusLabel)}`} title={fragment.articleOrSection} />)}</Stack>}
    </Drawer>
    <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar guía de fuentes oficiales' }} opened={guideOpened} onClose={() => setGuideOpened(false)} title="Guía de fuentes oficiales"><Stack><Text>Estas fuentes son un snapshot incluido en el ruleset local. Se muestran solo para dar contexto al análisis.</Text><Text size="sm" c="dimmed">Navegarlas no consulta al SRI. Los enlaces externos solo se abren cuando los seleccionas.</Text></Stack></Modal>
  </Stack>
}

export function LocalLibrarySection({ client, navigate }: LocalSectionProps) {
  const [summary, setSummary] = useState<LocalLibrarySummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [guideOpened, setGuideOpened] = useState(false)
  const refresh = async () => { setLoading(true); setError(null); try { setSummary(await client.getLibrarySummary()) } catch { setError('No se pudo leer el resumen de esta biblioteca local.') } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  const isEmpty = summary !== null && summary.invoiceCount === 0 && summary.collectionCount === 0 && summary.profileCount === 0 && summary.activityCount === 0 && summary.runCount === 0
  return <Stack gap="lg">
    <div><Group gap="xs"><Title order={1}>Biblioteca local</Title><ContextGuideButton title="biblioteca local" onClick={() => setGuideOpened(true)} /></Group><Text c="dimmed" size="sm">Las facturas XML, colecciones, perfiles, actividades e historial se conservan en este equipo. No hay sincronización cloud, rutas de disco ni acciones de borrado aquí.</Text></div>
    {error && <Alert color="red" title="Biblioteca local no disponible">{error}<Group mt="sm"><Button variant="light" onClick={() => void refresh()}>Reintentar</Button></Group></Alert>}
    {loading ? <Stack><Skeleton height={72} /><Skeleton height={72} /></Stack> : isEmpty ? <EmptyState title="Tu biblioteca local está vacía" description="Todavía no hay XML, colecciones, perfiles, actividades ni análisis guardados en este equipo." action={<Group><Button onClick={() => navigate('collections')}>Ver colecciones</Button><Button variant="light" onClick={() => navigate('profiles')}>Crear perfil o actividad</Button></Group>} /> : summary && <><SimpleGrid cols={{ base: 1, sm: 3 }}><Paper withBorder p="md"><Text c="dimmed" size="sm">Facturas XML</Text><Title order={2}>{summary.invoiceCount}</Title></Paper><Paper withBorder p="md"><Text c="dimmed" size="sm">Colecciones</Text><Title order={2}>{summary.collectionCount}</Title></Paper><Paper withBorder p="md"><Text c="dimmed" size="sm">Análisis</Text><Title order={2}>{summary.runCount}</Title></Paper><Paper withBorder p="md"><Text c="dimmed" size="sm">Perfiles</Text><Title order={2}>{summary.profileCount}</Title></Paper><Paper withBorder p="md"><Text c="dimmed" size="sm">Actividades</Text><Title order={2}>{summary.activityCount}</Title></Paper></SimpleGrid><Alert color="violet" title="Ruleset incluido">{summary.ruleset ? `${summary.ruleset.id} · versión ${summary.ruleset.version}` : 'No hay ruleset local disponible.'}</Alert><Group><Button onClick={() => navigate('collections')}>Ver colecciones</Button><Button variant="light" onClick={() => navigate('profiles')}>Ver perfiles y actividades</Button></Group></>}
    <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar guía de biblioteca local' }} opened={guideOpened} onClose={() => setGuideOpened(false)} title="Guía de biblioteca local"><Stack><Text>Este resumen solo muestra datos que el daemon guarda en esta biblioteca local.</Text><Text size="sm" c="dimmed">No expone rutas de disco, no sincroniza con la cloud y no elimina ni exporta datos desde esta pantalla.</Text></Stack></Modal>
  </Stack>
}
