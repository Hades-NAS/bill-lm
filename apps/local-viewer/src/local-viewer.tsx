import {
  Alert,
  AppShell,
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Drawer,
  Group,
  Indicator,
  Loader,
  Modal,
  MultiSelect,
  NavLink,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { useMantineColorScheme } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Bell, BookOpen, BriefcaseBusiness, History, LibraryBig, Menu, Moon, NotepadText, Plus, Settings, Sparkles, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CollectionCardPresentation, EmptyState, ExecutionStatusBadge, FieldHelpLabel, InvoiceDetails, RunListItem } from '@bill-lm/ui'

import {
  CollectionContextRevisionInputSchema,
} from '@bill-lm/contracts'

import { LocalDaemonClient } from './api'
import { LocalGpuSettingsSection, LocalLibrarySection, OfficialSourcesSection } from './local-sections'
import { LocalCollectionAnalysis } from './local-collection-analysis'
import { LocalProfilesSection } from './local-profiles-section'
import { LocalXmlUploadModal } from './local-xml-upload-modal'

import type {
  CollectionContextRevisionInput,
  LocalCollectionDetail,
  LocalInvoiceDetail,
  LocalRunDetail,
  LocalRunSummary,
  ModelTaxAnalysisPayload,
} from '@bill-lm/contracts'
import type { LocalCollectionContext, LocalEconomicActivity, LocalTaxpayerProfile } from './api'

const client = new LocalDaemonClient()

const today = new Date().toISOString().slice(0, 10)
const blankCollectionContext: CollectionContextRevisionInput = {
  purpose: 'personal_expenses',
  period: { startDate: today, endDate: today },
  taxpayerProfileRevisionId: '',
  activityRevisionIds: [],
  notes: '',
}

type LocalRoute =
  | { section: 'collections'; collectionId?: string }
  | { section: 'profiles' | 'settings' | 'official-sources' | 'library' }

const navigation = [
  { section: 'collections' as const, label: 'Colecciones', icon: LibraryBig },
  { section: 'profiles' as const, label: 'Perfiles y actividades', icon: BriefcaseBusiness },
  { section: 'settings' as const, label: 'Configuración', icon: Settings },
  { section: 'official-sources' as const, label: 'Fuentes oficiales', icon: BookOpen },
  { section: 'library' as const, label: 'Biblioteca local', icon: LibraryBig },
]
const localHashPrefix = '#' + '/'

function parseLocalRoute(hash: string): LocalRoute {
  const parts = hash.replace(new RegExp('^#' + '/?'), '').split('/').filter(Boolean)
  if (parts[0] === 'collections')
    return { section: 'collections', collectionId: parts[1] }
  if (parts[0] === 'account') return { section: 'library' }
  if (parts[0] === 'profiles' || parts[0] === 'settings' || parts[0] === 'official-sources' || parts[0] === 'library')
    return { section: parts[0] }
  return { section: 'collections' }
}

function hashForRoute(section: LocalRoute['section'], collectionId?: string) {
  return section === 'collections' && collectionId
    ? `${localHashPrefix}collections/${collectionId}`
    : `${localHashPrefix}${section}`
}

const analysisClassificationMeta = {
  eligible: { label: 'Aplicable', color: 'green' },
  ineligible: { label: 'No aplicable', color: 'red' },
  needs_review: { label: 'Requiere revisión', color: 'orange' },
} as const

function formatLocalCurrency(value: number) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function localAnalysisAmount(payload: ModelTaxAnalysisPayload) {
  if (payload.purpose === 'vat_credit') return payload.potentialCreditableVatAmount
  if (payload.purpose === 'business_income_tax') return payload.potentialExpenseAmount
  return payload.potentialEligibleAmount
}

