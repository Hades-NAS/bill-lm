import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { FilePenLine, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { EmptyState, FieldHelpLabel } from '@bill-lm/ui'
import {
  EconomicActivityRevisionInputSchema,
  TaxpayerProfileRevisionDataSchema,
  TaxpayerProfileRevisionInputSchema,
} from '@bill-lm/contracts'

import type {
  EconomicActivityRevisionInput,
  TaxpayerProfileRevisionInput,
} from '@bill-lm/contracts'
import type { LocalDaemonClient, LocalEconomicActivity, LocalTaxpayerProfile } from './api'

const blankActivity: EconomicActivityRevisionInput = {
  displayName: '', registeredActivityCode: '', registeredActivityName: '',
  activityDescription: '', necessaryPurchases: '', revenueVatTreatment: 'unknown',
  revenueVatTreatmentOther: '', mixedUseDescription: '', additionalFacts: '',
}

const blankProfile: TaxpayerProfileRevisionInput = {
  displayName: '', personalIdNumber: '', professionalIdNumber: '',
  hasEmploymentIncome: false, hasRuc: false, taxRegime: 'unknown',
  vatFilingFrequency: 'none', activityRevisionIds: [], additionalFacts: '',
}

type Props = { client: LocalDaemonClient }

export function LocalProfilesSection({ client }: Props) {
  const [activities, setActivities] = useState<LocalEconomicActivity[]>([])
  const [profiles, setProfiles] = useState<LocalTaxpayerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activityDraft, setActivityDraft] = useState(blankActivity)
  const [profileDraft, setProfileDraft] = useState(blankProfile)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [profileStep, setProfileStep] = useState(0)
  const [profileStepError, setProfileStepError] = useState<string | null>(null)
  const [activityOpened, activityModal] = useDisclosure(false)
  const [profileOpened, profileModal] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 48em)')

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [nextActivities, nextProfiles] = await Promise.all([
        client.listActivities(), client.listProfiles(),
      ])
      setActivities(nextActivities)
      setProfiles(nextProfiles)
    } catch {
      setError('No se pudieron cargar los perfiles y actividades locales.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  function openActivity(activity?: LocalEconomicActivity) {
    if (activity) {
      const { id: _id, activityId: _activityId, revision: _revision, createdAt: _createdAt, ...draft } = activity.latestRevision
      setActivityDraft(draft)
      setEditingActivityId(activity.id)
    } else {
      setActivityDraft(blankActivity)
      setEditingActivityId(null)
    }
    activityModal.open()
  }

  function openProfile(profile?: LocalTaxpayerProfile) {
    if (profile) {
      const { id: _id, taxpayerProfileId: _taxpayerProfileId, revision: _revision, createdAt: _createdAt, ...draft } = profile.latestRevision
      setProfileDraft(draft)
      setEditingProfileId(profile.id)
    } else {
      setProfileDraft(blankProfile)
      setEditingProfileId(null)
    }
    setProfileStep(0)
    setProfileStepError(null)
    profileModal.open()
  }

  function advanceProfileStep() {
    const parsed = TaxpayerProfileRevisionDataSchema.safeParse(profileDraft)
    if (!parsed.success) {
      setProfileStepError(parsed.error.issues[0]?.message ?? 'Revisa los datos del perfil.')
      return
    }
    setProfileStepError(null)
    setProfileStep(1)
  }

  async function saveActivity() {
    const parsed = EconomicActivityRevisionInputSchema.safeParse(activityDraft)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa la actividad.')
    setSaving(true)
    try {
      if (editingActivityId) await client.reviseActivity(editingActivityId, parsed.data)
      else await client.createActivity(parsed.data)
      activityModal.close()
      await refresh()
    } catch { setError('No se pudo guardar la actividad económica local.') }
    finally { setSaving(false) }
  }

  async function saveProfile() {
    const parsed = TaxpayerProfileRevisionInputSchema.safeParse(profileDraft)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa el perfil.')
    setSaving(true)
    try {
      if (editingProfileId) await client.reviseProfile(editingProfileId, parsed.data)
      else await client.createProfile(parsed.data)
      profileModal.close()
      await refresh()
    } catch { setError('No se pudo guardar el perfil tributario local.') }
    finally { setSaving(false) }
  }

  return <Stack gap="xl">
    <Group justify="space-between" align="end">
      <div>
        <Title order={1}>Perfiles y actividades</Title>
        <Text c="dimmed">Describe tu realidad tributaria. Cada edición crea una revisión local.</Text>
      </div>
    </Group>
    {error && <Alert color="red" title="Biblioteca local no disponible">{error}<Group mt="sm"><Button variant="light" onClick={() => void refresh()}>Reintentar</Button></Group></Alert>}

    <section aria-labelledby="local-activities-heading">
      <Group justify="space-between" mb="md">
        <div><Title id="local-activities-heading" order={2}>Actividades económicas</Title><Text c="dimmed" size="sm">Las revisiones no cambian análisis anteriores.</Text></div>
        <Button leftSection={<Plus size={18} />} onClick={() => openActivity()}>Nueva actividad</Button>
      </Group>
      {loading ? <Text c="dimmed">Cargando actividades locales…</Text> : activities.length === 0 ? <EmptyState title="No hay actividades locales" description="Agrega una actividad si este equipo analiza gastos vinculados a un RUC." /> :
        <SimpleGrid cols={{ base: 1, sm: 2 }}>{activities.map((activity) => <Card key={activity.id} withBorder>
          <Group justify="space-between" align="start"><div><Text fw={600}>{activity.latestRevision.displayName}</Text><Text c="dimmed" size="sm">{activity.latestRevision.registeredActivityName || 'Sin nombre registrado'}</Text></div><Badge variant="light">Rev. {activity.latestRevision.revision}</Badge></Group>
          <Text c="dimmed" lineClamp={2} mt="sm" size="sm">{activity.latestRevision.activityDescription}</Text>
          <Group mt="md" justify="flex-end"><Button variant="subtle" leftSection={<FilePenLine size={16} />} onClick={() => openActivity(activity)}>Nueva revisión</Button></Group>
        </Card>)}</SimpleGrid>}
    </section>

    <section aria-labelledby="local-profiles-heading">
      <Group justify="space-between" mb="md">
        <div><Title id="local-profiles-heading" order={2}>Perfiles tributarios</Title><Text c="dimmed" size="sm">Los perfiles vinculan las revisiones actuales de tus actividades.</Text></div>
        <Button leftSection={<Plus size={18} />} onClick={() => openProfile()}>Nuevo perfil</Button>
      </Group>
      {loading ? <Text c="dimmed">Cargando perfiles locales…</Text> : profiles.length === 0 ? <EmptyState title="No hay perfiles locales" description="Crea un perfil para conservar tu contexto tributario local." /> :
        <SimpleGrid cols={{ base: 1, sm: 2 }}>{profiles.map((profile) => <Card key={profile.id} withBorder>
          <Group justify="space-between" align="start"><div><Text fw={600}>{profile.latestRevision.displayName}</Text><Text c="dimmed" size="sm">{profile.latestRevision.hasRuc ? profile.latestRevision.taxRegime : 'Sin RUC'}</Text></div><Badge variant="light">Rev. {profile.latestRevision.revision}</Badge></Group>
          <Text c="dimmed" mt="sm" size="sm">Actividades: {profile.latestRevision.activityRevisionIds.map((id) => activities.find((activity) => activity.latestRevision.id === id)?.latestRevision.displayName).filter(Boolean).join(', ') || 'Sin actividades vinculadas'}</Text>
          <Group mt="md" justify="flex-end"><Button variant="subtle" leftSection={<FilePenLine size={16} />} onClick={() => openProfile(profile)}>Nueva revisión</Button></Group>
        </Card>)}</SimpleGrid>}
    </section>

    <Modal fullScreen={isMobile} opened={activityOpened} onClose={activityModal.close} title={editingActivityId ? 'Nueva revisión de actividad' : 'Nueva actividad económica'} size="lg">
      <Stack>
        <TextInput label={<FieldHelpLabel label="Nombre de actividad" hint="Un nombre para reconocer esta actividad." />} value={activityDraft.displayName} onChange={(event) => setActivityDraft((current) => ({ ...current, displayName: event.currentTarget.value }))} />
        <TextInput label="Nombre de actividad registrada" value={activityDraft.registeredActivityName} onChange={(event) => setActivityDraft((current) => ({ ...current, registeredActivityName: event.currentTarget.value }))} />
        <TextInput label="Código registrado (opcional)" value={activityDraft.registeredActivityCode} onChange={(event) => setActivityDraft((current) => ({ ...current, registeredActivityCode: event.currentTarget.value }))} />
        <Textarea label="¿En qué consiste esta actividad?" value={activityDraft.activityDescription} onChange={(event) => setActivityDraft((current) => ({ ...current, activityDescription: event.currentTarget.value }))} />
        <Select label="Tratamiento de ingresos/IVA" data={[['taxed_nonzero','Gravada con IVA'],['zero_with_credit','Tarifa 0% con crédito'],['zero_without_credit','Tarifa 0% sin crédito'],['mixed','Uso mixto'],['export','Exportación'],['unknown','Aún no lo sé'],['other','Otro']].map(([value,label]) => ({value,label}))} value={activityDraft.revenueVatTreatment} onChange={(value) => setActivityDraft((current) => ({ ...current, revenueVatTreatment: (value ?? 'unknown') as EconomicActivityRevisionInput['revenueVatTreatment'] }))} />
        {activityDraft.revenueVatTreatment === 'other' && <Textarea label="Describe el tratamiento" value={activityDraft.revenueVatTreatmentOther} onChange={(event) => setActivityDraft((current) => ({ ...current, revenueVatTreatmentOther: event.currentTarget.value }))} />}
        {activityDraft.revenueVatTreatment === 'mixed' && <Textarea label="Explica el uso mixto (opcional)" value={activityDraft.mixedUseDescription} onChange={(event) => setActivityDraft((current) => ({ ...current, mixedUseDescription: event.currentTarget.value }))} />}
        <Textarea label="Compras o gastos necesarios (opcional)" value={activityDraft.necessaryPurchases} onChange={(event) => setActivityDraft((current) => ({ ...current, necessaryPurchases: event.currentTarget.value }))} />
        <Textarea label="Datos adicionales (opcional)" value={activityDraft.additionalFacts} onChange={(event) => setActivityDraft((current) => ({ ...current, additionalFacts: event.currentTarget.value }))} />
        <Group justify="flex-end"><Button variant="default" onClick={activityModal.close}>Cancelar</Button><Button loading={saving} onClick={() => void saveActivity()}>{editingActivityId ? 'Guardar revisión' : 'Agregar actividad'}</Button></Group>
      </Stack>
    </Modal>

    <Modal fullScreen={isMobile} opened={profileOpened} onClose={profileModal.close} title={editingProfileId ? 'Nueva revisión de perfil' : 'Nuevo perfil tributario'} size="lg">
      {profileStepError && <Alert color="red" mb="md" title="Revisa el perfil">{profileStepError}</Alert>}
      <Stepper active={profileStep} onStepClick={setProfileStep} allowNextStepsSelect={false}>
        <Stepper.Step label="Identidad"><Stack mt="md">
          <TextInput label={<FieldHelpLabel label="Nombre del perfil" hint="Un nombre para reconocer esta configuración." />} value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.currentTarget.value }))} />
          <Switch checked={profileDraft.hasEmploymentIncome} label="También tengo ingresos en relación de dependencia" onChange={(event) => setProfileDraft((current) => ({ ...current, hasEmploymentIncome: event.currentTarget.checked }))} />
          <Switch checked={profileDraft.hasRuc} label="Tengo RUC" onChange={(event) => setProfileDraft((current) => ({ ...current, hasRuc: event.currentTarget.checked, vatFilingFrequency: event.currentTarget.checked ? current.vatFilingFrequency : 'none', activityRevisionIds: event.currentTarget.checked ? current.activityRevisionIds : [] }))} />
          <TextInput label="Cédula (opcional)" maxLength={10} value={profileDraft.personalIdNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, personalIdNumber: event.currentTarget.value }))} />
        </Stack></Stepper.Step>
        <Stepper.Step label="Régimen y actividades"><Stack mt="md">
          <TextInput disabled={!profileDraft.hasRuc} label="RUC (opcional)" maxLength={13} value={profileDraft.professionalIdNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, professionalIdNumber: event.currentTarget.value }))} />
          <Select disabled={!profileDraft.hasRuc} label="Régimen tributario" data={[['general','General'],['rimpe_entrepreneur','RIMPE emprendedor'],['rimpe_popular_business','RIMPE negocio popular'],['unknown','Aún no lo sé']].map(([value,label]) => ({value,label}))} value={profileDraft.taxRegime} onChange={(value) => setProfileDraft((current) => ({ ...current, taxRegime: (value ?? 'unknown') as TaxpayerProfileRevisionInput['taxRegime'] }))} />
          <Select disabled={!profileDraft.hasRuc} label="Periodicidad de IVA" data={[['none','Sin obligación de IVA'],['monthly','Mensual'],['semiannual','Semestral'],['unknown','Aún no lo sé']].map(([value,label]) => ({value,label}))} value={profileDraft.vatFilingFrequency} onChange={(value) => setProfileDraft((current) => ({ ...current, vatFilingFrequency: (value ?? 'none') as TaxpayerProfileRevisionInput['vatFilingFrequency'] }))} />
          <MultiSelect disabled={!profileDraft.hasRuc} data={activities.map((activity) => ({ value: activity.latestRevision.id, label: activity.latestRevision.displayName }))} label="Actividades" value={profileDraft.activityRevisionIds} onChange={(activityRevisionIds) => setProfileDraft((current) => ({ ...current, activityRevisionIds }))} />
          <Textarea label="Datos adicionales (opcional)" value={profileDraft.additionalFacts} onChange={(event) => setProfileDraft((current) => ({ ...current, additionalFacts: event.currentTarget.value }))} />
        </Stack></Stepper.Step>
        <Stepper.Completed><Text mt="md">Revisa los datos y guarda una nueva revisión local.</Text></Stepper.Completed>
      </Stepper>
      <Group justify="space-between" mt="xl"><Button variant="default" onClick={profileModal.close}>Cancelar</Button><Group>{profileStep > 0 && <Button variant="subtle" onClick={() => setProfileStep((step) => step - 1)}>Atrás</Button>}{profileStep < 1 ? <Button onClick={advanceProfileStep}>Continuar</Button> : <Button loading={saving} onClick={() => void saveProfile()}>{editingProfileId ? 'Guardar revisión' : 'Agregar perfil'}</Button>}</Group></Group>
    </Modal>
  </Stack>
}
