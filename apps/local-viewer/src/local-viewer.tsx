import { CollectionContextRevisionInputSchema } from '@bill-lm/contracts'
import {
  CollectionCardPresentation,
  EmptyState,
  ExecutionStatusBadge,
  FieldHelpLabel,
  InvoiceDetails,
  RunListItem,
} from '@bill-lm/ui'
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
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  History,
  LibraryBig,
  Menu,
  Moon,
  NotepadText,
  Plus,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { LocalDaemonClient } from './api'
import { LocalCollectionAnalysis } from './local-collection-analysis'
import { LocalProfilesSection } from './local-profiles-section'
import {
  LocalGpuSettingsSection,
  LocalLibrarySection,
  OfficialSourcesSection,
} from './local-sections'
import { LocalXmlUploadModal } from './local-xml-upload-modal'

import type {
  LocalCollectionContext,
  LocalEconomicActivity,
  LocalTaxpayerProfile,
} from './api'
import type {
  CollectionContextRevisionInput,
  LocalCollectionDetail,
  LocalInvoiceDetail,
  LocalRunDetail,
  LocalRunSummary,
  ModelTaxAnalysisPayload,
} from '@bill-lm/contracts'

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

type LocalExecutionGroup = {
  id: string
  runs: Array<LocalRunSummary>
  status: LocalRunSummary['status']
  invoiceCount: number
  finishedCount: number
  unread: boolean
}

function executionGroupStatus(
  runs: Array<LocalRunSummary>,
): LocalRunSummary['status'] {
  if (runs.some((run) => run.status === 'running')) return 'running'
  if (runs.some((run) => run.status === 'queued')) return 'queued'
  if (runs.every((run) => run.status === 'blocked')) return 'blocked'
  if (runs.every((run) => run.status === 'failed')) return 'failed'
  return 'completed'
}

function groupExecutionRuns(
  runs: Array<LocalRunSummary>,
): Array<LocalExecutionGroup> {
  const groups = new Map<string, Array<LocalRunSummary>>()
  for (const run of runs) {
    const id = run.batch?.id ?? run.id
    groups.set(id, [...(groups.get(id) ?? []), run])
  }
  return [...groups.entries()].map(([id, groupRuns]) => {
    const batch = groupRuns[0]?.batch
    const terminalRuns = groupRuns.filter(
      (run) =>
        run.status === 'completed' ||
        run.status === 'failed' ||
        run.status === 'blocked',
    ).length
    return {
      id,
      runs: groupRuns,
      status: executionGroupStatus(groupRuns),
      invoiceCount: batch?.invoiceCount ?? groupRuns.length,
      finishedCount: batch?.finishedCount ?? terminalRuns,
      unread: groupRuns.some((run) => run.readAt === null),
    }
  })
}

const navigation = [
  { section: 'collections' as const, label: 'Colecciones', icon: LibraryBig },
  {
    section: 'profiles' as const,
    label: 'Perfiles y actividades',
    icon: BriefcaseBusiness,
  },
  { section: 'settings' as const, label: 'Configuración', icon: Settings },
  {
    section: 'official-sources' as const,
    label: 'Fuentes oficiales',
    icon: BookOpen,
  },
  { section: 'library' as const, label: 'Biblioteca local', icon: LibraryBig },
]
const localHashPrefix = '#' + '/'

