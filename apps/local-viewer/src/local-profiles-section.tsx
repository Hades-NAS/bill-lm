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
  Skeleton,
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

import {
  ContextGuideButton,
  EmptyState,
  FieldHelpLabel,
  RevisionRow,
  SectionDivider,
} from '@bill-lm/ui'
import {
  EconomicActivityRevisionInputSchema,
  TaxpayerProfileRevisionDataSchema,
  TaxpayerProfileRevisionInputSchema,
} from '@bill-lm/contracts'

import type {
  EconomicActivityRevisionInput,
  TaxpayerProfileRevisionInput,
} from '@bill-lm/contracts'
import type {
  LocalDaemonClient,
  LocalEconomicActivity,
  LocalTaxpayerProfile,
} from './api'

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

const taxRegimeLabel: Record<
  TaxpayerProfileRevisionInput['taxRegime'],
  string
> = {
  general: 'General',
  rimpe_entrepreneur: 'RIMPE emprendedor',
  rimpe_popular_business: 'RIMPE negocio popular',
  unknown: 'Régimen sin definir',
}

type Props = { client: LocalDaemonClient }

export function LocalProfilesSection({ client }: Props) {
  const [activities, setActivities] = useState<LocalEconomicActivity[]>([])
  const [profiles, setProfiles] = useState<LocalTaxpayerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [guide, setGuide] = useState<'activity' | 'profile' | null>(null)
  const [saving, setSaving] = useState(false)
  const [activityDraft, setActivityDraft] = useState(blankActivity)
  const [profileDraft, setProfileDraft] = useState(blankProfile)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(
    null,
  )
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [profileStep, setProfileStep] = useState(0)
  const [profileStepError, setProfileStepError] = useState<string | null>(null)
  const [activityOpened, activityModal] = useDisclosure(false)
  const [profileOpened, profileModal] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 48em)')

  async function refresh() {
    setLoading(true)
    setLoadError(null)
    try {
      const [nextActivities, nextProfiles] = await Promise.all([
        client.listActivities(),
        client.listProfiles(),
      ])
      setActivities(nextActivities)
      setProfiles(nextProfiles)
    } catch {
      setLoadError('No se pudieron cargar los perfiles y actividades locales.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function openActivity(activity?: LocalEconomicActivity) {
    setActivityError(null)
    if (activity) {
      const {
        id: _id,
        activityId: _activityId,
        revision: _revision,
        createdAt: _createdAt,
        ...draft
      } = activity.latestRevision
      setActivityDraft(draft)
      setEditingActivityId(activity.id)
    } else {
      setActivityDraft(blankActivity)
      setEditingActivityId(null)
    }
    activityModal.open()
  }

  function openProfile(profile?: LocalTaxpayerProfile) {
    setProfileError(null)
    if (profile) {
      const {
        id: _id,
        taxpayerProfileId: _taxpayerProfileId,
        revision: _revision,
        createdAt: _createdAt,
        ...draft
      } = profile.latestRevision
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
      setProfileStepError(
        parsed.error.issues[0]?.message ?? 'Revisa los datos del perfil.',
      )
      return
    }
    setProfileStepError(null)
    setProfileStep(1)
  }

  async function saveActivity() {
    const parsed = EconomicActivityRevisionInputSchema.safeParse(activityDraft)
    if (!parsed.success)
      return setActivityError(
        parsed.error.issues[0]?.message ?? 'Revisa la actividad.',
      )
    setSaving(true)
    setActivityError(null)
    try {
      if (editingActivityId)
        await client.reviseActivity(editingActivityId, parsed.data)
      else await client.createActivity(parsed.data)
      activityModal.close()
      await refresh()
    } catch {
      setActivityError('No se pudo guardar la actividad económica local.')
    } finally {
      setSaving(false)
    }
  }

  async function saveProfile() {
    const parsed = TaxpayerProfileRevisionInputSchema.safeParse(profileDraft)
    if (!parsed.success)
      return setProfileError(
        parsed.error.issues[0]?.message ?? 'Revisa el perfil.',
      )
    setSaving(true)
    setProfileError(null)
    try {
      if (editingProfileId)
        await client.reviseProfile(editingProfileId, parsed.data)
      else await client.createProfile(parsed.data)
      profileModal.close()
      await refresh()
    } catch {
      setProfileError('No se pudo guardar el perfil tributario local.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="end">
        <div>
          <Title order={1}>Perfiles y actividades</Title>
          <Text c="dimmed">
            Describe tu realidad tributaria. Cada edición crea una revisión
            local.
          </Text>
        </div>
      </Group>
      {loadError && (
        <Alert color="red" title="No pudimos cargar esta configuración">
          {loadError}
          <Group mt="sm">
            <Button variant="light" onClick={() => void refresh()}>
              Reintentar
            </Button>
          </Group>
        </Alert>
      )}
      <section aria-labelledby="local-activities-heading">
        <Group justify="space-between" mb="md">
          <div>
            <Group gap="xs">
              <Title id="local-activities-heading" order={2}>
                Actividades económicas
              </Title>
              <ContextGuideButton
                title="actividades económicas"
                onClick={() => setGuide('activity')}
              />
            </Group>
            <Text c="dimmed" size="sm">
              Son actividades que declaras; no es un catálogo oficial.
            </Text>
          </div>
          <Button
            leftSection={<Plus size={18} />}
            onClick={() => openActivity()}
          >
            Agregar actividad
          </Button>
        </Group>
        {loading ? (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Skeleton height={150} />
            <Skeleton height={150} />
          </SimpleGrid>
        ) : activities.length === 0 ? (
          <EmptyState
            title="Aún no tienes actividades"
            description="Empieza con la actividad que mejor describe cómo generas ingresos."
            action={
              <Button onClick={() => openActivity()}>Agregar actividad</Button>
            }
          />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {activities.map((activity) => (
              <Card key={activity.id} withBorder>
                <Group justify="space-between" align="start">
                  <div>
                    <Text fw={600}>{activity.latestRevision.displayName}</Text>
                    <Text c="dimmed" size="sm">
                      {activity.latestRevision.registeredActivityName ||
                        'Sin nombre registrado'}
                    </Text>
                  </div>
                  <Badge variant="light">
                    Rev. {activity.latestRevision.revision}
                  </Badge>
                </Group>
                <Text c="dimmed" mt="sm" size="sm">
                  {activity.latestRevision.activityDescription}
                </Text>
                <Group mt="md" justify="flex-end">
                  <Button
                    leftSection={<FilePenLine size={16} />}
                    size="xs"
                    variant="light"
                    onClick={() => openActivity(activity)}
                  >
                    Crear nueva revisión
                  </Button>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </section>

      <SectionDivider />
      <section aria-labelledby="local-profiles-heading">
        <Group justify="space-between" mb="md">
          <div>
            <Group gap="xs">
              <Title id="local-profiles-heading" order={2}>
                Perfiles tributarios
              </Title>
              <ContextGuideButton
                title="perfiles tributarios"
                onClick={() => setGuide('profile')}
              />
            </Group>
            <Text c="dimmed" size="sm">
              Un perfil agrupa identificadores y las revisiones de actividades
              que usarás.
            </Text>
          </div>
          <Button
            leftSection={<Plus size={18} />}
            onClick={() => openProfile()}
          >
            Agregar perfil
          </Button>
        </Group>
        {loading ? (
          <Skeleton height={130} />
        ) : profiles.length === 0 ? (
          <EmptyState
            title="Aún no tienes perfiles"
            description="Crea un perfil para conservar tu contexto tributario local, incluso si todavía no tienes RUC o actividades."
            action={
              <Button onClick={() => openProfile()}>Agregar perfil</Button>
            }
          />
        ) : (
          <Stack>
            {profiles.map((profile) => (
              <RevisionRow
                action={
                  <Button
                    leftSection={<FilePenLine size={16} />}
                    size="xs"
                    variant="light"
                    onClick={() => openProfile(profile)}
                  >
                    Crear nueva revisión
                  </Button>
                }
                description={`Actividades: ${
                  profile.latestRevision.activityRevisionIds
                    .map((id) => {
                      const activity = activities.find(
                        (item) => item.latestRevision.id === id,
                      )
                      return activity
                        ? `${activity.latestRevision.displayName} (Rev. ${activity.latestRevision.revision})`
                        : null
                    })
                    .filter(Boolean)
                    .join(', ') || 'Sin actividades vinculadas'
                }`}
                key={profile.id}
                revision={profile.latestRevision.revision}
                title={`${profile.latestRevision.displayName} · ${profile.latestRevision.hasRuc ? taxRegimeLabel[profile.latestRevision.taxRegime] : 'Sin RUC'}`}
              />
            ))}
          </Stack>
        )}
      </section>

      <Modal
        centered
        closeButtonProps={{ 'aria-label': 'Cerrar actividad económica' }}
        fullScreen={isMobile}
        opened={activityOpened}
        onClose={activityModal.close}
        title={
          editingActivityId
            ? 'Nueva revisión de actividad'
            : 'Agregar actividad'
        }
        size="lg"
      >
        <Stack>
          <Text size="sm">
            No modificaremos la revisión anterior; esta versión se usará en
            configuraciones nuevas.
          </Text>
          {activityError && (
            <Alert color="red" title="No pudimos guardar la revisión">
              {activityError}
            </Alert>
          )}
          <TextInput
            label={
              <FieldHelpLabel
                label="Nombre de actividad"
                hint="Un nombre para reconocer esta actividad."
              />
            }
            value={activityDraft.displayName}
            onChange={(event) => {
              const displayName = event.currentTarget.value
              setActivityDraft((current) => ({ ...current, displayName }))
            }}
          />
          <TextInput
            label="Nombre de actividad registrada"
            value={activityDraft.registeredActivityName}
            onChange={(event) => {
              const registeredActivityName = event.currentTarget.value
              setActivityDraft((current) => ({
                ...current,
                registeredActivityName,
              }))
            }}
          />
          <TextInput
            label="Código registrado (opcional)"
            value={activityDraft.registeredActivityCode}
            onChange={(event) => {
              const registeredActivityCode = event.currentTarget.value
              setActivityDraft((current) => ({
                ...current,
                registeredActivityCode,
              }))
            }}
          />
          <Textarea
            autosize
            label={
              <FieldHelpLabel
                label="¿En qué consiste esta actividad?"
                hint="Describe los bienes o servicios y el contexto económico."
              />
            }
            minRows={3}
            value={activityDraft.activityDescription}
            onChange={(event) => {
              const activityDescription = event.currentTarget.value
              setActivityDraft((current) => ({
                ...current,
                activityDescription,
              }))
            }}
          />
          <Select
            label="Tratamiento de ingresos/IVA"
            data={[
              ['taxed_nonzero', 'Gravada con IVA'],
              ['zero_with_credit', 'Tarifa 0% con crédito'],
              ['zero_without_credit', 'Tarifa 0% sin crédito'],
              ['mixed', 'Uso mixto'],
              ['export', 'Exportación'],
              ['unknown', 'Aún no lo sé'],
              ['other', 'Otro'],
            ].map(([value, label]) => ({ value, label }))}
            value={activityDraft.revenueVatTreatment}
            onChange={(value) =>
              setActivityDraft((current) => ({
                ...current,
                revenueVatTreatment: (value ??
                  'unknown') as EconomicActivityRevisionInput['revenueVatTreatment'],
              }))
            }
          />
          {activityDraft.revenueVatTreatment === 'other' && (
            <Textarea
              autosize
              label="Describe el tratamiento"
              minRows={2}
              value={activityDraft.revenueVatTreatmentOther}
              onChange={(event) => {
                const revenueVatTreatmentOther = event.currentTarget.value
                setActivityDraft((current) => ({
                  ...current,
                  revenueVatTreatmentOther,
                }))
              }}
            />
          )}
          {activityDraft.revenueVatTreatment === 'mixed' && (
            <Textarea
              autosize
              label="Explica el uso mixto (opcional)"
              minRows={2}
              value={activityDraft.mixedUseDescription}
              onChange={(event) => {
                const mixedUseDescription = event.currentTarget.value
                setActivityDraft((current) => ({
                  ...current,
                  mixedUseDescription,
                }))
              }}
            />
          )}
          <Textarea
            autosize
            label="Compras o gastos necesarios (opcional)"
            minRows={2}
            value={activityDraft.necessaryPurchases}
            onChange={(event) => {
              const necessaryPurchases = event.currentTarget.value
              setActivityDraft((current) => ({
                ...current,
                necessaryPurchases,
              }))
            }}
          />
          <Textarea
            autosize
            label="Datos adicionales (opcional)"
            minRows={2}
            value={activityDraft.additionalFacts}
            onChange={(event) => {
              const additionalFacts = event.currentTarget.value
              setActivityDraft((current) => ({ ...current, additionalFacts }))
            }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={activityModal.close}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void saveActivity()}>
              {editingActivityId ? 'Guardar revisión' : 'Agregar actividad'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        centered
        closeButtonProps={{ 'aria-label': 'Cerrar perfil tributario' }}
        fullScreen={isMobile}
        opened={profileOpened}
        onClose={profileModal.close}
        title={
          editingProfileId
            ? 'Nueva revisión de perfil'
            : 'Nuevo perfil tributario'
        }
        size="lg"
      >
        {(profileStepError || profileError) && (
          <Alert color="red" mb="md" title="Revisa el perfil">
            {profileStepError ?? profileError}
          </Alert>
        )}
        <Text size="sm">
          No modificaremos la revisión anterior; esta versión se usará en
          configuraciones nuevas.
        </Text>
        <Stepper
          active={profileStep}
          onStepClick={setProfileStep}
          allowNextStepsSelect={false}
        >
          <Stepper.Step label="Datos">
            <Stack mt="md">
              <TextInput
                label={
                  <FieldHelpLabel
                    label="Nombre del perfil"
                    hint="Un nombre para reconocer esta configuración."
                  />
                }
                value={profileDraft.displayName}
                onChange={(event) => {
                  const displayName = event.currentTarget.value
                  setProfileDraft((current) => ({ ...current, displayName }))
                }}
              />
              <Switch
                checked={profileDraft.hasEmploymentIncome}
                label="También tengo ingresos en relación de dependencia"
                onChange={(event) => {
                  const hasEmploymentIncome = event.currentTarget.checked
                  setProfileDraft((current) => ({
                    ...current,
                    hasEmploymentIncome,
                  }))
                }}
              />
              <Switch
                checked={profileDraft.hasRuc}
                label="Tengo RUC"
                onChange={(event) => {
                  const hasRuc = event.currentTarget.checked
                  setProfileDraft((current) => ({
                    ...current,
                    hasRuc,
                    vatFilingFrequency: hasRuc
                      ? current.vatFilingFrequency
                      : 'none',
                    activityRevisionIds: hasRuc
                      ? current.activityRevisionIds
                      : [],
                  }))
                }}
              />
              <TextInput
                label="Cédula (opcional)"
                maxLength={10}
                value={profileDraft.personalIdNumber}
                onChange={(event) => {
                  const personalIdNumber = event.currentTarget.value
                  setProfileDraft((current) => ({
                    ...current,
                    personalIdNumber,
                  }))
                }}
              />
              <TextInput
                disabled={!profileDraft.hasRuc}
                label="RUC (opcional)"
                maxLength={13}
                value={profileDraft.professionalIdNumber}
                onChange={(event) => {
                  const professionalIdNumber = event.currentTarget.value
                  setProfileDraft((current) => ({
                    ...current,
                    professionalIdNumber,
                  }))
                }}
              />
              <Select
                disabled={!profileDraft.hasRuc}
                label="Régimen tributario"
                data={[
                  ['general', 'General'],
                  ['rimpe_entrepreneur', 'RIMPE emprendedor'],
                  ['rimpe_popular_business', 'RIMPE negocio popular'],
                  ['unknown', 'Aún no lo sé'],
                ].map(([value, label]) => ({ value, label }))}
                value={profileDraft.taxRegime}
                onChange={(value) =>
                  setProfileDraft((current) => ({
                    ...current,
                    taxRegime: (value ??
                      'unknown') as TaxpayerProfileRevisionInput['taxRegime'],
                  }))
                }
              />
              <Select
                disabled={!profileDraft.hasRuc}
                label="Periodicidad de IVA"
                data={[
                  ['none', 'Sin obligación de IVA'],
                  ['monthly', 'Mensual'],
                  ['semiannual', 'Semestral'],
                  ['unknown', 'Aún no lo sé'],
                ].map(([value, label]) => ({ value, label }))}
                value={profileDraft.vatFilingFrequency}
                onChange={(value) =>
                  setProfileDraft((current) => ({
                    ...current,
                    vatFilingFrequency: (value ??
                      'none') as TaxpayerProfileRevisionInput['vatFilingFrequency'],
                  }))
                }
              />
              <Textarea
                autosize
                label="Datos adicionales (opcional)"
                minRows={2}
                value={profileDraft.additionalFacts}
                onChange={(event) => {
                  const additionalFacts = event.currentTarget.value
                  setProfileDraft((current) => ({
                    ...current,
                    additionalFacts,
                  }))
                }}
              />
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="Actividades">
            <Stack mt="md">
              <MultiSelect
                disabled={!profileDraft.hasRuc}
                data={activities.map((activity) => ({
                  value: activity.latestRevision.id,
                  label: activity.latestRevision.displayName,
                }))}
                label="Actividades"
                value={profileDraft.activityRevisionIds}
                onChange={(activityRevisionIds) =>
                  setProfileDraft((current) => ({
                    ...current,
                    activityRevisionIds,
                  }))
                }
              />
            </Stack>
          </Stepper.Step>
          <Stepper.Completed>
            <Text mt="md">
              Revisa los datos y guarda una nueva revisión local.
            </Text>
          </Stepper.Completed>
        </Stepper>
        <Group justify="space-between" mt="xl">
          <Button variant="default" onClick={profileModal.close}>
            Cancelar
          </Button>
          <Group>
            {profileStep > 0 && (
              <Button
                variant="subtle"
                onClick={() => setProfileStep((step) => step - 1)}
              >
                Atrás
              </Button>
            )}
            {profileStep < 1 ? (
              <Button onClick={advanceProfileStep}>Continuar</Button>
            ) : (
              <Button loading={saving} onClick={() => void saveProfile()}>
                {editingProfileId ? 'Guardar revisión' : 'Agregar perfil'}
              </Button>
            )}
          </Group>
        </Group>
      </Modal>
      <Modal
        centered
        closeButtonProps={{ 'aria-label': 'Cerrar guía' }}
        opened={guide !== null}
        onClose={() => setGuide(null)}
        title={
          guide === 'activity'
            ? 'Guía de actividades económicas'
            : 'Guía del perfil tributario'
        }
      >
        {guide === 'activity' ? (
          <Stack>
            <Text>
              Describe las actividades que declaras y los gastos necesarios para
              realizarlas. No es un catálogo oficial.
            </Text>
            <Text size="sm" c="dimmed">
              Ejemplo: desarrollo de software, con equipos, conectividad y
              servicios necesarios para prestar el servicio.
            </Text>
          </Stack>
        ) : (
          <Stack>
            <Text>
              Un perfil reúne tus identificadores, régimen y revisiones de
              actividad para conservar el contexto de análisis.
            </Text>
            <Text size="sm" c="dimmed">
              En esta biblioteca local puedes crear un perfil aunque todavía no
              tengas RUC ni actividades vinculadas.
            </Text>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