function localNumber(value: string | null) {
  if (value === null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatRunTime(value: string) {
  return new Date(value).toLocaleString('es-EC')
}

export function LocalViewer() {
  const [mobileOpened, { close: closeMobile, toggle: toggleMobile }] = useDisclosure(false)
  const [createCollectionOpened, createCollectionModal] = useDisclosure(false)
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const [route, setRoute] = useState<LocalRoute>(() => parseLocalRoute(window.location.hash))
  const [message, setMessage] = useState<string | null>(null)
  const [xmlUploadOpened, setXmlUploadOpened] = useState(false)
  const [rulesetLabel, setRulesetLabel] = useState('Cargando ruleset aprobado…')
  const [invoices, setInvoices] = useState<
    Array<{ id: string; fileName: string }>
  >([])
  const [activities, setActivities] = useState<Array<LocalEconomicActivity>>([])
  const [profiles, setProfiles] = useState<Array<LocalTaxpayerProfile>>([])
  const [collections, setCollections] = useState<Array<LocalCollectionContext>>([])
  const [collectionNameFilter, setCollectionNameFilter] = useState('')
  const [collectionYearFilter, setCollectionYearFilter] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionYear, setNewCollectionYear] = useState(String(new Date().getFullYear()))
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [metadataOpened, setMetadataOpened] = useState(false)
  const [metadataName, setMetadataName] = useState('')
  const [metadataYear, setMetadataYear] = useState('')
  const [metadataDescription, setMetadataDescription] = useState('')
  const [contextError, setContextError] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [collectionDraft, setCollectionDraft] = useState(blankCollectionContext)
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [collectionLoadError, setCollectionLoadError] = useState(false)
  const [savingCollection, setSavingCollection] = useState(false)
  const [collectionDetail, setCollectionDetail] = useState<LocalCollectionDetail | null>(null)
  const [loadingCollectionDetail, setLoadingCollectionDetail] = useState(false)
  const [collectionDetailError, setCollectionDetailError] = useState(false)
  const [attachInvoiceId, setAttachInvoiceId] = useState<string | null>(null)
  const [invoiceFilter, setInvoiceFilter] = useState('')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
  const [detachInvoiceIds, setDetachInvoiceIds] = useState<string[]>([])
  const [contextOpened, setContextOpened] = useState(false)
  const [analysisOpened, setAnalysisOpened] = useState(false)
  const [jobsOpened, setJobsOpened] = useState(false)
  const [jobsScope, setJobsScope] = useState<string | null>(null)
  const [drawerLevel, setDrawerLevel] = useState<'list' | 'run' | 'invoice'>('list')
  const [runDetail, setRunDetail] = useState<LocalRunDetail | null>(null)
  const [runDetailLoading, setRunDetailLoading] = useState(false)
  const [runDetailError, setRunDetailError] = useState<string | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<LocalInvoiceDetail | null>(null)
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false)
  const [invoiceOrigin, setInvoiceOrigin] = useState<'list' | 'run'>('list')
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [globalRuns, setGlobalRuns] = useState<Array<LocalRunSummary>>([])
  const [historyRuns, setHistoryRuns] = useState<Array<LocalRunSummary>>([])
  const drawerRequest = useRef(0)
  const collectionRequest = useRef(0)
  const historyRequest = useRef(0)
  const jobsScopeRef = useRef<string | null>(null)
  const jobsOpenedRef = useRef(false)

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = parseLocalRoute(window.location.hash)
      const canonicalHash = hashForRoute(
        nextRoute.section,
        nextRoute.section === 'collections' ? nextRoute.collectionId : undefined,
      )
      if (window.location.hash !== canonicalHash)
        window.location.hash = canonicalHash
      setRoute(nextRoute)
      closeMobile()
    }
    syncRoute()
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [closeMobile])

  function navigate(section: LocalRoute['section'], collectionId?: string) {
    window.location.hash = hashForRoute(section, collectionId)
    setRoute(section === 'collections' ? { section, collectionId } : { section })
    closeMobile()
  }

  async function refreshCollections() {
    setLoadingCollections(true)
    setCollectionLoadError(false)
    try {
      const nextCollections = await client.listCollections()
      setCollections(nextCollections)
      setSelectedCollectionId((current) =>
        current && nextCollections.some((collection) => collection.id === current)
          ? current
          : (nextCollections.at(0)?.id ?? null),
      )
    } catch (error) {
      setCollectionLoadError(true)
      throw error
    } finally {
      setLoadingCollections(false)
    }
  }

  async function refreshCollectionDetail(collectionId = selectedCollectionId) {
    const request = ++collectionRequest.current
    if (!collectionId) {
      setCollectionDetail(null)
      return
    }
    setLoadingCollectionDetail(true)
    setCollectionDetailError(false)
    try {
      const detail = await client.getCollectionDetail(collectionId)
      if (request === collectionRequest.current) setCollectionDetail(detail)
    } catch {
      if (request === collectionRequest.current) {
        setCollectionDetail(null)
        setCollectionDetailError(true)
      }
    } finally {
      if (request === collectionRequest.current) setLoadingCollectionDetail(false)
    }
  }

  useEffect(() => {
    void refreshCollections().catch(() => {})
  }, [])

  async function refreshGlobalRuns() {
    try { setGlobalRuns(await client.listRuns()) } catch { /* A disconnected daemon must not break navigation. */ }
  }
  async function refreshHistoryRuns(scope: string | null) {
    const request = ++historyRequest.current
    try {
      const next = scope ? await client.listCollectionRuns(scope) : await client.listRuns()
      if (request === historyRequest.current && jobsScopeRef.current === scope) setHistoryRuns(next)
    } catch { /* A disconnected daemon must not break navigation. */ }
  }
  useEffect(() => {
    void refreshGlobalRuns()
    const timer = window.setInterval(() => { void refreshGlobalRuns(); if (jobsOpenedRef.current) void refreshHistoryRuns(jobsScopeRef.current) }, 5_000)
    return () => window.clearInterval(timer)
  }, [])

  const unreadRunCount = globalRuns.filter((run) => run.readAt === null).length
  function openJobs(scope: string | null) {
    jobsScopeRef.current = scope
    jobsOpenedRef.current = true
    setHistoryRuns([])
    setJobsScope(scope)
    setDrawerLevel('list')
    setDrawerError(null)
    setJobsOpened(true)
    void refreshHistoryRuns(scope)
  }

  async function markRunRead(runId: string) {
    try {
      await client.markRunRead(runId)
      await Promise.all([refreshGlobalRuns(), refreshHistoryRuns(jobsScope)])
    } catch {
      setDrawerError('No se pudo marcar esta ejecución como leída. Vuelve a intentarlo.')
    }
  }

  async function clearEligibleRuns() {
    try {
      await client.clearEligibleRuns()
      await Promise.all([refreshGlobalRuns(), refreshHistoryRuns(null)])
    } catch {
      setDrawerError('No se pudo limpiar las ejecuciones finalizadas. Vuelve a intentarlo.')
    }
  }

  async function openRun(run: LocalRunSummary) {
    const request = ++drawerRequest.current
    setDrawerLevel('run')
    setRunDetail(null)
    setRunDetailError(null)
    setDrawerError(null)
    setRunDetailLoading(true)
    await markRunRead(run.id)
    try {
      const detail = await client.getRunDetail(run.id)
      if (request === drawerRequest.current) setRunDetail(detail)
    } catch {
      if (request === drawerRequest.current) setRunDetailError('No se pudo cargar el detalle de esta ejecución local.')
    } finally {
      if (request === drawerRequest.current) setRunDetailLoading(false)
    }
  }

  async function openInvoice(collectionId: string, invoiceId: string, origin: 'list' | 'run' = 'list') {
    const request = ++drawerRequest.current
    setDrawerLevel('invoice')
    setInvoiceOrigin(origin)
    if (origin === 'list') {
      jobsScopeRef.current = collectionId
      jobsOpenedRef.current = true
      setJobsScope(collectionId)
      setHistoryRuns([])
      setJobsOpened(true)
      void refreshHistoryRuns(collectionId)
    }
    setInvoiceDetail(null)
    setDrawerError(null)
    setInvoiceDetailLoading(true)
    try {
      const detail = await client.getCollectionInvoice(collectionId, invoiceId)
      if (request === drawerRequest.current) setInvoiceDetail(detail)
    } catch {
      if (request === drawerRequest.current) setDrawerError('No se pudo cargar el detalle de esta factura local.')
    } finally {
      if (request === drawerRequest.current) setInvoiceDetailLoading(false)
    }
  }

  function closeJobs() {
    drawerRequest.current += 1
    setJobsOpened(false)
    jobsOpenedRef.current = false
    setDrawerLevel('list')
    setRunDetail(null)
    setRunDetailError(null)
    setInvoiceDetail(null)
    setDrawerError(null)
  }

  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  )
  const collectionRouteId = route.section === 'collections' ? route.collectionId : undefined
  const collectionYears = [...new Set(collections.map((collection) => collection.year))]
    .sort((left, right) => right - left)
  const visibleCollections = collections.filter((collection) =>
    collection.name.toLocaleLowerCase('es-EC').includes(collectionNameFilter.trim().toLocaleLowerCase('es-EC')) &&
    (!collectionYearFilter || collection.year === Number(collectionYearFilter)),
  )
  const visibleCollectionInvoices = collectionDetail?.invoices.filter((invoice) =>
    invoice.fileName.toLowerCase().includes(invoiceFilter.trim().toLowerCase()),
  ) ?? []
  const allVisibleInvoicesSelected = visibleCollectionInvoices.length > 0 &&
    visibleCollectionInvoices.every((invoice) => selectedInvoiceIds.includes(invoice.id))

  useEffect(() => {
    if (route.section !== 'collections' || !route.collectionId || loadingCollections)
      return

    const deepLinkedCollection = collections.find(
      (collection) => collection.id === route.collectionId,
    )
    if (deepLinkedCollection) {
      setSelectedCollectionId(deepLinkedCollection.id)
      return
    }

    setMessage('La colección local solicitada no existe en esta biblioteca.')
    window.location.hash = hashForRoute('collections')
    setRoute({ section: 'collections' })
  }, [collections, loadingCollections, route])

  useEffect(() => {
    if (!selectedCollection) return
    setCollectionDraft(
      selectedCollection.latestRevision
        ? {
            purpose: selectedCollection.latestRevision.purpose,
            period: selectedCollection.latestRevision.period,
            taxpayerProfileRevisionId: selectedCollection.latestRevision.taxpayerProfileRevisionId,
            activityRevisionIds: [...selectedCollection.latestRevision.activityRevisionIds],
            notes: selectedCollection.latestRevision.notes ?? '',
          }
        : blankCollectionContext,
    )
  }, [selectedCollection])

  useEffect(() => {
    if (collectionRouteId && selectedCollectionId) void refreshCollectionDetail(selectedCollectionId)
    else setCollectionDetail(null)
  }, [collectionRouteId, selectedCollectionId])

  function selectCollection(collection: LocalCollectionContext) {
    setSelectedCollectionId(collection.id)
    setCollectionDraft(
      collection.latestRevision
        ? {
            purpose: collection.latestRevision.purpose,
            period: collection.latestRevision.period,
            taxpayerProfileRevisionId: collection.latestRevision.taxpayerProfileRevisionId,
            activityRevisionIds: [...collection.latestRevision.activityRevisionIds],
            notes: collection.latestRevision.notes ?? '',
          }
        : blankCollectionContext,
    )
    navigate('collections', collection.id)
  }

  async function createCollection() {
    const year = Number(newCollectionYear)
    if (!newCollectionName.trim() || !Number.isInteger(year)) {
      setMessage('Ingresa un nombre y un año válido para la colección local.')
      return
    }
    setSavingCollection(true)
    try {
      const created = await client.createCollection({ name: newCollectionName, year, description: newCollectionDescription.trim() || null })
      await refreshCollections()
      selectCollection(created)
      setNewCollectionName('')
      setNewCollectionYear(String(new Date().getFullYear()))
      setNewCollectionDescription('')
      createCollectionModal.close()
      setMessage('Colección local creada. Ahora define su contexto tributario.')
    } catch {
      setMessage('No se pudo crear la colección local.')
    } finally {
      setSavingCollection(false)
    }
  }

  function updateCollectionProfile(profileRevisionId: string | null) {
    const profile = profiles.find(
      (candidate) => candidate.latestRevision.id === profileRevisionId,
    )
    setCollectionDraft((current) => ({
      ...current,
      taxpayerProfileRevisionId: profileRevisionId ?? '',
      activityRevisionIds: profile
        ? current.activityRevisionIds.filter((id) =>
            profile.latestRevision.activityRevisionIds.includes(id),
          )
        : [],
    }))
  }

  async function saveCollectionRevision() {
    setContextError(null)
    if (!selectedCollectionId)
      return setContextError('Primero crea o selecciona una colección local.')
    const parsed = CollectionContextRevisionInputSchema.safeParse(collectionDraft)
    if (!parsed.success)
      return setContextError(parsed.error.issues[0]?.message ?? 'Revisa el contexto de la colección.')
    setSavingCollection(true)
    try {
      await client.reviseCollection(selectedCollectionId, parsed.data)
      await refreshCollections()
      await refreshCollectionDetail(selectedCollectionId)
      setMessage('Contexto de colección guardado como una revisión local.')
      return true
    } catch {
      setContextError('No se pudo guardar el contexto de la colección local.')
      return false
    } finally {
      setSavingCollection(false)
    }
  }

  function openMetadata() {
    if (!selectedCollection) return
    setMetadataName(selectedCollection.name)
    setMetadataYear(String(selectedCollection.year))
    setMetadataDescription(selectedCollection.description ?? '')
    setMetadataOpened(true)
  }

  async function saveMetadata() {
    if (!selectedCollectionId || !metadataName.trim() || !Number.isInteger(Number(metadataYear))) {
      setMessage('Ingresa un nombre y un año válido para la colección local.')
      return false
    }
    setSavingCollection(true)
    try {
      await client.updateCollection(selectedCollectionId, { name: metadataName.trim(), year: Number(metadataYear), description: metadataDescription.trim() || null })
      await refreshCollections()
      await refreshCollectionDetail(selectedCollectionId)
      setMessage('Datos de colección actualizados localmente.')
      return true
    } catch {
      setMessage('No se pudieron actualizar los datos de la colección local.')
      return false
    } finally { setSavingCollection(false) }
  }

  useEffect(() => {
    if (route.section !== 'collections') return
    void Promise.all([client.listActivities(), client.listProfiles()])
      .then(([nextActivities, nextProfiles]) => { setActivities(nextActivities); setProfiles(nextProfiles) })
      .catch(() => setMessage('No se pudieron cargar los perfiles y actividades locales.'))
  }, [route.section])

  useEffect(() => {
    void client.listInvoices().then((result) => setInvoices(result.items))
  }, [])

  useEffect(() => {
    void client
      .listRulesets()
      .then((rulesets) => {
        const ruleset = rulesets.at(0)
        setRulesetLabel(
          ruleset
            ? `${ruleset.id} · vigente desde ${ruleset.effectiveFrom}`
            : 'No hay un ruleset aprobado disponible.',
        )
      })
      .catch(() => setRulesetLabel('No se pudo consultar el ruleset local.'))
  }, [])

  async function attachExistingInvoice() {
    if (!selectedCollectionId || !attachInvoiceId) return
    setSavingCollection(true)
    try {
      const result = await client.attachInvoice(selectedCollectionId, attachInvoiceId)
      await refreshCollectionDetail(selectedCollectionId)
      setAttachInvoiceId(null)
      setMessage(result.kind === 'attached' ? 'Factura asociada a esta colección local.' : 'La factura ya pertenece a esta colección local.')
    } catch {
      setMessage('No se pudo asociar la factura a esta colección local.')
    } finally {
      setSavingCollection(false)
    }
  }

  async function detachCollectionInvoices(invoiceIds: string[]) {
    if (!selectedCollectionId) return
    setSavingCollection(true)
    try {
      await Promise.all(invoiceIds.map((invoiceId) =>
        client.detachInvoice(selectedCollectionId, invoiceId),
      ))
      await refreshCollectionDetail(selectedCollectionId)
      setSelectedInvoiceIds((current) => current.filter((id) => !invoiceIds.includes(id)))
      setDetachInvoiceIds([])
      setMessage(
        invoiceIds.length === 1
          ? 'La factura se quitó de esta colección; el XML sigue en la biblioteca local.'
          : `${invoiceIds.length} facturas se quitaron de esta colección; sus XML siguen en la biblioteca local.`,
      )
    } catch {
      setMessage('No se pudo quitar la factura de esta colección local.')
    } finally {
      setSavingCollection(false)
    }
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !mobileOpened, desktop: false } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" justify="space-between" px="md">
          <Group gap="xs">
            <Button
              aria-label="Abrir navegación"
              aria-expanded={mobileOpened}
              hiddenFrom="sm"
              onClick={toggleMobile}
              px={8}
              variant="subtle"
            >
              <Menu size={20} />
            </Button>
            <Text fw="bolder" size="xl">
              Bill-<Text c="violet" inherit span>LM</Text>
              <Text c="dimmed" fw={500} inherit span> local</Text>
            </Text>
          </Group>
          <Group gap="xs">
            <Text c="dimmed" size="sm" visibleFrom="sm">Sólo datos de este equipo</Text>
            <Indicator color="red" disabled={!unreadRunCount} label={unreadRunCount > 99 ? '99+' : unreadRunCount} size={20}>
              <ActionIcon aria-label={`Abrir centro de ejecuciones${unreadRunCount ? `: ${unreadRunCount} sin leer` : ''}`} onClick={() => openJobs(null)} variant="default"><Bell size={18} /></ActionIcon>
            </Indicator>
            <ActionIcon
              aria-label="Alternar tema"
              onClick={() => toggleColorScheme()}
              variant="default"
            >
              {colorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Stack gap="xs">
          {navigation.map(({ section, label: navigationLabel, icon: Icon }) => (
            <NavLink
              active={route.section === section}
              aria-current={route.section === section ? 'page' : undefined}
              key={section}
              label={navigationLabel}
              leftSection={<Icon size={18} />}
              onClick={() => navigate(section)}
            />
          ))}
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
    <Container py="xl" size="xl">
      <Stack gap="xl">
        {route.section !== 'profiles' && route.section !== 'official-sources' && route.section !== 'library' && !(route.section === 'collections' && route.collectionId) && <header>
          <Title order={1}>{navigation.find((item) => item.section === route.section)?.label ?? 'Colecciones'}</Title>
          <Text c="dimmed">
            {route.section === 'collections'
              ? 'Tu biblioteca se conserva en este equipo. Sólo se importan comprobantes XML.'
              : 'Esta sección se guarda y opera únicamente con el daemon local.'}
          </Text>
        </header>}
        {message && <Alert title="Biblioteca local">{message}</Alert>}
        {route.section === 'collections' && route.collectionId && <>
        <Group><Button aria-label="Volver a colecciones" onClick={() => navigate('collections')} variant="subtle">Volver a colecciones</Button></Group>
        <Card withBorder padding="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start"><div><Title order={1}>{selectedCollection?.name ?? 'Colección local'}</Title><Text c="dimmed">{selectedCollection ? `${selectedCollection.year} · ${selectedCollection.invoiceCount} factura(s) locales` : 'Cargando colección local…'}</Text><Text c={selectedCollection?.latestRevision ? 'dimmed' : 'blue'} size="sm">{selectedCollection?.latestRevision ? `Contexto: revisión ${selectedCollection.latestRevision.revision}` : 'Contexto pendiente'}</Text></div><Badge color="violet" variant="light">Local</Badge></Group>
            <Group justify="flex-end"><Button onClick={openMetadata} variant="subtle">Editar datos</Button><Button leftSection={<NotepadText size={18} />} onClick={() => { setContextError(null); setContextOpened(true) }} variant="subtle">Contexto</Button><Button leftSection={<History size={18} />} onClick={() => openJobs(selectedCollectionId)} variant="subtle">Historial</Button><Button color="violet" disabled={!collectionDetail || collectionDetail.invoices.length === 0} leftSection={<Sparkles size={18} />} onClick={() => setAnalysisOpened(true)} variant="light">Analizar colección</Button></Group>
            <Alert color="violet" title="Fuentes SRI aprobadas">{rulesetLabel}</Alert>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <div>
              <Title order={2} size="h3">
                Facturas
              </Title>
              <Text c="dimmed" size="sm">
                Importa XML directamente a la colección actual o vincula un XML que ya está en tu biblioteca local.
              </Text>
            </div>
            {!selectedCollectionId ? (
              <Alert color="blue" title="Selecciona una colección">
                Crea o selecciona una colección antes de importar o asociar facturas.
              </Alert>
            ) : <>
            <Group><Button onClick={() => setXmlUploadOpened(true)}>Subir facturas</Button></Group>
            <Group align="end" wrap="wrap">
              <Select
                flex="1 1 100%"
                data={invoices.filter((invoice) => !collectionDetail?.invoices.some((attached) => attached.id === invoice.id)).map((invoice) => ({ value: invoice.id, label: invoice.fileName }))}
                label="Factura existente"
                placeholder="Selecciona un XML de tu biblioteca"
                value={attachInvoiceId}
                onChange={setAttachInvoiceId}
              />
              <Button disabled={!attachInvoiceId} loading={savingCollection} onClick={() => void attachExistingInvoice()}>
                Asociar factura
              </Button>
            </Group>
            {loadingCollectionDetail ? (
              <Group gap="xs"><Loader size="sm" /><Text c="dimmed" size="sm">Cargando facturas de la colección…</Text></Group>
            ) : collectionDetailError ? (
              <Alert color="red" title="No se pudo abrir la colección">
                La colección no se pudo cargar desde el daemon local.
                <Group mt="sm"><Button variant="light" onClick={() => void refreshCollectionDetail()}>Reintentar detalle</Button></Group>
              </Alert>
            ) : collectionDetail?.invoices.length ? (
              <Stack gap="xs">
                <TextInput
                  aria-label="Filtrar facturas de la colección"
                  onChange={(event) => setInvoiceFilter(event.currentTarget.value)}
                  placeholder="Filtrar por nombre de archivo"
                  value={invoiceFilter}
                />
                <Group justify="space-between">
                  <Badge color={selectedInvoiceIds.length ? 'violet' : 'gray'} variant="light">
                    {selectedInvoiceIds.length} seleccionada(s)
                  </Badge>
                  <Button
                    color="red"
                    disabled={selectedInvoiceIds.length === 0}
                    loading={savingCollection}
                    onClick={() => setDetachInvoiceIds(selectedInvoiceIds)}
                    variant="subtle"
                  >
                    Quitar seleccionadas
                  </Button>
                </Group>
                {visibleCollectionInvoices.length ? (
                  <Table.ScrollContainer minWidth={850}>
                    <Table highlightOnHover verticalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>
                            <Checkbox
                              aria-label="Seleccionar todas las facturas visibles"
                              checked={allVisibleInvoicesSelected}
                              indeterminate={!allVisibleInvoicesSelected && visibleCollectionInvoices.some((invoice) => selectedInvoiceIds.includes(invoice.id))}
                              onChange={() => setSelectedInvoiceIds((current) => allVisibleInvoicesSelected
                                ? current.filter((id) => !visibleCollectionInvoices.some((invoice) => invoice.id === id))
                                : [...new Set([...current, ...visibleCollectionInvoices.map((invoice) => invoice.id)])])}
                            />
                          </Table.Th>
                          <Table.Th>Factura XML</Table.Th>
                          <Table.Th>Importada</Table.Th>
                          <Table.Th>Estado</Table.Th>
                          <Table.Th>Resultado fiscal</Table.Th>
                          <Table.Th>Monto potencial</Table.Th>
                          <Table.Th />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {visibleCollectionInvoices.map((invoice) => {
                          const selected = selectedInvoiceIds.includes(invoice.id)
                          return (
                            <Table.Tr bg={selected ? 'var(--mantine-color-violet-light)' : undefined} key={invoice.id}>
                              <Table.Td><Checkbox aria-label={`Seleccionar ${invoice.fileName}`} checked={selected} onChange={(event) => setSelectedInvoiceIds((current) => event.currentTarget.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id))} /></Table.Td>
                              <Table.Td><Text fw={500}>{invoice.fileName}</Text></Table.Td>
                              <Table.Td><Text size="sm">{new Date(invoice.createdAt).toLocaleDateString('es-EC')}</Text></Table.Td>
                              <Table.Td><Badge color="teal" variant="light">Asociada</Badge></Table.Td>
                              <Table.Td>{invoice.latestAnalysis ? (() => { const meta = analysisClassificationMeta[invoice.latestAnalysis.classification]; return <Badge color={meta.color} variant="light">{meta.label}</Badge> })() : <Text c="dimmed" size="sm">Pendiente</Text>}</Table.Td>
                              <Table.Td>{invoice.latestAnalysis ? (() => { const amount = localAnalysisAmount(invoice.latestAnalysis.payload); return amount === undefined ? <Text c="dimmed" size="sm">Por determinar</Text> : <Text size="sm">{formatLocalCurrency(amount)}</Text> })() : <Text c="dimmed" size="sm">—</Text>}</Table.Td>
                              <Table.Td><Group gap="xs"><Button onClick={() => selectedCollectionId && void openInvoice(selectedCollectionId, invoice.id)} size="compact-sm" variant="light">Ver detalle</Button><Button color="red" loading={savingCollection} onClick={() => setDetachInvoiceIds([invoice.id])} size="compact-sm" variant="subtle">Quitar</Button></Group></Table.Td>
                            </Table.Tr>
                          )
                        })}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                ) : (
                  <EmptyState title="No hay facturas que coincidan" description="Prueba con otro nombre de archivo o limpia el filtro." />
                )}
              </Stack>
            ) : (
              <EmptyState title="Aún no hay facturas en esta colección" description="Importa un XML o asocia una factura existente de tu biblioteca local." />
            )}
            </>}
          </Stack>
        </Card>
        {collectionDetail && !loadingCollectionDetail && !collectionDetailError && <LocalCollectionAnalysis client={client} collection={collectionDetail} onChanged={() => refreshCollectionDetail(selectedCollectionId)} onClose={() => setAnalysisOpened(false)} onOpenSettings={() => navigate('settings')} opened={analysisOpened} />}
        <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar configuración de contexto' }} opened={contextOpened} onClose={() => setContextOpened(false)} title="Configurar contexto de análisis">
          <Stack gap="sm">
            <Alert color="blue">El contexto se guarda como una nueva revisión; los análisis anteriores no cambian.</Alert>
            {contextError && <Alert color="red" title="Revisa el contexto">{contextError}</Alert>}
            <Select data={profiles.map((profile) => ({ value: profile.latestRevision.id, label: profile.latestRevision.displayName }))} label={<FieldHelpLabel hint="El contexto usa una revisión concreta del perfil local." label="Perfil tributario" />} placeholder="Selecciona un perfil" value={collectionDraft.taxpayerProfileRevisionId || null} onChange={updateCollectionProfile} />
            <Select data={[{ value: 'personal_expenses', label: 'Gastos personales' }, { value: 'vat_credit', label: 'Crédito tributario IVA' }, { value: 'business_income_tax', label: 'Impuesto a la renta del negocio' }]} label="Propósito tributario" value={collectionDraft.purpose} onChange={(purpose) => setCollectionDraft((current) => ({ ...current, purpose: (purpose ?? 'personal_expenses') as CollectionContextRevisionInput['purpose'] }))} />
            <MultiSelect data={(profiles.find((profile) => profile.latestRevision.id === collectionDraft.taxpayerProfileRevisionId)?.latestRevision.activityRevisionIds ?? []).flatMap((id) => { const activity = activities.find((candidate) => candidate.latestRevision.id === id); return activity ? [{ value: id, label: activity.latestRevision.displayName }] : [] })} disabled={collectionDraft.purpose === 'personal_expenses' || !collectionDraft.taxpayerProfileRevisionId} label="Actividades económicas" value={collectionDraft.activityRevisionIds} onChange={(activityRevisionIds) => setCollectionDraft((current) => ({ ...current, activityRevisionIds }))} />
            <Group grow><TextInput label="Inicio del período" type="date" value={collectionDraft.period.startDate} onChange={(event) => setCollectionDraft((current) => ({ ...current, period: { ...current.period, startDate: event.currentTarget.value } }))} /><TextInput label="Fin del período" type="date" value={collectionDraft.period.endDate} onChange={(event) => setCollectionDraft((current) => ({ ...current, period: { ...current.period, endDate: event.currentTarget.value } }))} /></Group>
            <Textarea label="Notas (opcional)" value={collectionDraft.notes ?? ''} onChange={(event) => setCollectionDraft((current) => ({ ...current, notes: event.currentTarget.value }))} />
            <Group justify="flex-end"><Button disabled={!collectionDraft.taxpayerProfileRevisionId} loading={savingCollection} onClick={() => { void saveCollectionRevision().then((saved) => { if (saved) setContextOpened(false) }) }}>Guardar contexto</Button></Group>
          </Stack>
        </Modal>
        <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar quitar facturas' }} opened={detachInvoiceIds.length > 0} onClose={() => setDetachInvoiceIds([])} title="Quitar facturas de la colección">
          <Stack>
            <Text>{detachInvoiceIds.length === 1 ? 'La factura se quitará' : `${detachInvoiceIds.length} facturas se quitarán`} de esta colección, pero sus XML seguirán disponibles en la biblioteca local.</Text>
            <Group justify="flex-end"><Button onClick={() => setDetachInvoiceIds([])} variant="default">Cancelar</Button><Button color="red" loading={savingCollection} onClick={() => void detachCollectionInvoices(detachInvoiceIds)}>Confirmar quitar</Button></Group>
          </Stack>
        </Modal>
        </>}
        {route.section === 'collections' && !route.collectionId && <>
        <Stack>
            <Group justify="space-between">
              <Button leftSection={<Plus size={16} />} onClick={createCollectionModal.open}>
                Nueva colección
              </Button>
            </Group>
            {!route.collectionId && <>
            {loadingCollections ? (
              <Group gap="xs"><Loader size="sm" /><Text c="dimmed" size="sm">Cargando colecciones locales…</Text></Group>
            ) : collectionLoadError ? (
              <Alert color="red" title="Colecciones locales no disponibles">
                No se pudieron cargar las colecciones locales.
                <Group mt="sm">
                  <Button variant="light" onClick={() => void refreshCollections()}>
                    Reintentar colecciones
                  </Button>
                </Group>
              </Alert>
            ) : collections.length === 0 ? (
              <EmptyState title="No hay colecciones locales" description="Crea una colección para definir su contexto tributario local." />
            ) : (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    aria-label="Buscar colecciones por nombre"
                    label="Buscar por nombre"
                    onChange={(event) => setCollectionNameFilter(event.currentTarget.value)}
                    placeholder="Ej. Gastos personales"
                    value={collectionNameFilter}
                  />
                  <Select
                    aria-label="Filtrar colecciones por año"
                    clearable
                    data={collectionYears.map((year) => ({ value: String(year), label: String(year) }))}
                    label="Año"
                    onChange={setCollectionYearFilter}
                    placeholder="Todos los años"
                    value={collectionYearFilter}
                  />
                </SimpleGrid>
                {visibleCollections.length === 0 ? (
                  <EmptyState title="No se encontraron colecciones" description="Prueba con otro nombre o elimina el filtro de año." />
                ) : (
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    {visibleCollections.map((collection) => (
                      <CollectionCardPresentation description={collection.description} invoiceCount={collection.invoiceCount} key={collection.id} name={collection.name} onOpen={() => selectCollection(collection)} year={collection.year} />
                    ))}
                  </SimpleGrid>
                )}
              </Stack>
            )}
            </>}
          </Stack>
        </>}
        <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar nueva colección' }} opened={createCollectionOpened} onClose={createCollectionModal.close} title="Nueva colección local">
          <Stack>
            <Text c="dimmed" size="sm">La colección y su contexto se guardan únicamente en esta biblioteca local.</Text>
            <TextInput
              label="Nombre"
              onChange={(event) => setNewCollectionName(event.currentTarget.value)}
              placeholder="Ej. Gastos personales 2026"
              value={newCollectionName}
            />
            <TextInput
              label="Año"
              onChange={(event) => setNewCollectionYear(event.currentTarget.value)}
              type="number"
              value={newCollectionYear}
            />
            <Textarea autosize label="Descripción (opcional)" minRows={2} onChange={(event) => setNewCollectionDescription(event.currentTarget.value)} placeholder="Qué reúne esta colección" value={newCollectionDescription} />
            <Group justify="flex-end">
              <Button onClick={createCollectionModal.close} variant="default">Cancelar</Button>
              <Button loading={savingCollection} onClick={() => void createCollection()}>Crear colección</Button>
            </Group>
          </Stack>
        </Modal>
        <Modal centered closeButtonProps={{ 'aria-label': 'Cerrar edición de colección' }} opened={metadataOpened} onClose={() => setMetadataOpened(false)} title="Editar datos de colección">
          <Stack>
            <TextInput label="Nombre" onChange={(event) => setMetadataName(event.currentTarget.value)} value={metadataName} />
            <TextInput label="Año" onChange={(event) => setMetadataYear(event.currentTarget.value)} type="number" value={metadataYear} />
            <Textarea autosize label="Descripción (opcional)" minRows={2} onChange={(event) => setMetadataDescription(event.currentTarget.value)} value={metadataDescription} />
            <Group justify="flex-end"><Button onClick={() => setMetadataOpened(false)} variant="default">Cancelar</Button><Button loading={savingCollection} onClick={() => { void saveMetadata().then((saved) => { if (saved) setMetadataOpened(false) }) }}>Guardar datos</Button></Group>
          </Stack>
        </Modal>
        {selectedCollectionId && <LocalXmlUploadModal
          client={client}
          collectionId={selectedCollectionId}
          onClose={() => setXmlUploadOpened(false)}
          onCompleted={async () => {
            await refreshCollectionDetail(selectedCollectionId)
            const nextInvoices = await client.listInvoices()
            setInvoices(nextInvoices.items)
          }}
          opened={xmlUploadOpened}
        />}
        {route.section === 'profiles' && <LocalProfilesSection client={client} />}
        {route.section === 'official-sources' && <OfficialSourcesSection client={client} />}
        {route.section === 'library' && <LocalLibrarySection client={client} navigate={(section) => navigate(section)} />}
        {route.section === 'settings' && <LocalGpuSettingsSection client={client} />}
      </Stack>
    </Container>
      </AppShell.Main>
      <Drawer closeButtonProps={{ 'aria-label': 'Cerrar ejecuciones locales' }} opened={jobsOpened} onClose={closeJobs} position="right" size="lg" title={drawerLevel === 'list' ? (jobsScope ? 'Historial de colección' : 'Centro de ejecuciones') : drawerLevel === 'run' ? 'Detalle de ejecución local' : 'Detalle de factura'}>
        <Stack>
          {drawerLevel !== 'list' && <Button onClick={() => setDrawerLevel(drawerLevel === 'invoice' ? invoiceOrigin : 'list')} variant="subtle">{drawerLevel === 'invoice' && invoiceOrigin === 'run' ? 'Volver a la ejecución' : 'Volver al listado'}</Button>}
          {drawerError && <Alert color="red" title="Acción no completada">{drawerError}</Alert>}
          {drawerLevel === 'list' && <>
            <Text c="dimmed" size="sm">{jobsScope ? 'Ejecuciones guardadas para esta colección local.' : 'Ejecuciones guardadas en esta biblioteca. No se consulta ningún servicio cloud.'}</Text>
            {!jobsScope && <Group justify="flex-end"><Button onClick={() => void client.markAllRunsRead().then(() => Promise.all([refreshGlobalRuns(), refreshHistoryRuns(null)])).catch(() => setDrawerError('No se pudieron marcar las ejecuciones como leídas.'))} size="compact-sm" variant="subtle">Marcar todas como leídas</Button><Button onClick={() => void clearEligibleRuns()} size="compact-sm" variant="light">Limpiar finalizadas</Button></Group>}
            {(() => {
              const drawerRuns = jobsScope ? historyRuns : globalRuns
              const visibleRuns = jobsScope ? drawerRuns : drawerRuns.filter((run) => run.status === 'queued' || run.status === 'running' || run.status === 'blocked' || run.readAt === null)
              const groups = [
                { label: 'En curso', items: visibleRuns.filter((run) => run.status === 'queued' || run.status === 'running') },
                { label: 'Requieren atención', items: visibleRuns.filter((run) => run.status === 'blocked') },
                { label: jobsScope ? 'Finalizadas' : 'Finalizadas sin leer', items: visibleRuns.filter((run) => run.status === 'completed' || run.status === 'failed') },
              ]
              return visibleRuns.length === 0 ? <EmptyState title={jobsScope ? 'Aún no hay ejecuciones en esta colección' : 'No hay ejecuciones pendientes de revisar'} description={jobsScope ? 'Los análisis iniciados aquí quedarán en este historial.' : 'Las ejecuciones activas y las finalizadas sin leer aparecerán aquí.'} /> : groups.map((group) => group.items.length > 0 && <Stack gap="xs" key={group.label}><Text fw={600} size="sm">{group.label}</Text>{group.items.map((run) => <RunListItem detail={[run.collectionName && run.fileName ? run.fileName : null].filter(Boolean).join(' · ') || null} error={run.error} invoiceCount={1} key={run.id} model={run.model} onMarkRead={run.readAt === null ? () => void markRunRead(run.id) : undefined} onOpen={() => void openRun(run)} progress={run.progress} provider={run.provider} runType="Análisis individual" status={run.status} timestamp={formatRunTime(run.timing.createdAt)} title={run.collectionName ?? run.fileName ?? 'Ejecución local'} unread={run.readAt === null} />)}</Stack>)
            })()}
          </>}
          {drawerLevel === 'run' && <>
            {runDetailLoading && <Group><Loader size="sm" /><Text c="dimmed" size="sm">Cargando detalle operativo local…</Text></Group>}
            {runDetailError && <Alert color="red" title="Detalle no disponible">{runDetailError}</Alert>}
            {runDetail && <><Group justify="space-between"><Stack gap={2}><Text fw={600}>Ejecución local</Text><Text c="dimmed" size="sm">{formatRunTime(runDetail.timing.createdAt)}</Text></Stack><ExecutionStatusBadge status={runDetail.status} /></Group>
              {runDetail.error && <Alert color="red" title="La ejecución registró un error">{runDetail.error}</Alert>}
              <Card withBorder padding="sm"><Stack gap={4}><Text fw={600} size="sm">Contexto congelado</Text><Text size="sm">{runDetail.purpose ?? 'Propósito no disponible'}{runDetail.period ? ` · ${runDetail.period.startDate} a ${runDetail.period.endDate}` : ''}</Text><Text c="dimmed" size="sm">Revisión {runDetail.contextRevision ?? 'no disponible'} · {runDetail.ruleset ? `${runDetail.ruleset.id} ${runDetail.ruleset.version}` : 'ruleset no disponible'}</Text><Text c="dimmed" size="sm">Conexión: {runDetail.provider ?? 'No disponible'} · {runDetail.model ?? 'No disponible'}{runDetail.timing.durationMs !== null ? ` · ${runDetail.timing.durationMs} ms` : ''}</Text></Stack></Card>
              <Stack gap="xs"><Text fw={600} size="sm">Eventos</Text>{runDetail.events.length === 0 ? <Text c="dimmed" size="sm">Aún no hay eventos guardados para esta ejecución.</Text> : runDetail.events.map((event) => <Card key={event.id} withBorder padding="sm"><Group justify="space-between" align="flex-start"><Text size="sm">{event.message}</Text><ExecutionStatusBadge status={event.status} /></Group><Text c="dimmed" size="xs" mt="xs">{formatRunTime(event.createdAt)}</Text></Card>)}</Stack>
              <Group justify="flex-end">{runDetail.collectionId && <Button onClick={() => void openInvoice(runDetail.collectionId!, runDetail.invoiceId, 'run')} variant="light">Abrir resultado de factura</Button>}<Button disabled={!runDetail.collectionId} variant="subtle" onClick={() => { if (runDetail.collectionId) { closeJobs(); navigate('collections', runDetail.collectionId) } }}>Abrir colección</Button></Group>
            </>}
          </>}
          {drawerLevel === 'invoice' && <>{invoiceDetailLoading && <Group><Loader size="sm" /><Text c="dimmed" size="sm">Cargando factura local…</Text></Group>}{invoiceDetail && <InvoiceDetails analysis={invoiceDetail.latestAnalysis ? <Stack gap="xs"><Text fw={600}>Resultado de la factura analizada</Text><Text size="sm">Propósito: {invoiceDetail.latestAnalysis.purpose === 'personal_expenses' ? 'Gastos personales' : invoiceDetail.latestAnalysis.purpose === 'vat_credit' ? 'Crédito tributario IVA' : 'Impuesto a la renta del negocio'} · Clasificación: {analysisClassificationMeta[invoiceDetail.latestAnalysis.classification].label}</Text><Text c="dimmed" size="sm" style={{ whiteSpace: 'pre-wrap' }}>{invoiceDetail.latestAnalysis.payload.reasoning}</Text></Stack> : <EmptyState title="Sin análisis todavía" description="Esta factura ya está disponible en la colección, aunque todavía no se ha analizado." />} invoice={{ fileName: invoiceDetail.fileName, typeLabel: 'Factura local', issueDate: invoiceDetail.issueDate, buyer: { name: invoiceDetail.buyer.name ?? 'No disponible', identifierLabel: 'Identificación', identifier: invoiceDetail.buyer.identifier ?? 'No disponible' }, seller: { name: invoiceDetail.seller.name ?? 'No disponible', identifier: invoiceDetail.seller.identifier ?? 'No disponible', tradeName: invoiceDetail.seller.tradeName, address: invoiceDetail.seller.address }, totals: { subtotal: localNumber(invoiceDetail.totals.subtotal), discount: localNumber(invoiceDetail.totals.discount), taxes: localNumber(invoiceDetail.totals.tax), total: localNumber(invoiceDetail.totals.total), currency: invoiceDetail.totals.currency }, taxes: invoiceDetail.taxes.map((tax, index) => ({ id: `${tax.code ?? 'tax'}-${index}`, code: tax.code, rate: tax.rate, taxableBase: localNumber(tax.taxableBase), amount: localNumber(tax.amount) })), items: invoiceDetail.lineItems.map((item, index) => ({ id: `${item.code ?? 'item'}-${index}`, description: item.description ?? 'Sin descripción', unitPrice: localNumber(item.unitPrice), quantity: localNumber(item.quantity), discount: localNumber(item.discount), total: localNumber(item.total) })) }} />}</>}
        </Stack>
      </Drawer>
    </AppShell>
  )
}