function parseLocalRoute(hash: string): LocalRoute {
  const parts = hash
    .replace(new RegExp('^#' + '/?'), '')
    .split('/')
    .filter(Boolean)
  if (parts[0] === 'collections')
    return { section: 'collections', collectionId: parts[1] }
  if (parts[0] === 'account') return { section: 'library' }
  if (
    parts[0] === 'profiles' ||
    parts[0] === 'settings' ||
    parts[0] === 'official-sources' ||
    parts[0] === 'library'
  )
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
  if (payload.purpose === 'vat_credit')
    return payload.potentialCreditableVatAmount
  if (payload.purpose === 'business_income_tax')
    return payload.potentialExpenseAmount
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
  const [mobileOpened, { close: closeMobile, toggle: toggleMobile }] =
    useDisclosure(false)
  const [createCollectionOpened, createCollectionModal] = useDisclosure(false)
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const [route, setRoute] = useState<LocalRoute>(() =>
    parseLocalRoute(window.location.hash),
  )
  const [message, setMessage] = useState<string | null>(null)
  const [xmlUploadOpened, setXmlUploadOpened] = useState(false)
  const [rulesetLabel, setRulesetLabel] = useState('Cargando ruleset aprobado…')
  const [invoices, setInvoices] = useState<
    Array<{ id: string; fileName: string }>
  >([])
  const [activities, setActivities] = useState<Array<LocalEconomicActivity>>([])
  const [profiles, setProfiles] = useState<Array<LocalTaxpayerProfile>>([])
  const [collections, setCollections] = useState<Array<LocalCollectionContext>>(
    [],
  )
  const [collectionNameFilter, setCollectionNameFilter] = useState('')
  const [collectionYearFilter, setCollectionYearFilter] = useState<
    string | null
  >(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionYear, setNewCollectionYear] = useState(
    String(new Date().getFullYear()),
  )
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [metadataOpened, setMetadataOpened] = useState(false)
  const [metadataName, setMetadataName] = useState('')
  const [metadataYear, setMetadataYear] = useState('')
  const [metadataDescription, setMetadataDescription] = useState('')
  const [contextError, setContextError] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | null
  >(null)
  const [collectionDraft, setCollectionDraft] = useState(blankCollectionContext)
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [collectionLoadError, setCollectionLoadError] = useState(false)
  const [savingCollection, setSavingCollection] = useState(false)
  const [collectionDetail, setCollectionDetail] =
    useState<LocalCollectionDetail | null>(null)
  const [loadingCollectionDetail, setLoadingCollectionDetail] = useState(false)
  const [collectionDetailError, setCollectionDetailError] = useState(false)
  const [attachInvoiceId, setAttachInvoiceId] = useState<string | null>(null)
  const [invoiceFilter, setInvoiceFilter] = useState('')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Array<string>>(
    [],
  )
  const [detachInvoiceIds, setDetachInvoiceIds] = useState<Array<string>>([])
  const [contextOpened, setContextOpened] = useState(false)
  const [analysisOpened, setAnalysisOpened] = useState(false)
  const [collectionAnalysisBatch, setCollectionAnalysisBatch] = useState<{
    id: string
    collectionId: string
    invoiceCount: number
    finishedCount: number
    queuedAt: string
  } | null>(null)
  const [jobsOpened, setJobsOpened] = useState(false)
  const [jobsScope, setJobsScope] = useState<string | null>(null)
  const [drawerLevel, setDrawerLevel] = useState<
    'list' | 'batch' | 'run' | 'invoice'
  >('list')
  const [batchDetail, setBatchDetail] = useState<LocalExecutionGroup | null>(
    null,
  )
  const [runOrigin, setRunOrigin] = useState<'list' | 'batch'>('list')
  const [runDetail, setRunDetail] = useState<LocalRunDetail | null>(null)
  const [runDetailLoading, setRunDetailLoading] = useState(false)
  const [runDetailError, setRunDetailError] = useState<string | null>(null)
  const [invoiceDetail, setInvoiceDetail] = useState<LocalInvoiceDetail | null>(
    null,
  )
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false)
  const [invoiceOrigin, setInvoiceOrigin] = useState<'list' | 'run'>('list')
  const [drawerError, setDrawerError] = useState<string | null>(null)
  const [globalRuns, setGlobalRuns] = useState<Array<LocalRunSummary>>([])
  const [historyRuns, setHistoryRuns] = useState<Array<LocalRunSummary>>([])
  const drawerRequest = useRef(0)
  const collectionRequest = useRef(0)
  const historyRequest = useRef(0)
  const batchRequest = useRef(0)
  const jobsScopeRef = useRef<string | null>(null)
  const jobsOpenedRef = useRef(false)

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = parseLocalRoute(window.location.hash)
      const canonicalHash = hashForRoute(
        nextRoute.section,
        nextRoute.section === 'collections'
          ? nextRoute.collectionId
          : undefined,
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
    setRoute(
      section === 'collections' ? { section, collectionId } : { section },
    )
    closeMobile()
  }

  async function refreshCollections() {
    setLoadingCollections(true)
    setCollectionLoadError(false)
    try {
      const nextCollections = await client.listCollections()
      setCollections(nextCollections)
      setSelectedCollectionId((current) =>
        current &&
        nextCollections.some((collection) => collection.id === current)
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
      if (request === collectionRequest.current)
        setLoadingCollectionDetail(false)
    }
  }

  useEffect(() => {
    void refreshCollections().catch(() => {})
  }, [])

  async function refreshGlobalRuns() {
    try {
      setGlobalRuns(await client.listRuns())
    } catch {
      /* A disconnected daemon must not break navigation. */
    }
  }
  async function refreshHistoryRuns(scope: string | null) {
    const request = ++historyRequest.current
    try {
      const next = scope
        ? await client.listCollectionRuns(scope)
        : await client.listRuns()
      if (request === historyRequest.current && jobsScopeRef.current === scope)
        setHistoryRuns(next)
    } catch {
      /* A disconnected daemon must not break navigation. */
    }
  }
  async function refreshCollectionAnalysisBatch(collectionId: string | null) {
    const request = ++batchRequest.current
    if (!collectionId) {
      setCollectionAnalysisBatch(null)
      return
    }
    try {
      const batch = await client.getCollectionAnalysisProgress(collectionId)
      if (request !== batchRequest.current) return
      setCollectionAnalysisBatch(
        batch
          ? {
              id: batch.id,
              collectionId: batch.collectionId,
              invoiceCount: batch.invoiceCount,
              finishedCount: batch.finishedCount,
              queuedAt: batch.queuedAt,
            }
          : null,
      )
    } catch {
      /* Keep the last persisted batch display while the daemon reconnects. */
    }
  }
  useEffect(() => {
    void refreshGlobalRuns()
    const timer = window.setInterval(() => {
      void refreshGlobalRuns()
      if (jobsOpenedRef.current) void refreshHistoryRuns(jobsScopeRef.current)
      void refreshCollectionAnalysisBatch(selectedCollectionId)
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [selectedCollectionId])

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
      setDrawerError(
        'No se pudo marcar esta ejecución como leída. Vuelve a intentarlo.',
      )
    }
  }

  async function clearEligibleRuns() {
    try {
      await client.clearEligibleRuns()
      await Promise.all([refreshGlobalRuns(), refreshHistoryRuns(null)])
    } catch {
      setDrawerError(
        'No se pudo limpiar las ejecuciones finalizadas. Vuelve a intentarlo.',
      )
    }
  }

  async function markRunsRead(runs: Array<LocalRunSummary>) {
    try {
      await Promise.all(runs.map((run) => client.markRunRead(run.id)))
      await Promise.all([refreshGlobalRuns(), refreshHistoryRuns(jobsScope)])
    } catch {
      setDrawerError(
        'No se pudo marcar esta ejecución como leída. Vuelve a intentarlo.',
      )
    }
  }

  async function openBatch(batch: LocalExecutionGroup) {
    setDrawerLevel('batch')
    setBatchDetail(batch)
    setDrawerError(null)
    if (batch.unread) await markRunsRead(batch.runs)
  }

  async function openRun(
    run: LocalRunSummary,
    origin: 'list' | 'batch' = 'list',
  ) {
    const request = ++drawerRequest.current
    setDrawerLevel('run')
    setRunOrigin(origin)
    setRunDetail(null)
    setRunDetailError(null)
    setDrawerError(null)
    setRunDetailLoading(true)
    await markRunRead(run.id)
    try {
      const detail = await client.getRunDetail(run.id)
      if (request === drawerRequest.current) setRunDetail(detail)
    } catch {
      if (request === drawerRequest.current)
        setRunDetailError(
          'No se pudo cargar el detalle de esta ejecución local.',
        )
    } finally {
      if (request === drawerRequest.current) setRunDetailLoading(false)
    }
  }

  async function openInvoice(
    collectionId: string,
    invoiceId: string,
    origin: 'list' | 'run' = 'list',
  ) {
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
      if (request === drawerRequest.current)
        setDrawerError('No se pudo cargar el detalle de esta factura local.')
    } finally {
      if (request === drawerRequest.current) setInvoiceDetailLoading(false)
    }
  }

  function closeJobs() {
    drawerRequest.current += 1
    setJobsOpened(false)
    jobsOpenedRef.current = false
    setDrawerLevel('list')
    setBatchDetail(null)
    setRunDetail(null)
    setRunDetailError(null)
    setInvoiceDetail(null)
    setDrawerError(null)
  }

  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  )
  const collectionRouteId =
    route.section === 'collections' ? route.collectionId : undefined
  const collectionYears = [
    ...new Set(collections.map((collection) => collection.year)),
  ].sort((left, right) => right - left)
  const visibleCollections = collections.filter(
    (collection) =>
      collection.name
        .toLocaleLowerCase('es-EC')
        .includes(collectionNameFilter.trim().toLocaleLowerCase('es-EC')) &&
      (!collectionYearFilter ||
        collection.year === Number(collectionYearFilter)),
  )
  const visibleCollectionInvoices =
    collectionDetail?.invoices.filter((invoice) =>
      invoice.fileName
        .toLowerCase()
        .includes(invoiceFilter.trim().toLowerCase()),
    ) ?? []
  const allVisibleInvoicesSelected =
    visibleCollectionInvoices.length > 0 &&
    visibleCollectionInvoices.every((invoice) =>
      selectedInvoiceIds.includes(invoice.id),
    )
  const activeBatch =
    runDetail &&
    collectionAnalysisBatch?.collectionId === runDetail.collectionId
      ? collectionAnalysisBatch
      : null
  const activeBatchProgress = activeBatch
    ? Math.round((activeBatch.finishedCount / activeBatch.invoiceCount) * 100)
    : null

  useEffect(() => {
    if (
      route.section !== 'collections' ||
      !route.collectionId ||
      loadingCollections
    )
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
            taxpayerProfileRevisionId:
              selectedCollection.latestRevision.taxpayerProfileRevisionId,
            activityRevisionIds: [
              ...selectedCollection.latestRevision.activityRevisionIds,
            ],
            notes: selectedCollection.latestRevision.notes ?? '',
          }
        : blankCollectionContext,
    )
  }, [selectedCollection])

  useEffect(() => {
    if (collectionRouteId && selectedCollectionId) {
      void refreshCollectionDetail(selectedCollectionId)
      void refreshCollectionAnalysisBatch(selectedCollectionId)
    } else {
      setCollectionDetail(null)
      void refreshCollectionAnalysisBatch(null)
    }
  }, [collectionRouteId, selectedCollectionId])

  function selectCollection(collection: LocalCollectionContext) {
    setSelectedCollectionId(collection.id)
    setCollectionDraft(
      collection.latestRevision
        ? {
            purpose: collection.latestRevision.purpose,
            period: collection.latestRevision.period,
            taxpayerProfileRevisionId:
              collection.latestRevision.taxpayerProfileRevisionId,
            activityRevisionIds: [
              ...collection.latestRevision.activityRevisionIds,
            ],
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
      const created = await client.createCollection({
        name: newCollectionName,
        year,
        description: newCollectionDescription.trim() || null,
      })
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
    const parsed =
      CollectionContextRevisionInputSchema.safeParse(collectionDraft)
    if (!parsed.success)
      return setContextError(
        parsed.error.issues[0]?.message ??
          'Revisa el contexto de la colección.',
      )
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
    if (
      !selectedCollectionId ||
      !metadataName.trim() ||
      !Number.isInteger(Number(metadataYear))
    ) {
      setMessage('Ingresa un nombre y un año válido para la colección local.')
      return false
    }
    setSavingCollection(true)
    try {
      await client.updateCollection(selectedCollectionId, {
        name: metadataName.trim(),
        year: Number(metadataYear),
        description: metadataDescription.trim() || null,
      })
      await refreshCollections()
      await refreshCollectionDetail(selectedCollectionId)
      setMessage('Datos de colección actualizados localmente.')
      return true
    } catch {
      setMessage('No se pudieron actualizar los datos de la colección local.')
      return false
    } finally {
      setSavingCollection(false)
    }
  }

  useEffect(() => {
    if (route.section !== 'collections') return
    void Promise.all([client.listActivities(), client.listProfiles()])
      .then(([nextActivities, nextProfiles]) => {
        setActivities(nextActivities)
        setProfiles(nextProfiles)
      })
      .catch(() =>
        setMessage('No se pudieron cargar los perfiles y actividades locales.'),
      )
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
      const result = await client.attachInvoice(
        selectedCollectionId,
        attachInvoiceId,
      )
      await refreshCollectionDetail(selectedCollectionId)
      setAttachInvoiceId(null)
      setMessage(
        result.kind === 'attached'
          ? 'Factura asociada a esta colección local.'
          : 'La factura ya pertenece a esta colección local.',
      )
    } catch {
      setMessage('No se pudo asociar la factura a esta colección local.')
    } finally {
      setSavingCollection(false)
    }
  }

  async function detachCollectionInvoices(invoiceIds: Array<string>) {
    if (!selectedCollectionId) return
    setSavingCollection(true)
    try {
      await Promise.all(
        invoiceIds.map((invoiceId) =>
          client.detachInvoice(selectedCollectionId, invoiceId),
        ),
      )
      await refreshCollectionDetail(selectedCollectionId)
      setSelectedInvoiceIds((current) =>
        current.filter((id) => !invoiceIds.includes(id)),
      )
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
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" justify="space-between" px="md">
          <Group gap="xs">
            <Button
              aria-expanded={mobileOpened}
              aria-label="Abrir navegación"
              hiddenFrom="sm"
              px={8}
              variant="subtle"
              onClick={toggleMobile}
            >
              <Menu size={20} />
            </Button>
            <Text fw="bolder" size="xl">
              Bill-
              <Text inherit span c="violet">
                LM
              </Text>
              <Text inherit span c="dimmed" fw={500}>
                {' '}
                local
              </Text>
            </Text>
          </Group>
          <Group gap="xs">
            <Text c="dimmed" size="sm" visibleFrom="sm">
              Sólo datos de este equipo
            </Text>
            <Indicator
              color="red"
              disabled={!unreadRunCount}
              label={unreadRunCount > 99 ? '99+' : unreadRunCount}
              size={20}
            >
              <ActionIcon
                aria-label={`Abrir centro de ejecuciones${unreadRunCount ? `: ${unreadRunCount} sin leer` : ''}`}
                variant="default"
                onClick={() => openJobs(null)}
              >
                <Bell size={18} />
              </ActionIcon>
            </Indicator>
            <ActionIcon
              aria-label="Alternar tema"
              variant="default"
              onClick={() => toggleColorScheme()}
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
            {route.section !== 'profiles' &&
              route.section !== 'official-sources' &&
              route.section !== 'library' &&
              !(route.section === 'collections' && route.collectionId) && (
                <header>
                  <Title order={1}>
                    {navigation.find((item) => item.section === route.section)
                      ?.label ?? 'Colecciones'}
                  </Title>
                  <Text c="dimmed">
                    {route.section === 'collections'
                      ? 'Tu biblioteca se conserva en este equipo. Sólo se importan comprobantes XML.'
                      : 'Esta sección se guarda y opera únicamente con el daemon local.'}
                  </Text>
                </header>
              )}
            {message && <Alert title="Biblioteca local">{message}</Alert>}
            {route.section === 'collections' && route.collectionId && (
              <>
                <Group>
                  <Button
                    aria-label="Volver a colecciones"
                    variant="subtle"
                    onClick={() => navigate('collections')}
                  >
                    Volver a colecciones
                  </Button>
                </Group>
                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <Group align="flex-start" justify="space-between">
                      <div>
                        <Title order={1}>
                          {selectedCollection?.name ?? 'Colección local'}
                        </Title>
                        <Text c="dimmed">
                          {selectedCollection
                            ? `${selectedCollection.year} · ${selectedCollection.invoiceCount} factura(s) locales`
                            : 'Cargando colección local…'}
                        </Text>
                        <Text
                          c={
                            selectedCollection?.latestRevision
                              ? 'dimmed'
                              : 'blue'
                          }
                          size="sm"
                        >
                          {selectedCollection?.latestRevision
                            ? `Contexto: revisión ${selectedCollection.latestRevision.revision}`
                            : 'Contexto pendiente'}
                        </Text>
                      </div>
                      <Badge color="violet" variant="light">
                        Local
                      </Badge>
                    </Group>
                    <Group justify="flex-end">
                      <Button variant="subtle" onClick={openMetadata}>
                        Editar datos
                      </Button>
                      <Button
                        leftSection={<NotepadText size={18} />}
                        variant="subtle"
                        onClick={() => {
                          setContextError(null)
                          setContextOpened(true)
                        }}
                      >
                        Contexto
                      </Button>
                      <Button
                        leftSection={<History size={18} />}
                        variant="subtle"
                        onClick={() => openJobs(selectedCollectionId)}
                      >
                        Historial
                      </Button>
                      <Button
                        color="violet"
                        disabled={
                          !collectionDetail ||
                          collectionDetail.invoices.length === 0
                        }
                        leftSection={<Sparkles size={18} />}
                        variant="light"
                        onClick={() => setAnalysisOpened(true)}
                      >
                        Analizar colección
                      </Button>
                    </Group>
                    <Alert color="violet" title="Fuentes SRI aprobadas">
                      {rulesetLabel}
                    </Alert>
                  </Stack>
                </Card>
                <Card withBorder>
                  <Stack>
                    <div>
                      <Title order={2} size="h3">
                        Facturas
                      </Title>
                      <Text c="dimmed" size="sm">
                        Importa XML directamente a la colección actual o vincula
                        un XML que ya está en tu biblioteca local.
                      </Text>
                    </div>
                    {!selectedCollectionId ? (
                      <Alert color="blue" title="Selecciona una colección">
                        Crea o selecciona una colección antes de importar o
                        asociar facturas.
                      </Alert>
                    ) : (
                      <>
                        <Group>
                          <Button onClick={() => setXmlUploadOpened(true)}>
                            Subir facturas
                          </Button>
                        </Group>
                        <Group align="end" wrap="wrap">
                          <Select
                            data={invoices
                              .filter(
                                (invoice) =>
                                  !collectionDetail?.invoices.some(
                                    (attached) => attached.id === invoice.id,
                                  ),
                              )
                              .map((invoice) => ({
                                value: invoice.id,
                                label: invoice.fileName,
                              }))}
                            flex="1 1 100%"
                            label="Factura existente"
                            placeholder="Selecciona un XML de tu biblioteca"
                            value={attachInvoiceId}
                            onChange={setAttachInvoiceId}
                          />
                          <Button
                            disabled={!attachInvoiceId}
                            loading={savingCollection}
                            onClick={() => void attachExistingInvoice()}
                          >
                            Asociar factura
                          </Button>
                        </Group>
                        {loadingCollectionDetail ? (
                          <Group gap="xs">
                            <Loader size="sm" />
                            <Text c="dimmed" size="sm">
                              Cargando facturas de la colección…
                            </Text>
                          </Group>
                        ) : collectionDetailError ? (
                          <Alert
                            color="red"
                            title="No se pudo abrir la colección"
                          >
                            La colección no se pudo cargar desde el daemon
                            local.
                            <Group mt="sm">
                              <Button
                                variant="light"
                                onClick={() => void refreshCollectionDetail()}
                              >
                                Reintentar detalle
                              </Button>
                            </Group>
                          </Alert>
                        ) : collectionDetail?.invoices.length ? (
                          <Stack gap="xs">
                            <TextInput
                              aria-label="Filtrar facturas de la colección"
                              placeholder="Filtrar por nombre de archivo"
                              value={invoiceFilter}
                              onChange={(event) =>
                                setInvoiceFilter(event.currentTarget.value)
                              }
                            />
                            <Group justify="space-between">
                              <Badge
                                color={
                                  selectedInvoiceIds.length ? 'violet' : 'gray'
                                }
                                variant="light"
                              >
                                {selectedInvoiceIds.length} seleccionada(s)
                              </Badge>
                              <Button
                                color="red"
                                disabled={selectedInvoiceIds.length === 0}
                                loading={savingCollection}
                                variant="subtle"
                                onClick={() =>
                                  setDetachInvoiceIds(selectedInvoiceIds)
                                }
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
                                          indeterminate={
                                            !allVisibleInvoicesSelected &&
                                            visibleCollectionInvoices.some(
                                              (invoice) =>
                                                selectedInvoiceIds.includes(
                                                  invoice.id,
                                                ),
                                            )
                                          }
                                          onChange={() =>
                                            setSelectedInvoiceIds((current) =>
                                              allVisibleInvoicesSelected
                                                ? current.filter(
                                                    (id) =>
                                                      !visibleCollectionInvoices.some(
                                                        (invoice) =>
                                                          invoice.id === id,
                                                      ),
                                                  )
                                                : [
                                                    ...new Set([
                                                      ...current,
                                                      ...visibleCollectionInvoices.map(
                                                        (invoice) => invoice.id,
                                                      ),
                                                    ]),
                                                  ],
                                            )
                                          }
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
                                    {visibleCollectionInvoices.map(
                                      (invoice) => {
                                        const selected =
                                          selectedInvoiceIds.includes(
                                            invoice.id,
                                          )
                                        return (
                                          <Table.Tr
                                            bg={
                                              selected
                                                ? 'var(--mantine-color-violet-light)'
                                                : undefined
                                            }
                                            key={invoice.id}
                                          >
                                            <Table.Td>
                                              <Checkbox
                                                aria-label={`Seleccionar ${invoice.fileName}`}
                                                checked={selected}
                                                onChange={(event) =>
                                                  setSelectedInvoiceIds(
                                                    (current) =>
                                                      event.currentTarget
                                                        .checked
                                                        ? [
                                                            ...current,
                                                            invoice.id,
                                                          ]
                                                        : current.filter(
                                                            (id) =>
                                                              id !== invoice.id,
                                                          ),
                                                  )
                                                }
                                              />
                                            </Table.Td>
                                            <Table.Td>
                                              <Text fw={500}>
                                                {invoice.fileName}
                                              </Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Text size="sm">
                                                {new Date(
                                                  invoice.createdAt,
                                                ).toLocaleDateString('es-EC')}
                                              </Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Badge
                                                color="teal"
                                                variant="light"
                                              >
                                                Asociada
                                              </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                              {invoice.latestAnalysis ? (
                                                (() => {
                                                  const meta =
                                                    analysisClassificationMeta[
                                                      invoice.latestAnalysis
                                                        .classification
                                                    ]
                                                  return (
                                                    <Badge
                                                      color={meta.color}
                                                      variant="light"
                                                    >
                                                      {meta.label}
                                                    </Badge>
                                                  )
                                                })()
                                              ) : (
                                                <Text c="dimmed" size="sm">
                                                  Pendiente
                                                </Text>
                                              )}
                                            </Table.Td>
                                            <Table.Td>
                                              {invoice.latestAnalysis ? (
                                                (() => {
                                                  const amount =
                                                    localAnalysisAmount(
                                                      invoice.latestAnalysis
                                                        .payload,
                                                    )
                                                  return amount ===
                                                    undefined ? (
                                                    <Text c="dimmed" size="sm">
                                                      Por determinar
                                                    </Text>
                                                  ) : (
                                                    <Text size="sm">
                                                      {formatLocalCurrency(
                                                        amount,
                                                      )}
                                                    </Text>
                                                  )
                                                })()
                                              ) : (
                                                <Text c="dimmed" size="sm">
                                                  —
                                                </Text>
                                              )}
                                            </Table.Td>
                                            <Table.Td>
                                              <Group gap="xs">
                                                <Button
                                                  size="compact-sm"
                                                  variant="light"
                                                  onClick={() =>
                                                    selectedCollectionId &&
                                                    void openInvoice(
                                                      selectedCollectionId,
                                                      invoice.id,
                                                    )
                                                  }
                                                >
                                                  Ver detalle
                                                </Button>
                                                <Button
                                                  color="red"
                                                  loading={savingCollection}
                                                  size="compact-sm"
                                                  variant="subtle"
                                                  onClick={() =>
                                                    setDetachInvoiceIds([
                                                      invoice.id,
                                                    ])
                                                  }
                                                >
                                                  Quitar
                                                </Button>
                                              </Group>
                                            </Table.Td>
                                          </Table.Tr>
                                        )
                                      },
                                    )}
                                  </Table.Tbody>
                                </Table>
                              </Table.ScrollContainer>
                            ) : (
                              <EmptyState
                                description="Prueba con otro nombre de archivo o limpia el filtro."
                                title="No hay facturas que coincidan"
                              />
                            )}
                          </Stack>
                        ) : (
                          <EmptyState
                            description="Importa un XML o asocia una factura existente de tu biblioteca local."
                            title="Aún no hay facturas en esta colección"
                          />
                        )}
                      </>
                    )}
                  </Stack>
                </Card>
                {collectionDetail &&
                  !loadingCollectionDetail &&
                  !collectionDetailError && (
                    <LocalCollectionAnalysis
                      client={client}
                      collection={collectionDetail}
                      opened={analysisOpened}
                      onChanged={() =>
                        refreshCollectionDetail(selectedCollectionId)
                      }
                      onClose={() => setAnalysisOpened(false)}
                      onOpenSettings={() => navigate('settings')}
                      onQueued={({ batchId, invoiceCount, queuedAt }) => {
                        setCollectionAnalysisBatch({
                          id: batchId,
                          collectionId: collectionDetail.id,
                          invoiceCount,
                          finishedCount: 0,
                          queuedAt,
                        })
                        openJobs(selectedCollectionId)
                      }}
                    />
                  )}
                <Modal
                  centered
                  closeButtonProps={{
                    'aria-label': 'Cerrar configuración de contexto',
                  }}
                  opened={contextOpened}
                  title="Configurar contexto de análisis"
                  onClose={() => setContextOpened(false)}
                >
                  <Stack gap="sm">
                    <Alert color="blue">
                      El contexto se guarda como una nueva revisión; los
                      análisis anteriores no cambian.
                    </Alert>
                    {contextError && (
                      <Alert color="red" title="Revisa el contexto">
                        {contextError}
                      </Alert>
                    )}
                    <Select
                      data={profiles.map((profile) => ({
                        value: profile.latestRevision.id,
                        label: profile.latestRevision.displayName,
                      }))}
                      label={
                        <FieldHelpLabel
                          hint="El contexto usa una revisión concreta del perfil local."
                          label="Perfil tributario"
                        />
                      }
                      placeholder="Selecciona un perfil"
                      value={collectionDraft.taxpayerProfileRevisionId || null}
                      onChange={updateCollectionProfile}
                    />
                    <Select
                      data={[
                        {
                          value: 'personal_expenses',
                          label: 'Gastos personales',
                        },
                        {
                          value: 'vat_credit',
                          label: 'Crédito tributario IVA',
                        },
                        {
                          value: 'business_income_tax',
                          label: 'Impuesto a la renta del negocio',
                        },
                      ]}
                      label="Propósito tributario"
                      value={collectionDraft.purpose}
                      onChange={(purpose) =>
                        setCollectionDraft((current) => ({
                          ...current,
                          purpose: (purpose ??
                            'personal_expenses') as CollectionContextRevisionInput['purpose'],
                        }))
                      }
                    />
                    <MultiSelect
                      data={(
                        profiles.find(
                          (profile) =>
                            profile.latestRevision.id ===
                            collectionDraft.taxpayerProfileRevisionId,
                        )?.latestRevision.activityRevisionIds ?? []
                      ).flatMap((id) => {
                        const activity = activities.find(
                          (candidate) => candidate.latestRevision.id === id,
                        )
                        return activity
                          ? [
                              {
                                value: id,
                                label: activity.latestRevision.displayName,
                              },
                            ]
                          : []
                      })}
                      disabled={
                        collectionDraft.purpose === 'personal_expenses' ||
                        !collectionDraft.taxpayerProfileRevisionId
                      }
                      label="Actividades económicas"
                      value={collectionDraft.activityRevisionIds}
                      onChange={(activityRevisionIds) =>
                        setCollectionDraft((current) => ({
                          ...current,
                          activityRevisionIds,
                        }))
                      }
                    />
                    <Group grow>
                      <TextInput
                        label="Inicio del período"
                        type="date"
                        value={collectionDraft.period.startDate}
                        onChange={(event) =>
                          setCollectionDraft((current) => ({
                            ...current,
                            period: {
                              ...current.period,
                              startDate: event.currentTarget.value,
                            },
                          }))
                        }
                      />
                      <TextInput
                        label="Fin del período"
                        type="date"
                        value={collectionDraft.period.endDate}
                        onChange={(event) =>
                          setCollectionDraft((current) => ({
                            ...current,
                            period: {
                              ...current.period,
                              endDate: event.currentTarget.value,
                            },
                          }))
                        }
                      />
                    </Group>
                    <Textarea
                      label="Notas (opcional)"
                      value={collectionDraft.notes ?? ''}
                      onChange={(event) =>
                        setCollectionDraft((current) => ({
                          ...current,
                          notes: event.currentTarget.value,
                        }))
                      }
                    />
                    <Group justify="flex-end">
                      <Button
                        disabled={!collectionDraft.taxpayerProfileRevisionId}
                        loading={savingCollection}
                        onClick={() => {
                          void saveCollectionRevision().then((saved) => {
                            if (saved) setContextOpened(false)
                          })
                        }}
                      >
                        Guardar contexto
                      </Button>
                    </Group>
                  </Stack>
                </Modal>
                <Modal
                  centered
                  closeButtonProps={{ 'aria-label': 'Cerrar quitar facturas' }}
                  opened={detachInvoiceIds.length > 0}
                  title="Quitar facturas de la colección"
                  onClose={() => setDetachInvoiceIds([])}
                >
                  <Stack>
                    <Text>
                      {detachInvoiceIds.length === 1
                        ? 'La factura se quitará'
                        : `${detachInvoiceIds.length} facturas se quitarán`}{' '}
                      de esta colección, pero sus XML seguirán disponibles en la
                      biblioteca local.
                    </Text>
                    <Group justify="flex-end">
                      <Button
                        variant="default"
                        onClick={() => setDetachInvoiceIds([])}
                      >
                        Cancelar
                      </Button>
                      <Button
                        color="red"
                        loading={savingCollection}
                        onClick={() =>
                          void detachCollectionInvoices(detachInvoiceIds)
                        }
                      >
                        Confirmar quitar
                      </Button>
                    </Group>
                  </Stack>
                </Modal>
              </>
            )}
            {route.section === 'collections' && !route.collectionId && (
              <>
                <Stack>
                  <Group justify="space-between">
                    <Button
                      leftSection={<Plus size={16} />}
                      onClick={createCollectionModal.open}
                    >
                      Nueva colección
                    </Button>
                  </Group>
                  {!route.collectionId && (
                    <>
                      {loadingCollections ? (
                        <Group gap="xs">
                          <Loader size="sm" />
                          <Text c="dimmed" size="sm">
                            Cargando colecciones locales…
                          </Text>
                        </Group>
                      ) : collectionLoadError ? (
                        <Alert
                          color="red"
                          title="Colecciones locales no disponibles"
                        >
                          No se pudieron cargar las colecciones locales.
                          <Group mt="sm">
                            <Button
                              variant="light"
                              onClick={() => void refreshCollections()}
                            >
                              Reintentar colecciones
                            </Button>
                          </Group>
                        </Alert>
                      ) : collections.length === 0 ? (
                        <EmptyState
                          description="Crea una colección para definir su contexto tributario local."
                          title="No hay colecciones locales"
                        />
                      ) : (
                        <Stack gap="md">
                          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                            <TextInput
                              aria-label="Buscar colecciones por nombre"
                              label="Buscar por nombre"
                              placeholder="Ej. Gastos personales"
                              value={collectionNameFilter}
                              onChange={(event) =>
                                setCollectionNameFilter(
                                  event.currentTarget.value,
                                )
                              }
                            />
                            <Select
                              clearable
                              aria-label="Filtrar colecciones por año"
                              data={collectionYears.map((year) => ({
                                value: String(year),
                                label: String(year),
                              }))}
                              label="Año"
                              placeholder="Todos los años"
                              value={collectionYearFilter}
                              onChange={setCollectionYearFilter}
                            />
                          </SimpleGrid>
                          {visibleCollections.length === 0 ? (
                            <EmptyState
                              description="Prueba con otro nombre o elimina el filtro de año."
                              title="No se encontraron colecciones"
                            />
                          ) : (
                            <SimpleGrid
                              cols={{ base: 1, sm: 2, md: 3 }}
                              spacing="md"
                            >
                              {visibleCollections.map((collection) => (
                                <CollectionCardPresentation
                                  description={collection.description}
                                  invoiceCount={collection.invoiceCount}
                                  key={collection.id}
                                  name={collection.name}
                                  year={collection.year}
                                  onOpen={() => selectCollection(collection)}
                                />
                              ))}
                            </SimpleGrid>
                          )}
                        </Stack>
                      )}
                    </>
                  )}
                </Stack>
              </>
            )}
            <Modal
              centered
              closeButtonProps={{ 'aria-label': 'Cerrar nueva colección' }}
              opened={createCollectionOpened}
              title="Nueva colección local"
              onClose={createCollectionModal.close}
            >
              <Stack>
                <Text c="dimmed" size="sm">
                  La colección y su contexto se guardan únicamente en esta
                  biblioteca local.
                </Text>
                <TextInput
                  label="Nombre"
                  placeholder="Ej. Gastos personales 2026"
                  value={newCollectionName}
                  onChange={(event) =>
                    setNewCollectionName(event.currentTarget.value)
                  }
                />
                <TextInput
                  label="Año"
                  type="number"
                  value={newCollectionYear}
                  onChange={(event) =>
                    setNewCollectionYear(event.currentTarget.value)
                  }
                />
                <Textarea
                  autosize
                  label="Descripción (opcional)"
                  minRows={2}
                  placeholder="Qué reúne esta colección"
                  value={newCollectionDescription}
                  onChange={(event) =>
                    setNewCollectionDescription(event.currentTarget.value)
                  }
                />
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    onClick={createCollectionModal.close}
                  >
                    Cancelar
                  </Button>
                  <Button
                    loading={savingCollection}
                    onClick={() => void createCollection()}
                  >
                    Crear colección
                  </Button>
                </Group>
              </Stack>
            </Modal>
            <Modal
              centered
              closeButtonProps={{ 'aria-label': 'Cerrar edición de colección' }}
              opened={metadataOpened}
              title="Editar datos de colección"
              onClose={() => setMetadataOpened(false)}
            >
              <Stack>
                <TextInput
                  label="Nombre"
                  value={metadataName}
                  onChange={(event) =>
                    setMetadataName(event.currentTarget.value)
                  }
                />
                <TextInput
                  label="Año"
                  type="number"
                  value={metadataYear}
                  onChange={(event) =>
                    setMetadataYear(event.currentTarget.value)
                  }
                />
                <Textarea
                  autosize
                  label="Descripción (opcional)"
                  minRows={2}
                  value={metadataDescription}
                  onChange={(event) =>
                    setMetadataDescription(event.currentTarget.value)
                  }
                />
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    onClick={() => setMetadataOpened(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    loading={savingCollection}
                    onClick={() => {
                      void saveMetadata().then((saved) => {
                        if (saved) setMetadataOpened(false)
                      })
                    }}
                  >
                    Guardar datos
                  </Button>
                </Group>
              </Stack>
            </Modal>
            {selectedCollectionId && (
              <LocalXmlUploadModal
                client={client}
                collectionId={selectedCollectionId}
                opened={xmlUploadOpened}
                onClose={() => setXmlUploadOpened(false)}
                onCompleted={async () => {
                  await refreshCollectionDetail(selectedCollectionId)
                  const nextInvoices = await client.listInvoices()
                  setInvoices(nextInvoices.items)
                }}
              />
            )}
            {route.section === 'profiles' && (
              <LocalProfilesSection client={client} />
            )}
            {route.section === 'official-sources' && (
              <OfficialSourcesSection client={client} />
            )}
            {route.section === 'library' && (
              <LocalLibrarySection
                client={client}
                navigate={(section) => navigate(section)}
              />
            )}
            {route.section === 'settings' && (
              <LocalGpuSettingsSection client={client} />
            )}
          </Stack>
        </Container>
      </AppShell.Main>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Cerrar ejecuciones locales' }}
        opened={jobsOpened}
        position="right"
        size="lg"
        title={
          drawerLevel === 'list'
            ? jobsScope
              ? 'Historial de colección'
              : 'Centro de ejecuciones'
            : drawerLevel === 'run'
              ? 'Detalle de ejecución local'
              : drawerLevel === 'batch'
                ? 'Detalle de ejecución local'
                : 'Detalle de factura'
        }
        onClose={closeJobs}
      >
        <Stack>
          {drawerLevel !== 'list' && (
            <Button
              variant="subtle"
              onClick={() => {
                if (drawerLevel === 'invoice') {
                  setDrawerLevel(invoiceOrigin)
                  return
                }
                setDrawerLevel(drawerLevel === 'run' ? runOrigin : 'list')
              }}
            >
              {drawerLevel === 'invoice' && invoiceOrigin === 'run'
                ? 'Volver a la ejecución'
                : drawerLevel === 'run' && runOrigin === 'batch'
                  ? 'Volver a la ejecución'
                  : 'Volver al listado'}
            </Button>
          )}
          {drawerError && (
            <Alert color="red" title="Acción no completada">
              {drawerError}
            </Alert>
          )}
          {drawerLevel === 'list' && (
            <>
              <Text c="dimmed" size="sm">
                {jobsScope
                  ? 'Ejecuciones guardadas para esta colección local.'
                  : 'Ejecuciones guardadas en esta biblioteca. No se consulta ningún servicio cloud.'}
              </Text>
              {!jobsScope && (
                <Group justify="flex-end">
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    onClick={() =>
                      void client
                        .markAllRunsRead()
                        .then(() =>
                          Promise.all([
                            refreshGlobalRuns(),
                            refreshHistoryRuns(null),
                          ]),
                        )
                        .catch(() =>
                          setDrawerError(
                            'No se pudieron marcar las ejecuciones como leídas.',
                          ),
                        )
                    }
                  >
                    Marcar todas como leídas
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="light"
                    onClick={() => void clearEligibleRuns()}
                  >
                    Limpiar finalizadas
                  </Button>
                </Group>
              )}
              {(() => {
                const drawerRuns = jobsScope ? historyRuns : globalRuns
                const visibleRuns = drawerRuns.filter(
                  (run) =>
                    run.status === 'queued' ||
                    run.status === 'running' ||
                    run.status === 'blocked' ||
                    run.readAt === null,
                )
                const batch =
                  jobsScope &&
                  collectionAnalysisBatch?.collectionId === jobsScope
                    ? collectionAnalysisBatch
                    : null
                const progress = batch
                  ? Math.round((batch.finishedCount / batch.invoiceCount) * 100)
                  : null
                const executionGroups = groupExecutionRuns(visibleRuns)
                const groups = [
                  {
                    label: 'En curso',
                    items: executionGroups.filter(
                      (group) =>
                        group.status === 'queued' || group.status === 'running',
                    ),
                  },
                  {
                    label: 'Requieren atención',
                    items: executionGroups.filter(
                      (group) => group.status === 'blocked',
                    ),
                  },
                  {
                    label: jobsScope ? 'Finalizadas' : 'Finalizadas sin leer',
                    items: executionGroups.filter(
                      (group) =>
                        group.status === 'completed' ||
                        group.status === 'failed',
                    ),
                  },
                ]
                return (
                  <>
                    {batch && (
                      <Card withBorder padding="sm">
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text fw={600} size="sm">
                              Progreso del análisis
                            </Text>
                            <Text c="dimmed" size="sm">
                              {batch.finishedCount} de {batch.invoiceCount}{' '}
                              facturas
                            </Text>
                          </Group>
                          <Progress
                            aria-label="Progreso del análisis de la colección"
                            color={
                              batch.finishedCount === batch.invoiceCount
                                ? 'green'
                                : 'blue'
                            }
                            value={progress ?? 0}
                          />
                        </Stack>
                      </Card>
                    )}
                    {visibleRuns.length === 0 ? (
                      <EmptyState
                        description={
                          jobsScope
                            ? 'Los análisis iniciados aquí quedarán en este historial.'
                            : 'Las ejecuciones activas y las finalizadas sin leer aparecerán aquí.'
                        }
                        title={
                          jobsScope
                            ? 'Aún no hay ejecuciones en esta colección'
                            : 'No hay ejecuciones pendientes de revisar'
                        }
                      />
                    ) : (
                      groups.map(
                        (group) =>
                          group.items.length > 0 && (
                            <Stack gap="xs" key={group.label}>
                              <Text fw={600} size="sm">
                                {group.label}
                              </Text>
                              {group.items.map((execution) => {
                                const representative = execution.runs[0]!
                                const failures = execution.runs.filter(
                                  (run) =>
                                    run.status === 'failed' ||
                                    run.status === 'blocked',
                                ).length
                                return (
                                  <RunListItem
                                    detail={
                                      representative.batch
                                        ? `${execution.finishedCount} de ${execution.invoiceCount} facturas procesadas`
                                        : representative.fileName
                                    }
                                    error={
                                      failures > 0
                                        ? `${failures} factura${failures === 1 ? '' : 's'} requiere${failures === 1 ? '' : 'n'} atención.`
                                        : representative.error
                                    }
                                    invoiceCount={execution.invoiceCount}
                                    key={execution.id}
                                    model={representative.model}
                                    progress={
                                      representative.batch
                                        ? (execution.finishedCount /
                                            execution.invoiceCount) *
                                          100
                                        : representative.progress
                                    }
                                    provider={representative.provider}
                                    runType={
                                      representative.batch
                                        ? 'Análisis de colección'
                                        : 'Análisis individual'
                                    }
                                    status={execution.status}
                                    timestamp={formatRunTime(
                                      representative.timing.createdAt,
                                    )}
                                    title={
                                      representative.collectionName ??
                                      representative.fileName ??
                                      'Ejecución local'
                                    }
                                    unread={execution.unread}
                                    onMarkRead={
                                      execution.unread
                                        ? () =>
                                            void markRunsRead(execution.runs)
                                        : undefined
                                    }
                                    onOpen={() =>
                                      representative.batch
                                        ? void openBatch(execution)
                                        : void openRun(representative)
                                    }
                                  />
                                )
                              })}
                            </Stack>
                          ),
                      )
                    )}
                  </>
                )
              })()}
            </>
          )}
          {drawerLevel === 'batch' && batchDetail && (
            <Stack gap="sm">
              <Card withBorder padding="sm">
                <Stack gap={4}>
                  <Text fw={600} size="sm">
                    Análisis de colección
                  </Text>
                  <Text c="dimmed" size="sm">
                    {batchDetail.finishedCount} de {batchDetail.invoiceCount}{' '}
                    facturas procesadas
                  </Text>
                  <Progress
                    aria-label="Progreso de esta ejecución"
                    color={
                      batchDetail.finishedCount === batchDetail.invoiceCount
                        ? 'green'
                        : 'blue'
                    }
                    value={
                      (batchDetail.finishedCount / batchDetail.invoiceCount) *
                      100
                    }
                  />
                </Stack>
              </Card>
              <Text c="dimmed" size="sm">
                Resultados por factura
              </Text>
              {batchDetail.runs.map((run) => (
                <RunListItem
                  detail={run.fileName}
                  error={run.error}
                  invoiceCount={1}
                  key={run.id}
                  model={run.model}
                  provider={run.provider}
                  runType="Resultado de factura"
                  status={run.status}
                  timestamp={formatRunTime(run.timing.createdAt)}
                  title={run.fileName ?? 'Factura local'}
                  onOpen={() => void openRun(run, 'batch')}
                />
              ))}
            </Stack>
          )}
          {drawerLevel === 'run' && (
            <>
              {runDetailLoading && (
                <Group>
                  <Loader size="sm" />
                  <Text c="dimmed" size="sm">
                    Cargando detalle operativo local…
                  </Text>
                </Group>
              )}
              {runDetailError && (
                <Alert color="red" title="Detalle no disponible">
                  {runDetailError}
                </Alert>
              )}
              {runDetail && (
                <>
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Text fw={600}>Ejecución local</Text>
                      <Text c="dimmed" size="sm">
                        {formatRunTime(runDetail.timing.createdAt)}
                      </Text>
                    </Stack>
                    <ExecutionStatusBadge status={runDetail.status} />
                  </Group>
                  {runDetail.error && (
                    <Alert color="red" title="La ejecución registró un error">
                      {runDetail.error}
                    </Alert>
                  )}
                  <Card withBorder padding="sm">
                    <Stack gap={4}>
                      <Text fw={600} size="sm">
                        Contexto congelado
                      </Text>
                      <Text size="sm">
                        {runDetail.purpose ?? 'Propósito no disponible'}
                        {runDetail.period
                          ? ` · ${runDetail.period.startDate} a ${runDetail.period.endDate}`
                          : ''}
                      </Text>
                      <Text c="dimmed" size="sm">
                        Revisión {runDetail.contextRevision ?? 'no disponible'}{' '}
                        ·{' '}
                        {runDetail.ruleset
                          ? `${runDetail.ruleset.id} ${runDetail.ruleset.version}`
                          : 'ruleset no disponible'}
                      </Text>
                      <Text c="dimmed" size="sm">
                        Conexión: {runDetail.provider ?? 'No disponible'} ·{' '}
                        {runDetail.model ?? 'No disponible'}
                        {runDetail.timing.durationMs !== null
                          ? ` · ${runDetail.timing.durationMs} ms`
                          : ''}
                      </Text>
                    </Stack>
                  </Card>
                  <Stack gap="xs">
                    <Text fw={600} size="sm">
                      Eventos
                    </Text>
                    {runDetail.events.length === 0 ? (
                      <Text c="dimmed" size="sm">
                        Aún no hay eventos guardados para esta ejecución.
                      </Text>
                    ) : (
                      runDetail.events.map((event) => (
                        <Card withBorder key={event.id} padding="sm">
                          <Stack gap="xs">
                            <Group align="flex-start" justify="space-between">
                              <Text size="sm">{event.message}</Text>
                              <ExecutionStatusBadge status={event.status} />
                            </Group>
                            {event.status === 'running' && activeBatch && (
                              <Stack gap={4}>
                                <Progress
                                  animated
                                  aria-label={`Progreso de la colección: ${activeBatch.finishedCount} de ${activeBatch.invoiceCount} facturas`}
                                  color="violet"
                                  value={activeBatchProgress ?? 0}
                                />
                                <Text c="dimmed" size="xs">
                                  Progreso de la colección:{' '}
                                  {activeBatch.finishedCount} de{' '}
                                  {activeBatch.invoiceCount} facturas
                                </Text>
                              </Stack>
                            )}
                            <Text c="dimmed" size="xs">
                              {formatRunTime(event.createdAt)}
                            </Text>
                          </Stack>
                        </Card>
                      ))
                    )}
                  </Stack>
                  <Group justify="flex-end">
                    {runDetail.collectionId ? (
                      <Button
                        variant="light"
                        onClick={() => {
                          const collectionId = runDetail.collectionId
                          if (!collectionId) return
                          void openInvoice(
                            collectionId,
                            runDetail.invoiceId,
                            'run',
                          )
                        }}
                      >
                        Abrir resultado de factura
                      </Button>
                    ) : null}
                    <Button
                      disabled={!runDetail.collectionId}
                      variant="subtle"
                      onClick={() => {
                        if (runDetail.collectionId) {
                          closeJobs()
                          navigate('collections', runDetail.collectionId)
                        }
                      }}
                    >
                      Abrir colección
                    </Button>
                  </Group>
                </>
              )}
            </>
          )}
          {drawerLevel === 'invoice' && (
            <>
              {invoiceDetailLoading && (
                <Group>
                  <Loader size="sm" />
                  <Text c="dimmed" size="sm">
                    Cargando factura local…
                  </Text>
                </Group>
              )}
              {invoiceDetail && (
                <InvoiceDetails
                  analysis={
                    invoiceDetail.latestAnalysis ? (
                      <Stack gap="xs">
                        <Text fw={600}>Resultado de la factura analizada</Text>
                        <Text size="sm">
                          Propósito:{' '}
                          {invoiceDetail.latestAnalysis.purpose ===
                          'personal_expenses'
                            ? 'Gastos personales'
                            : invoiceDetail.latestAnalysis.purpose ===
                                'vat_credit'
                              ? 'Crédito tributario IVA'
                              : 'Impuesto a la renta del negocio'}{' '}
                          · Clasificación:{' '}
                          {
                            analysisClassificationMeta[
                              invoiceDetail.latestAnalysis.classification
                            ].label
                          }
                        </Text>
                        <Text
                          c="dimmed"
                          size="sm"
                          style={{ whiteSpace: 'pre-wrap' }}
                        >
                          {invoiceDetail.latestAnalysis.payload.reasoning}
                        </Text>
                      </Stack>
                    ) : (
                      <EmptyState
                        description="Esta factura ya está disponible en la colección, aunque todavía no se ha analizado."
                        title="Sin análisis todavía"
                      />
                    )
                  }
                  invoice={{
                    fileName: invoiceDetail.fileName,
                    typeLabel: 'Factura local',
                    issueDate: invoiceDetail.issueDate,
                    buyer: {
                      name: invoiceDetail.buyer.name ?? 'No disponible',
                      identifierLabel: 'Identificación',
                      identifier:
                        invoiceDetail.buyer.identifier ?? 'No disponible',
                    },
                    seller: {
                      name: invoiceDetail.seller.name ?? 'No disponible',
                      identifier:
                        invoiceDetail.seller.identifier ?? 'No disponible',
                      tradeName: invoiceDetail.seller.tradeName,
                      address: invoiceDetail.seller.address,
                    },
                    totals: {
                      subtotal: localNumber(invoiceDetail.totals.subtotal),
                      discount: localNumber(invoiceDetail.totals.discount),
                      taxes: localNumber(invoiceDetail.totals.tax),
                      total: localNumber(invoiceDetail.totals.total),
                      currency: invoiceDetail.totals.currency,
                    },
                    taxes: invoiceDetail.taxes.map((tax, index) => ({
                      id: `${tax.code ?? 'tax'}-${index}`,
                      code: tax.code,
                      rate: tax.rate,
                      taxableBase: localNumber(tax.taxableBase),
                      amount: localNumber(tax.amount),
                    })),
                    items: invoiceDetail.lineItems.map((item, index) => ({
                      id: `${item.code ?? 'item'}-${index}`,
                      description: item.description ?? 'Sin descripción',
                      unitPrice: localNumber(item.unitPrice),
                      quantity: localNumber(item.quantity),
                      discount: localNumber(item.discount),
                      total: localNumber(item.total),
                    })),
                  }}
                />
              )}
            </>
          )}
        </Stack>
      </Drawer>
    </AppShell>
  )
}
