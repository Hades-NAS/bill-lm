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
  FileButton,
  Group,
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
import { Bell, BookOpen, BriefcaseBusiness, Calendar, Files, LibraryBig, Menu, Moon, Plus, Settings, Sun, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'

import { EmptyState, FieldHelpLabel } from '@bill-lm/ui'

import {
  CollectionContextRevisionInputSchema,
} from '@bill-lm/contracts'

import { LocalDaemonClient } from './api'
import { LocalGpuSettingsSection, LocalLibrarySection, OfficialSourcesSection } from './local-sections'
import { LocalCollectionAnalysis } from './local-collection-analysis'
import { LocalProfilesSection } from './local-profiles-section'

import type {
  CollectionContextRevisionInput,
  LocalCollectionDetail,
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

export function LocalViewer() {
  const [mobileOpened, { close: closeMobile, toggle: toggleMobile }] = useDisclosure(false)
  const [createCollectionOpened, createCollectionModal] = useDisclosure(false)
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const [route, setRoute] = useState<LocalRoute>(() => parseLocalRoute(window.location.hash))
  const [message, setMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
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
  const [jobsOpened, setJobsOpened] = useState(false)
  const [runs, setRuns] = useState<Array<{ id: string; collectionId: string | null; invoiceId: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked'; createdAt: string; readAt: string | null }>>([])

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
    if (!collectionId) {
      setCollectionDetail(null)
      return
    }
    setLoadingCollectionDetail(true)
    setCollectionDetailError(false)
    try {
      setCollectionDetail(await client.getCollectionDetail(collectionId))
    } catch {
      setCollectionDetail(null)
      setCollectionDetailError(true)
    } finally {
      setLoadingCollectionDetail(false)
    }
  }

  useEffect(() => {
    void refreshCollections().catch(() => {})
  }, [])

  async function refreshRuns() {
    try { setRuns(await client.listRuns()) } catch { /* A disconnected daemon must not break navigation. */ }
  }
  useEffect(() => {
    void refreshRuns()
    const timer = window.setInterval(() => { void refreshRuns() }, 5_000)
    return () => window.clearInterval(timer)
  }, [])

  const unreadRunCount = runs.filter((run) => run.readAt === null).length
  async function openRun(run: typeof runs[number]) {
    if (!run.collectionId) return
    try { await client.markRunRead(run.id) } catch { /* Read state is best effort. */ }
    setJobsOpened(false)
    navigate('collections', run.collectionId)
    await refreshRuns()
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
      const created = await client.createCollection({ name: newCollectionName, year })
      await refreshCollections()
      selectCollection(created)
      setNewCollectionName('')
      setNewCollectionYear(String(new Date().getFullYear()))
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
    if (!selectedCollectionId)
      return setMessage('Primero crea o selecciona una colección local.')
    const parsed = CollectionContextRevisionInputSchema.safeParse(collectionDraft)
    if (!parsed.success)
      return setMessage(parsed.error.issues[0]?.message ?? 'Revisa el contexto de la colección.')
    setSavingCollection(true)
    try {
      await client.reviseCollection(selectedCollectionId, parsed.data)
      await refreshCollections()
      await refreshCollectionDetail(selectedCollectionId)
      setMessage('Contexto de colección guardado como una revisión local.')
    } catch {
      setMessage('No se pudo guardar el contexto de la colección local.')
    } finally {
      setSavingCollection(false)
    }
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

  async function importInvoice(file: File | null) {
    if (!file) return
    if (!selectedCollectionId) {
      setMessage('Crea o selecciona una colección antes de importar una factura XML.')
      return
    }
    setImporting(true)
    try {
      const result = await client.importCollectionXml(selectedCollectionId, file)
      const importedInvoiceId = result.invoiceId
      if (importedInvoiceId)
        setInvoices((current) => [
          { id: importedInvoiceId, fileName: file.name },
          ...current,
        ])
      await refreshCollectionDetail(selectedCollectionId)
      setMessage(
        result.kind === 'imported'
          ? 'Factura XML importada y asociada a esta colección local.'
          : result.kind === 'duplicate'
            ? 'Esta factura ya existe en la biblioteca local.'
            : (result.message ?? 'No se pudo importar el XML.'),
      )
    } catch {
      setMessage(
        'No se pudo conectar al daemon local. Ábrelo y vuelve a intentar.',
      )
    } finally {
      setImporting(false)
    }
  }

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
            <ActionIcon aria-label="Abrir historial de análisis" onClick={() => setJobsOpened(true)} variant="default">
              <Bell size={18} />
              {unreadRunCount > 0 && <Badge aria-label={`${unreadRunCount} ejecuciones sin leer`} color="red" size="xs" style={{ position: 'absolute', right: -6, top: -6 }}>{unreadRunCount}</Badge>}
            </ActionIcon>
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
        {route.section !== 'profiles' && <header>
          <Title order={1}>{navigation.find((item) => item.section === route.section)?.label ?? 'Colecciones'}</Title>
          <Text c="dimmed">
            {route.section === 'collections'
              ? 'Tu biblioteca se conserva en este equipo. Sólo se importan comprobantes XML.'
              : 'Esta sección se guarda y opera únicamente con el daemon local.'}
          </Text>
        </header>}
        {message && <Alert title="Biblioteca local">{message}</Alert>}
        {route.section === 'collections' && route.collectionId && <>
        <Group justify="space-between">
          <Button aria-label="Volver a colecciones" onClick={() => navigate('collections')} variant="subtle">Volver a colecciones</Button>
          <Text c="dimmed" size="sm">Detalle de colección local</Text>
        </Group>
        <Alert color="violet" title="Fuentes SRI aprobadas">
          {rulesetLabel}
        </Alert>
        <Text c="dimmed" size="sm">
          Facturas XML locales: {invoices.length}
        </Text>
        <Card withBorder>
          <Stack>
            <div>
              <Title order={2} size="h3">
                Facturas de la colección
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
            <Group>
              <FileButton
                accept="application/xml,text/xml,.xml"
                onChange={importInvoice}
              >
                {(props) => (
                  <Button
                    {...props}
                    leftSection={<Upload size={16} />}
                    loading={importing}
                  >
                    Importar XML a esta colección
                  </Button>
                )}
              </FileButton>
            </Group>
            <Group align="end" grow>
              <Select
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
                  <Table.ScrollContainer minWidth={620}>
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
                              <Table.Td><Button color="red" loading={savingCollection} onClick={() => setDetachInvoiceIds([invoice.id])} size="compact-sm" variant="subtle">Quitar</Button></Table.Td>
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
        {collectionDetail && !loadingCollectionDetail && !collectionDetailError && (
          <LocalCollectionAnalysis client={client} collection={collectionDetail} onChanged={() => refreshCollectionDetail(selectedCollectionId)} onOpenSettings={() => navigate('settings')} />
        )}
        <Modal opened={detachInvoiceIds.length > 0} onClose={() => setDetachInvoiceIds([])} title="Quitar facturas de la colección">
          <Stack>
            <Text>{detachInvoiceIds.length === 1 ? 'La factura se quitará' : `${detachInvoiceIds.length} facturas se quitarán`} de esta colección, pero sus XML seguirán disponibles en la biblioteca local.</Text>
            <Group justify="flex-end"><Button onClick={() => setDetachInvoiceIds([])} variant="default">Cancelar</Button><Button color="red" loading={savingCollection} onClick={() => void detachCollectionInvoices(detachInvoiceIds)}>Confirmar quitar</Button></Group>
          </Stack>
        </Modal>
        </>}
        {route.section === 'collections' && <>
        <Card withBorder>
          <Stack>
            <Group justify="space-between">
              <div>
                <Title order={2} size="h3">Colecciones locales</Title>
                <Text c="dimmed" size="sm">
                  Cada colección conserva revisiones de su contexto tributario en este equipo.
                </Text>
              </div>
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
                <Alert color="violet" title="Guía de colecciones">
                  Agrupa comprobantes por período, actividad o propósito tributario. Cada colección mantiene su contexto y sus análisis de forma local e independiente.
                </Alert>
                <Group align="end" grow>
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
                </Group>
                {visibleCollections.length === 0 ? (
                  <EmptyState title="No se encontraron colecciones" description="Prueba con otro nombre o elimina el filtro de año." />
                ) : (
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    {visibleCollections.map((collection) => (
                      <Card key={collection.id} padding="md" radius="md" shadow="sm" withBorder>
                        <Stack gap="md">
                          <div>
                            <Title order={3} size="h4">{collection.name}</Title>
                            <Text c="dimmed" size="sm">
                              {collection.latestRevision
                                ? `Contexto: revisión ${collection.latestRevision.revision}`
                                : 'Contexto pendiente'}
                            </Text>
                          </div>
                          <Group gap="xs"><Calendar size={16} /><Text size="sm">{collection.year}</Text></Group>
                          <Group gap="xs"><Files size={16} /><Text size="sm">{collection.invoiceCount === 0 ? 'Sin facturas' : `${collection.invoiceCount} factura${collection.invoiceCount === 1 ? '' : 's'}`}</Text></Group>
                          <Button aria-label={`Abrir colección ${collection.name}`} onClick={() => selectCollection(collection)} variant="light">
                            Abrir colección
                          </Button>
                        </Stack>
                      </Card>
                    ))}
                  </SimpleGrid>
                )}
              </Stack>
            )}
            </>}
            {route.collectionId && selectedCollection && (
              <>
                {selectedCollection.latestRevision === null && (
                  <Alert color="blue" title="Contexto pendiente">
                    Esta colección todavía no tiene una revisión de contexto.
                  </Alert>
                )}
                <Select
                  data={profiles.map((profile) => ({ value: profile.latestRevision.id, label: profile.latestRevision.displayName }))}
                  label={<FieldHelpLabel hint="El contexto usa una revisión concreta del perfil local." label="Perfil tributario" />}
                  placeholder="Selecciona un perfil"
                  value={collectionDraft.taxpayerProfileRevisionId || null}
                  onChange={updateCollectionProfile}
                />
                <MultiSelect
                  data={(profiles.find((profile) => profile.latestRevision.id === collectionDraft.taxpayerProfileRevisionId)?.latestRevision.activityRevisionIds ?? []).flatMap((id) => {
                    const activity = activities.find((candidate) => candidate.latestRevision.id === id)
                    return activity ? [{ value: id, label: activity.latestRevision.displayName }] : []
                  })}
                  label="Actividades vinculadas"
                  value={collectionDraft.activityRevisionIds}
                  onChange={(activityRevisionIds) => setCollectionDraft((current) => ({ ...current, activityRevisionIds }))}
                />
                <Select
                  data={[{ value: 'personal_expenses', label: 'Gastos personales' }, { value: 'vat_credit', label: 'Crédito tributario IVA' }, { value: 'business_income_tax', label: 'Impuesto a la renta del negocio' }]}
                  label="Propósito tributario"
                  value={collectionDraft.purpose}
                  onChange={(purpose) => setCollectionDraft((current) => ({ ...current, purpose: (purpose ?? 'personal_expenses') as CollectionContextRevisionInput['purpose'] }))}
                />
                <Group grow>
                  <TextInput label="Desde" type="date" value={collectionDraft.period.startDate} onChange={(event) => setCollectionDraft((current) => ({ ...current, period: { ...current.period, startDate: event.currentTarget.value } }))} />
                  <TextInput label="Hasta" type="date" value={collectionDraft.period.endDate} onChange={(event) => setCollectionDraft((current) => ({ ...current, period: { ...current.period, endDate: event.currentTarget.value } }))} />
                </Group>
                <Textarea label="Notas (opcional)" value={collectionDraft.notes ?? ''} onChange={(event) => setCollectionDraft((current) => ({ ...current, notes: event.currentTarget.value }))} />
                <Group justify="flex-end"><Button loading={savingCollection} onClick={() => void saveCollectionRevision()}>Guardar revisión de contexto</Button></Group>
              </>
            )}
          </Stack>
        </Card>
        </>}
        <Modal opened={createCollectionOpened} onClose={createCollectionModal.close} title="Nueva colección local">
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
            <Group justify="flex-end">
              <Button onClick={createCollectionModal.close} variant="default">Cancelar</Button>
              <Button loading={savingCollection} onClick={() => void createCollection()}>Crear colección</Button>
            </Group>
          </Stack>
        </Modal>
        {route.section === 'profiles' && <LocalProfilesSection client={client} />}
        {route.section === 'official-sources' && <OfficialSourcesSection client={client} />}
        {route.section === 'library' && <LocalLibrarySection client={client} navigate={(section) => navigate(section)} />}
        {route.section === 'settings' && <LocalGpuSettingsSection client={client} />}
      </Stack>
    </Container>
      </AppShell.Main>
      <Drawer opened={jobsOpened} onClose={() => setJobsOpened(false)} position="right" title="Historial local de análisis">
        <Stack>
          <Text c="dimmed" size="sm">Ejecuciones guardadas en esta biblioteca. No se consulta ningún servicio cloud.</Text>
          {runs.length === 0 ? <EmptyState title="Aún no hay ejecuciones" description="Los análisis que inicies desde una colección aparecerán aquí." /> : runs.map((run) => <Card key={run.id} withBorder padding="sm"><Group justify="space-between" align="flex-start"><div><Text fw={600}>{run.status === 'running' ? 'Analizando localmente' : run.status === 'queued' ? 'Análisis en cola' : 'Análisis local'}</Text><Text c="dimmed" size="xs">{new Date(run.createdAt).toLocaleString('es-EC')}</Text></div><Button disabled={!run.collectionId} onClick={() => void openRun(run)} size="compact-sm" variant="light">Ver detalle</Button></Group></Card>)}
        </Stack>
      </Drawer>
    </AppShell>
  )
}
