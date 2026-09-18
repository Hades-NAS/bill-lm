import {
  Alert,
  Button,
  Card,
  Container,
  FileButton,
  Group,
  Loader,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'

import { resolveLocalAnalysisAvailability } from '@bill-lm/contracts'

import { EmptyState, FieldHelpLabel } from '@bill-lm/ui'

import { LocalAnalysisAction } from './local-analysis-action'
import {
  CollectionContextRevisionInputSchema,
  EconomicActivityRevisionInputSchema,
  TaxpayerProfileRevisionInputSchema,
} from '@bill-lm/contracts'

import { LocalDaemonClient } from './api'

import type { LocalApiFlavor, LocalConnection } from '@bill-lm/contracts'
import type {
  CollectionContextRevisionInput,
  EconomicActivityRevisionInput,
  TaxpayerProfileRevisionInput,
} from '@bill-lm/contracts'
import type { LocalCollectionContext, LocalEconomicActivity, LocalTaxpayerProfile } from './api'

const client = new LocalDaemonClient()

const blankActivity: EconomicActivityRevisionInput = {
  displayName: '',
  registeredActivityCode: '',
  registeredActivityName: '',
  activityDescription: '',
  necessaryPurchases: '',
  revenueVatTreatment: 'unknown',
  revenueVatTreatmentOther: '',
  mixedUseDescription: '',
  additionalFacts: '',
}

const blankProfile: TaxpayerProfileRevisionInput = {
  displayName: '',
  personalIdNumber: '',
  professionalIdNumber: '',
  hasEmploymentIncome: false,
  hasRuc: false,
  taxRegime: 'unknown',
  vatFilingFrequency: 'none',
  activityRevisionIds: [],
  additionalFacts: '',
}

const today = new Date().toISOString().slice(0, 10)
const blankCollectionContext: CollectionContextRevisionInput = {
  purpose: 'personal_expenses',
  period: { startDate: today, endDate: today },
  taxpayerProfileRevisionId: '',
  activityRevisionIds: [],
  notes: '',
}

export function LocalViewer() {
  const [message, setMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [connections, setConnections] = useState<Array<LocalConnection>>([])
  const [label, setLabel] = useState('')
  const [apiFlavor, setApiFlavor] = useState<LocalApiFlavor>('openai-like')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:1234/v1')
  const [model, setModel] = useState('')
  const [rulesetLabel, setRulesetLabel] = useState('Cargando ruleset aprobado…')
  const [runCount, setRunCount] = useState<number | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<
    Array<{ id: string; fileName: string }>
  >([])
  const [runMessage, setRunMessage] = useState<string | null>(null)
  const [activities, setActivities] = useState<Array<LocalEconomicActivity>>([])
  const [profiles, setProfiles] = useState<Array<LocalTaxpayerProfile>>([])
  const [activityDraft, setActivityDraft] = useState(blankActivity)
  const [profileDraft, setProfileDraft] = useState(blankProfile)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [savingProfileData, setSavingProfileData] = useState(false)
  const [loadingProfileData, setLoadingProfileData] = useState(true)
  const [collections, setCollections] = useState<Array<LocalCollectionContext>>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [collectionDraft, setCollectionDraft] = useState(blankCollectionContext)
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [collectionLoadError, setCollectionLoadError] = useState(false)
  const [savingCollection, setSavingCollection] = useState(false)

  useEffect(() => {
    void client
      .listConnections()
      .then(setConnections)
      .catch(() => {
        setMessage(
          'No se pudo conectar al daemon local. Ábrelo y vuelve a intentar.',
        )
      })
  }, [])

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

  useEffect(() => {
    void refreshCollections().catch(() => {})
  }, [])

  const selectedCollection = collections.find(
    (collection) => collection.id === selectedCollectionId,
  )

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
  }

  async function createCollection() {
    setSavingCollection(true)
    try {
      const created = await client.createCollection()
      await refreshCollections()
      selectCollection(created)
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
      setMessage('Contexto de colección guardado como una revisión local.')
    } catch {
      setMessage('No se pudo guardar el contexto de la colección local.')
    } finally {
      setSavingCollection(false)
    }
  }

  async function refreshProfileData() {
    setLoadingProfileData(true)
    try {
      const [nextActivities, nextProfiles] = await Promise.all([
        client.listActivities(),
        client.listProfiles(),
      ])
      setActivities(nextActivities)
      setProfiles(nextProfiles)
    } finally {
      setLoadingProfileData(false)
    }
  }

  useEffect(() => {
    void refreshProfileData().catch(() =>
      setMessage('No se pudieron cargar los perfiles y actividades locales.'),
    )
  }, [])

  function editActivity(activity: LocalEconomicActivity) {
    const { id: _id, activityId: _activityId, revision: _revision, createdAt: _createdAt, ...draft } = activity.latestRevision
    setActivityDraft(draft)
    setEditingActivityId(activity.id)
  }

  function editProfile(profile: LocalTaxpayerProfile) {
    const { id: _id, taxpayerProfileId: _taxpayerProfileId, revision: _revision, createdAt: _createdAt, ...draft } = profile.latestRevision
    setProfileDraft(draft)
    setEditingProfileId(profile.id)
  }

  async function saveActivity() {
    const parsed = EconomicActivityRevisionInputSchema.safeParse(activityDraft)
    if (!parsed.success)
      return setMessage(parsed.error.issues[0]?.message ?? 'Revisa la actividad.')
    setSavingProfileData(true)
    try {
      if (editingActivityId)
        await client.reviseActivity(editingActivityId, parsed.data)
      else await client.createActivity(parsed.data)
      await refreshProfileData()
      setActivityDraft(blankActivity)
      setEditingActivityId(null)
      setMessage('Actividad económica guardada como una revisión local.')
    } catch {
      setMessage('No se pudo guardar la actividad económica local.')
    } finally {
      setSavingProfileData(false)
    }
  }

  async function saveProfile() {
    const parsed = TaxpayerProfileRevisionInputSchema.safeParse(profileDraft)
    if (!parsed.success)
      return setMessage(parsed.error.issues[0]?.message ?? 'Revisa el perfil.')
    setSavingProfileData(true)
    try {
      if (editingProfileId)
        await client.reviseProfile(editingProfileId, parsed.data)
      else await client.createProfile(parsed.data)
      await refreshProfileData()
      setProfileDraft(blankProfile)
      setEditingProfileId(null)
      setMessage('Perfil tributario guardado como una revisión local.')
    } catch {
      setMessage('No se pudo guardar el perfil tributario local.')
    } finally {
      setSavingProfileData(false)
    }
  }

  useEffect(() => {
    void client.listInvoices().then((result) => {
      setInvoices(result.items)
      setInvoiceId((current) => current ?? result.items.at(0)?.id ?? null)
    })
  }, [])

  useEffect(() => {
    void client
      .listRuns()
      .then((result) => setRunCount(result.items.length))
      .catch(() => setRunCount(null))
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

  async function saveConnection() {
    try {
      const connection = await client.createConnection({
        label,
        apiFlavor,
        baseUrl,
        model,
        makeDefault: connections.length === 0,
      })
      setConnections((current) => [...current, connection])
      setLabel('')
      setModel('')
      setMessage(
        'Conexión local guardada. Se probará de nuevo antes de cada análisis.',
      )
    } catch {
      setMessage('Revisa los datos de la conexión local e inténtalo otra vez.')
    }
  }

  async function importInvoice(file: File | null) {
    if (!file) return
    setImporting(true)
    try {
      const result = await client.importXml(file)
      const importedInvoiceId = result.invoiceId
      if (importedInvoiceId) setInvoiceId(importedInvoiceId)
      if (importedInvoiceId)
        setInvoices((current) => [
          { id: importedInvoiceId, fileName: file.name },
          ...current,
        ])
      setMessage(
        result.kind === 'imported'
          ? 'Factura XML importada en tu biblioteca local.'
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

  return (
    <Container py="xl" size="md">
      <Stack gap="xl">
        <header>
          <Title order={1}>Bill LM local</Title>
          <Text c="dimmed">
            Tu biblioteca se conserva en este equipo. Sólo se importan
            comprobantes XML.
          </Text>
        </header>
        {message && <Alert title="Biblioteca local">{message}</Alert>}
        <Alert color="violet" title="Fuentes SRI aprobadas">
          {rulesetLabel}
        </Alert>
        <Text c="dimmed" size="sm">
          Historial local:{' '}
          {runCount === null ? 'no disponible' : `${runCount} ejecuciones`}
        </Text>
        <Text c="dimmed" size="sm">
          Facturas XML locales: {invoices.length}
        </Text>
        {runMessage && <Alert title="Progreso persistido">{runMessage}</Alert>}
        <Card withBorder>
          <Stack>
            <div>
              <Title order={2} size="h3">
                Importar factura
              </Title>
              <Text c="dimmed" size="sm">
                No se aceptan PDF, ZIP ni reglas tributarias externas.
              </Text>
            </div>
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
                    Elegir XML
                  </Button>
                )}
              </FileButton>
            </Group>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <Group justify="space-between">
              <div>
                <Title order={2} size="h3">Colecciones locales</Title>
                <Text c="dimmed" size="sm">
                  Cada colección conserva revisiones de su contexto tributario en este equipo.
                </Text>
              </div>
              <Button loading={savingCollection} onClick={() => void createCollection()}>
                Nueva colección
              </Button>
            </Group>
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
              <Select
                data={collections.map((collection, index) => ({
                  value: collection.id,
                  label: collection.latestRevision
                    ? `Colección ${index + 1} · revisión ${collection.latestRevision.revision}`
                    : `Colección ${index + 1} · sin contexto`,
                }))}
                label="Colección seleccionada"
                value={selectedCollectionId}
                onChange={(id) => {
                  const collection = collections.find((candidate) => candidate.id === id)
                  if (collection) selectCollection(collection)
                }}
              />
            )}
            {selectedCollection && (
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
        <Card withBorder>
          <Stack>
            <div>
              <Title order={2} size="h3">Actividades económicas</Title>
              <Text c="dimmed" size="sm">
                Las ediciones crean revisiones locales y no modifican análisis anteriores.
              </Text>
            </div>
            {loadingProfileData ? (
              <Group gap="xs">
                <Loader size="sm" />
                <Text c="dimmed" size="sm">Cargando actividades locales…</Text>
              </Group>
            ) : activities.length === 0 ? (
              <EmptyState
                description="Agrega una actividad si este equipo analiza gastos vinculados a un RUC."
                title="No hay actividades locales"
              />
            ) : (
              activities.map((activity) => (
                <Group justify="space-between" key={activity.id}>
                  <Text>{activity.latestRevision.displayName}</Text>
                  <Button variant="subtle" onClick={() => editActivity(activity)}>
                    Nueva revisión
                  </Button>
                </Group>
              ))
            )}
            <TextInput
              label={<FieldHelpLabel hint="Un nombre para reconocer esta actividad." label="Nombre de actividad" />}
              value={activityDraft.displayName}
              onChange={(event) => setActivityDraft((current) => ({ ...current, displayName: event.currentTarget.value }))}
            />
            <TextInput
              label="Nombre de actividad registrada"
              value={activityDraft.registeredActivityName}
              onChange={(event) => setActivityDraft((current) => ({ ...current, registeredActivityName: event.currentTarget.value }))}
            />
            <TextInput
              label="Código registrado (opcional)"
              value={activityDraft.registeredActivityCode}
              onChange={(event) => setActivityDraft((current) => ({ ...current, registeredActivityCode: event.currentTarget.value }))}
            />
            <Textarea
              label="¿En qué consiste esta actividad?"
              value={activityDraft.activityDescription}
              onChange={(event) => setActivityDraft((current) => ({ ...current, activityDescription: event.currentTarget.value }))}
            />
            <Select
              data={[
                { value: 'taxed_nonzero', label: 'Gravada con IVA' },
                { value: 'zero_with_credit', label: 'Tarifa 0% con crédito' },
                { value: 'zero_without_credit', label: 'Tarifa 0% sin crédito' },
                { value: 'mixed', label: 'Uso mixto' },
                { value: 'export', label: 'Exportación' },
                { value: 'unknown', label: 'Aún no lo sé' },
                { value: 'other', label: 'Otro' },
              ]}
              label="Tratamiento de ingresos/IVA"
              value={activityDraft.revenueVatTreatment}
              onChange={(value) => setActivityDraft((current) => ({ ...current, revenueVatTreatment: (value ?? 'unknown') as EconomicActivityRevisionInput['revenueVatTreatment'] }))}
            />
            {activityDraft.revenueVatTreatment === 'other' && (
              <Textarea label="Describe el tratamiento" value={activityDraft.revenueVatTreatmentOther} onChange={(event) => setActivityDraft((current) => ({ ...current, revenueVatTreatmentOther: event.currentTarget.value }))} />
            )}
            {activityDraft.revenueVatTreatment === 'mixed' && (
              <Textarea label="Explica el uso mixto (opcional)" value={activityDraft.mixedUseDescription} onChange={(event) => setActivityDraft((current) => ({ ...current, mixedUseDescription: event.currentTarget.value }))} />
            )}
            <Textarea label="Compras o gastos necesarios (opcional)" value={activityDraft.necessaryPurchases} onChange={(event) => setActivityDraft((current) => ({ ...current, necessaryPurchases: event.currentTarget.value }))} />
            <Textarea label="Datos adicionales (opcional)" value={activityDraft.additionalFacts} onChange={(event) => setActivityDraft((current) => ({ ...current, additionalFacts: event.currentTarget.value }))} />
            <Group justify="flex-end">
              {editingActivityId && <Button variant="default" onClick={() => { setActivityDraft(blankActivity); setEditingActivityId(null) }}>Cancelar</Button>}
              <Button loading={savingProfileData} onClick={() => void saveActivity()}>
                {editingActivityId ? 'Guardar revisión' : 'Agregar actividad'}
              </Button>
            </Group>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <div>
              <Title order={2} size="h3">Perfil tributario</Title>
              <Text c="dimmed" size="sm">Los perfiles locales vinculan las revisiones actuales de tus actividades.</Text>
            </div>
            {loadingProfileData ? (
              <Group gap="xs">
                <Loader size="sm" />
                <Text c="dimmed" size="sm">Cargando perfiles locales…</Text>
              </Group>
            ) : profiles.length === 0 ? (
              <EmptyState description="Crea un perfil para conservar tu contexto tributario local." title="No hay perfiles locales" />
            ) : (
              profiles.map((profile) => (
                <Group justify="space-between" key={profile.id}>
                  <Text>{profile.latestRevision.displayName}</Text>
                  <Button variant="subtle" onClick={() => editProfile(profile)}>Nueva revisión</Button>
                </Group>
              ))
            )}
            <TextInput label={<FieldHelpLabel hint="Un nombre para reconocer esta configuración." label="Nombre del perfil" />} value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.currentTarget.value }))} />
            <Switch checked={profileDraft.hasEmploymentIncome} label="También tengo ingresos en relación de dependencia" onChange={(event) => setProfileDraft((current) => ({ ...current, hasEmploymentIncome: event.currentTarget.checked }))} />
            <Switch checked={profileDraft.hasRuc} label="Tengo RUC" onChange={(event) => setProfileDraft((current) => ({ ...current, hasRuc: event.currentTarget.checked, vatFilingFrequency: event.currentTarget.checked ? current.vatFilingFrequency : 'none', activityRevisionIds: event.currentTarget.checked ? current.activityRevisionIds : [] }))} />
            <TextInput label="Cédula (opcional)" maxLength={10} value={profileDraft.personalIdNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, personalIdNumber: event.currentTarget.value }))} />
            <TextInput disabled={!profileDraft.hasRuc} label="RUC (opcional)" maxLength={13} value={profileDraft.professionalIdNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, professionalIdNumber: event.currentTarget.value }))} />
            <Select disabled={!profileDraft.hasRuc} data={[{ value: 'general', label: 'General' }, { value: 'rimpe_entrepreneur', label: 'RIMPE emprendedor' }, { value: 'rimpe_popular_business', label: 'RIMPE negocio popular' }, { value: 'unknown', label: 'Aún no lo sé' }]} label="Régimen tributario" value={profileDraft.taxRegime} onChange={(value) => setProfileDraft((current) => ({ ...current, taxRegime: (value ?? 'unknown') as TaxpayerProfileRevisionInput['taxRegime'] }))} />
            <Select disabled={!profileDraft.hasRuc} data={[{ value: 'none', label: 'Sin obligación de IVA' }, { value: 'monthly', label: 'Mensual' }, { value: 'semiannual', label: 'Semestral' }, { value: 'unknown', label: 'Aún no lo sé' }]} label="Periodicidad de IVA" value={profileDraft.vatFilingFrequency} onChange={(value) => setProfileDraft((current) => ({ ...current, vatFilingFrequency: (value ?? 'none') as TaxpayerProfileRevisionInput['vatFilingFrequency'] }))} />
            <MultiSelect disabled={!profileDraft.hasRuc} data={activities.map((activity) => ({ value: activity.latestRevision.id, label: activity.latestRevision.displayName }))} label="Actividades" value={profileDraft.activityRevisionIds} onChange={(value) => setProfileDraft((current) => ({ ...current, activityRevisionIds: value }))} />
            <Textarea label="Datos adicionales (opcional)" value={profileDraft.additionalFacts} onChange={(event) => setProfileDraft((current) => ({ ...current, additionalFacts: event.currentTarget.value }))} />
            <Group justify="flex-end">
              {editingProfileId && <Button variant="default" onClick={() => { setProfileDraft(blankProfile); setEditingProfileId(null) }}>Cancelar</Button>}
              <Button loading={savingProfileData} onClick={() => void saveProfile()}>{editingProfileId ? 'Guardar revisión' : 'Agregar perfil'}</Button>
            </Group>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <div>
              <Title order={2} size="h3">
                Conexión local-GPU
              </Title>
              <Text c="dimmed" size="sm">
                Si no registras una conexión, Analizar te guiará al modo OAuth.
              </Text>
            </div>
            <TextInput
              label={
                <FieldHelpLabel
                  hint="Un nombre para reconocer esta GPU o servidor local."
                  label="Nombre"
                />
              }
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
            />
            <Select
              data={[
                { value: 'openai-like', label: 'OpenAI-like' },
                { value: 'claude-like', label: 'Claude-like' },
              ]}
              label={
                <FieldHelpLabel
                  hint="Elige el contrato que implementa tu servidor local."
                  label="Tipo de API"
                />
              }
              value={apiFlavor}
              onChange={(value) => setApiFlavor(value as LocalApiFlavor)}
            />
            <TextInput
              label={
                <FieldHelpLabel
                  hint="Una URL localhost o de tu red privada; nunca se envía a Bill LM cloud."
                  label="URL base"
                />
              }
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.currentTarget.value)}
            />
            <TextInput
              label={
                <FieldHelpLabel
                  hint="El identificador que expone tu servidor de inferencia."
                  label="Modelo"
                />
              }
              value={model}
              onChange={(event) => setModel(event.currentTarget.value)}
            />
            <Group justify="space-between">
              <Button
                disabled={!label || !model}
                onClick={() => void saveConnection()}
              >
                Guardar conexión
              </Button>
              <LocalAnalysisAction
                availability={resolveLocalAnalysisAvailability(connections)}
                onStartGpu={(id) =>
                  void (
                    invoiceId
                      ? client.analyze(invoiceId)
                      : client.probeConnection(id)
                  )
                    .then((result) =>
                      setMessage(
                        'id' in result
                          ? (void client
                              .listRunEvents(result.id)
                              .then((events) =>
                                setRunMessage(
                                  events.items.at(0)?.message ?? 'Run creado.',
                                ),
                              ),
                            `Run local ${result.id} creado.`)
                          : result.ok
                            ? 'La conexión respondió. Importa una factura XML para analizarla.'
                            : (result.message ??
                              'La prueba de conexión falló; puedes continuar con OAuth.'),
                      ),
                    )
                    .catch(() =>
                      setMessage(
                        'La prueba de conexión falló; puedes continuar con OAuth.',
                      ),
                    )
                }
              />
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}
