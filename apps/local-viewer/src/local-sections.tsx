import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { LocalApiFlavor, LocalConnectionResponse } from '@bill-lm/contracts'
import { EmptyState, FieldHelpLabel } from '@bill-lm/ui'

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
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [apiFlavor, setApiFlavor] = useState<LocalApiFlavor>('openai-like')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:1234/v1')
  const [model, setModel] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setConnections(await client.listConnections())
    } catch {
      setError('No se pudieron cargar las conexiones locales. Verifica que el daemon esté activo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await client.createConnection({ label, apiFlavor, baseUrl, model, makeDefault: connections.length === 0 })
      setLabel('')
      setModel('')
      await refresh()
    } catch {
      setError('Revisa los datos de la conexión local e inténtalo nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  async function probe(id: string) {
    setProbing(id)
    setError(null)
    try {
      const result = await client.probeConnection(id)
      if (!result.ok) setError(result.message ?? 'La prueba de conexión local falló.')
      await refresh()
    } catch {
      setError('No se pudo probar la conexión local.')
    } finally {
      setProbing(null)
    }
  }

  return <Stack gap="lg">
    <Card withBorder>
      <Stack>
        <div>
          <Title order={2} size="h3">Conexiones Local-GPU</Title>
          <Text c="dimmed" size="sm">Configura un host OpenAI-like o Claude-like disponible en este equipo o en tu red privada.</Text>
        </div>
        {error && <Alert color="red" title="Conexión local no disponible">{error}<Group mt="sm"><Button variant="light" onClick={() => void refresh()}>Reintentar</Button></Group></Alert>}
        {loading ? <Stack><Skeleton height={72} /><Skeleton height={72} /></Stack> : connections.length === 0 ? <EmptyState title="No hay conexiones Local-GPU" description="Agrega un host de inferencia local para analizar facturas desde esta biblioteca." /> : connections.map((connection) => <Card key={connection.id} withBorder padding="sm">
          <Group justify="space-between" align="flex-start">
            <div><Group gap="xs"><Text fw={600}>{connection.label}</Text>{connection.isDefault && <Badge color="violet">Predeterminada</Badge>}</Group><Text c="dimmed" size="sm">{connection.apiFlavor} · {connection.model}</Text><Text c="dimmed" size="xs">{connection.baseUrl}</Text>{connection.lastProbeError && <Text c="red" size="xs">Última prueba: {connection.lastProbeError}</Text>}</div>
            <Button loading={probing === connection.id} variant="light" onClick={() => void probe(connection.id)}>Probar</Button>
          </Group>
        </Card>)}
      </Stack>
    </Card>
    <Card withBorder>
      <Stack>
        <Title order={2} size="h3">Agregar conexión local-GPU</Title>
        <TextInput label={<FieldHelpLabel label="Nombre" hint="Un nombre para reconocer esta GPU o servidor." />} value={label} onChange={(event) => setLabel(event.currentTarget.value)} />
        <Select data={[{ value: 'openai-like', label: 'OpenAI-like' }, { value: 'claude-like', label: 'Claude-like' }]} label="Tipo de API" value={apiFlavor} onChange={(value) => setApiFlavor((value ?? 'openai-like') as LocalApiFlavor)} />
        <TextInput label={<FieldHelpLabel label="URL base" hint="Ejemplo: http://127.0.0.1:1234/v1. No se envía a Bill-LM cloud." />} value={baseUrl} onChange={(event) => setBaseUrl(event.currentTarget.value)} />
        <TextInput label="Modelo" value={model} onChange={(event) => setModel(event.currentTarget.value)} />
        <Group justify="flex-end"><Button disabled={!label || !model} loading={saving} onClick={() => void save()}>Guardar conexión</Button></Group>
      </Stack>
    </Card>
  </Stack>
}

function dateLabel(value: string | null) { return value ?? 'Sin fecha declarada' }

export function OfficialSourcesSection({ client }: Pick<LocalSectionProps, 'client'>) {
  const [sources, setSources] = useState<Array<LocalOfficialSource>>([])
  const [selected, setSelected] = useState<LocalOfficialSourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true); setError(null)
    try { setSources(await client.listOfficialSources()) } catch { setError('No se pudo leer el snapshot local de fuentes oficiales.') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function openSource(id: string) {
    try { setSelected(await client.getOfficialSource(id)) } catch { setError('No se pudieron cargar las secciones de esta fuente local.') }
  }

  return <>
    <Card withBorder><Stack>
      <div><Title order={2} size="h3">Fuentes oficiales</Title><Text c="dimmed" size="sm">Snapshot local incluido con este visor. No se consulta al SRI mientras navegas estas fuentes.</Text></div>
      {error && <Alert color="red" title="Fuentes locales no disponibles">{error}<Group mt="sm"><Button variant="light" onClick={() => void refresh()}>Reintentar</Button></Group></Alert>}
      {loading ? <Stack><Skeleton height={100} /><Skeleton height={100} /></Stack> : sources.length === 0 ? <EmptyState title="No hay fuentes en el snapshot local" description="El daemon no encontró manifiestos de fuentes en el ruleset incluido." /> : sources.map((source) => <Card key={source.id} withBorder padding="md"><Stack gap="xs"><Group justify="space-between"><Text fw={600}>{source.title}</Text><Badge color="violet">Snapshot local</Badge></Group><Text c="dimmed" size="sm">{source.issuer} · {source.jurisdiction} · {source.sourceKind}</Text><Text c="dimmed" size="xs">Vigencia: {dateLabel(source.effectiveFrom)} — {dateLabel(source.effectiveTo)} · {source.sectionCount} secciones</Text><Group justify="space-between"><Text c="dimmed" size="xs">{source.contentHash ?? 'Sin hash declarado'}</Text><Group gap="xs"><Button variant="light" onClick={() => void openSource(source.id)}>Ver secciones</Button>{(source.officialUrl ?? source.resolvedUrl) && <Anchor href={source.officialUrl ?? source.resolvedUrl ?? undefined} target="_blank" rel="noreferrer" size="sm">Abrir fuente <ExternalLink size={13} /></Anchor>}</Group></Group></Stack></Card>)}
    </Stack></Card>
    <Drawer opened={selected !== null} onClose={() => setSelected(null)} position="right" size="lg" title={selected?.title ?? 'Fuente oficial'}>
      {selected && <Stack><Alert color="violet" title="Snapshot local">{selected.ruleset.id} · versión {selected.ruleset.version}</Alert><Text c="dimmed" size="sm">{selected.fragments.length} secciones vinculadas a esta fuente.</Text>{selected.fragments.length === 0 ? <EmptyState title="Sin secciones locales" description="Este snapshot no contiene fragmentos indexados para la fuente." /> : selected.fragments.map((fragment) => <Card key={fragment.id} withBorder><Stack gap="xs"><Text fw={600}>{fragment.articleOrSection}</Text><Text c="dimmed" size="xs">Vigencia: {dateLabel(fragment.effectiveFrom)} — {dateLabel(fragment.effectiveTo)}</Text>{fragment.contentMarkdown && <Text size="sm">{fragment.contentMarkdown}</Text>}<Text c="dimmed" size="xs">Páginas: {fragment.sourcePages.join(', ') || 'sin referencia'} · {fragment.reviewStatus}</Text></Stack></Card>)}</Stack>}
    </Drawer>
  </>
}

export function LocalLibrarySection({ client, navigate }: LocalSectionProps) {
  const [summary, setSummary] = useState<LocalLibrarySummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = async () => { setError(null); try { setSummary(await client.getLibrarySummary()) } catch { setError('No se pudo leer el resumen de esta biblioteca local.') } }
  useEffect(() => { void refresh() }, [])
  return <Card withBorder><Stack>
    <div><Title order={2} size="h3">Biblioteca local</Title><Text c="dimmed" size="sm">Las facturas XML, colecciones, perfiles, actividades e historial se conservan en este equipo.</Text></div>
    {error && <Alert color="red" title="Biblioteca local no disponible">{error}<Group mt="sm"><Button variant="light" onClick={() => void refresh()}>Reintentar</Button></Group></Alert>}
    {!summary ? <Stack><Skeleton height={72} /><Skeleton height={72} /></Stack> : <><Group grow><Card withBorder><Text c="dimmed" size="sm">Facturas XML</Text><Title order={3}>{summary.invoiceCount}</Title></Card><Card withBorder><Text c="dimmed" size="sm">Colecciones</Text><Title order={3}>{summary.collectionCount}</Title></Card><Card withBorder><Text c="dimmed" size="sm">Análisis</Text><Title order={3}>{summary.runCount}</Title></Card></Group><Group grow><Card withBorder><Text c="dimmed" size="sm">Perfiles</Text><Title order={3}>{summary.profileCount}</Title></Card><Card withBorder><Text c="dimmed" size="sm">Actividades</Text><Title order={3}>{summary.activityCount}</Title></Card></Group><Alert color="violet" title="Ruleset incluido">{summary.ruleset ? `${summary.ruleset.id} · versión ${summary.ruleset.version}` : 'No hay ruleset local disponible.'}</Alert><Group><Button onClick={() => navigate('collections')}>Ver colecciones</Button><Button variant="light" onClick={() => navigate('profiles')}>Ver perfiles y actividades</Button></Group></>}
  </Stack></Card>
}
