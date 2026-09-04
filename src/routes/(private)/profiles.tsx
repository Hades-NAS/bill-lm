import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { FilePenLine, Plus } from 'lucide-react'
import React from 'react'

import {
  EconomicActivityRevisionInputSchema,
  TaxpayerProfileRevisionInputSchema,
} from '#/schema/tax-analysis-v2'

import { useTRPC } from '#/integrations/trpc/react'

import { useIsMobile } from '#/utils/mobile'

import { EmptyState } from '#/components/shared/empty-state'

import type {
  EconomicActivityRevisionInput,
  TaxpayerProfileRevisionInput,
} from '#/schema/tax-analysis-v2'

export const Route = createFileRoute('/(private)/profiles')({
  component: ProfilesPage,
})

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

function ProfilesPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const activities = useQuery(trpc.taxpayerProfiles.listActivities.queryOptions())
  const profiles = useQuery(trpc.taxpayerProfiles.listProfiles.queryOptions())
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.taxpayerProfiles.listActivities.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.taxpayerProfiles.listProfiles.queryKey(),
      }),
    ])
  const createActivity = useMutation(
    trpc.taxpayerProfiles.createActivity.mutationOptions({ onSuccess: invalidate }),
  )
  const reviseActivity = useMutation(
    trpc.taxpayerProfiles.reviseActivity.mutationOptions({ onSuccess: invalidate }),
  )
  const createProfile = useMutation(
    trpc.taxpayerProfiles.createProfile.mutationOptions({ onSuccess: invalidate }),
  )
  const reviseProfile = useMutation(
    trpc.taxpayerProfiles.reviseProfile.mutationOptions({ onSuccess: invalidate }),
  )
  const [activityId, setActivityId] = React.useState<string | null>(null)
  const [profileId, setProfileId] = React.useState<string | null>(null)
  const mutationError = [
    createActivity.error,
    reviseActivity.error,
    createProfile.error,
    reviseProfile.error,
  ].find((error) => error != null)

  const activityOptions = (activities.data ?? []).flatMap((activity) => {
    const revision = activity.revisions[0]
    return revision
      ? [{ value: revision.id, label: `${revision.displayName} · rev. ${revision.revision}` }]
      : []
  })
  const activity = activities.data?.find((item) => item.id === activityId)
  const profile = profiles.data?.find((item) => item.id === profileId)

  return (
    <Box py={40}>
      <Container size="lg">
        <Stack gap={28}>
          <div>
            <Title order={1}>Perfiles y actividades</Title>
            <Text c="dimmed" mt={6}>
              Describe tu realidad de negocio. Cada cambio crea una revisión para
              conservar el contexto de análisis anterior.
            </Text>
          </div>

          {(activities.isError || profiles.isError) && (
            <Alert color="red" title="No pudimos cargar esta configuración">
              {activities.error?.message ?? profiles.error?.message}
            </Alert>
          )}
          {mutationError && (
            <Alert color="red" title="No pudimos guardar la revisión">
              {mutationError.message}
            </Alert>
          )}

          <section>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={2}>Actividades económicas</Title>
                <Text c="dimmed" size="sm">
                  Son actividades que declaras; no es un catálogo oficial.
                </Text>
              </div>
              <Button leftSection={<Plus size={18} />} onClick={() => setActivityId('new')}>
                Agregar actividad
              </Button>
            </Group>
            {activities.isPending ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Skeleton height={150} />
                <Skeleton height={150} />
              </SimpleGrid>
            ) : activities.data?.length ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {activities.data.map((item) => {
                  const revision = item.revisions[0]
                  if (!revision) return null
                  return (
                    <Card key={item.id} padding="lg" withBorder>
                      <Stack gap="sm">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={700}>{revision.displayName}</Text>
                            <Text c="dimmed" size="sm">
                              {revision.registeredActivityName}
                            </Text>
                          </div>
                          <Badge variant="light">Rev. {revision.revision}</Badge>
                        </Group>
                        <Text lineClamp={2} size="sm">
                          {revision.activityDescription}
                        </Text>
                        <Button
                          leftSection={<FilePenLine size={16} />}
                          size="xs"
                          variant="light"
                          onClick={() => setActivityId(item.id)}
                        >
                          Crear nueva revisión
                        </Button>
                      </Stack>
                    </Card>
                  )
                })}
              </SimpleGrid>
            ) : (
              <EmptyState
                action={<Button onClick={() => setActivityId('new')}>Agregar actividad</Button>}
                description="Empieza con la actividad que mejor describe cómo generas ingresos."
                title="Aún no tienes actividades"
              />
            )}
          </section>

          <section>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={2}>Perfiles tributarios</Title>
                <Text c="dimmed" size="sm">
                  Un perfil agrupa identificadores y las revisiones de actividades que usarás.
                </Text>
              </div>
              <Button
                disabled={activityOptions.length === 0}
                leftSection={<Plus size={18} />}
                onClick={() => setProfileId('new')}
              >
                Agregar perfil
              </Button>
            </Group>
            {profiles.isPending ? (
              <Skeleton height={130} />
            ) : profiles.data?.length ? (
              <Stack gap="sm">
                {profiles.data.map((item) => {
                  const revision = item.revisions[0]
                  if (!revision) return null
                  return (
                    <Card key={item.id} padding="lg" withBorder>
                      <Group align="flex-start" justify="space-between">
                        <div>
                          <Group gap="xs">
                            <Text fw={700}>{revision.displayName}</Text>
                            <Badge variant="light">Rev. {revision.revision}</Badge>
                          </Group>
                          <Text c="dimmed" mt={4} size="sm">
                            {revision.activities.map(({ economicActivityRevision }) => economicActivityRevision.displayName).join(', ')}
                          </Text>
                        </div>
                        <Button size="xs" variant="light" onClick={() => setProfileId(item.id)}>
                          Crear nueva revisión
                        </Button>
                      </Group>
                    </Card>
                  )
                })}
              </Stack>
            ) : (
              <EmptyState
                action={activityOptions.length ? <Button onClick={() => setProfileId('new')}>Agregar perfil</Button> : undefined}
                description={
                  activityOptions.length
                    ? 'Crea un perfil y selecciona las actividades que correspondan.'
                    : 'Agrega primero al menos una actividad económica.'
                }
                title="Aún no tienes perfiles"
              />
            )}
          </section>
        </Stack>
      </Container>

      <ActivityModal
        activity={activity}
        fullScreen={isMobile}
        loading={createActivity.isPending || reviseActivity.isPending}
        opened={activityId !== null}
        onClose={() => setActivityId(null)}
        onSubmit={(value) => {
          if (activityId && activityId !== 'new') reviseActivity.mutate({ id: activityId, ...value }, { onSuccess: () => setActivityId(null) })
          else createActivity.mutate(value, { onSuccess: () => setActivityId(null) })
        }}
      />
      <ProfileModal
        activityOptions={activityOptions}
        fullScreen={isMobile}
        loading={createProfile.isPending || reviseProfile.isPending}
        opened={profileId !== null}
        profile={profile}
        onClose={() => setProfileId(null)}
        onSubmit={(value) => {
          if (profileId && profileId !== 'new') reviseProfile.mutate({ id: profileId, ...value }, { onSuccess: () => setProfileId(null) })
          else createProfile.mutate(value, { onSuccess: () => setProfileId(null) })
        }}
      />
    </Box>
  )
}

function ActivityModal({
  activity,
  fullScreen,
  loading,
  opened,
  onClose,
  onSubmit,
}: {
  activity?: {
    revisions: Array<{
      displayName: string
      registeredActivityCode: string | null
      registeredActivityName: string
      activityDescription: string
      necessaryPurchases: string | null
      revenueVatTreatment: string
      revenueVatTreatmentOther: string | null
      mixedUseDescription: string | null
      additionalFacts: string | null
    }>
  }
  fullScreen: boolean
  loading: boolean
  opened: boolean
  onClose: () => void
  onSubmit: (value: EconomicActivityRevisionInput) => void
}) {
  const [value, setValue] = React.useState(blankActivity)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    const revision = activity?.revisions[0]
    setValue(
      revision
        ? {
            ...blankActivity,
            ...revision,
            registeredActivityCode: revision.registeredActivityCode ?? '',
            necessaryPurchases: revision.necessaryPurchases ?? '',
            revenueVatTreatment: revision.revenueVatTreatment as EconomicActivityRevisionInput['revenueVatTreatment'],
            revenueVatTreatmentOther: revision.revenueVatTreatmentOther ?? '',
            mixedUseDescription: revision.mixedUseDescription ?? '',
            additionalFacts: revision.additionalFacts ?? '',
          }
        : blankActivity,
    )
    setError(null)
  }, [activity, opened])
  const update = <K extends keyof EconomicActivityRevisionInput>(key: K, next: EconomicActivityRevisionInput[K]) => setValue((current) => ({ ...current, [key]: next }))
  return (
    <Modal centered fullScreen={fullScreen} opened={opened} size="lg" title={activity ? 'Nueva revisión de actividad' : 'Agregar actividad'} onClose={onClose}>
      <Stack gap="sm">
        <Text size="sm">No modificaremos la revisión anterior; esta versión se usará en configuraciones nuevas.</Text>
        <TextInput label="Nombre para reconocerla" value={value.displayName} onChange={(event) => update('displayName', event.currentTarget.value)} />
        <TextInput label="Nombre de actividad registrada" value={value.registeredActivityName} onChange={(event) => update('registeredActivityName', event.currentTarget.value)} />
        <TextInput label="Código registrado (opcional)" value={value.registeredActivityCode} onChange={(event) => update('registeredActivityCode', event.currentTarget.value)} />
        <Textarea autosize label="¿En qué consiste esta actividad?" minRows={3} value={value.activityDescription} onChange={(event) => update('activityDescription', event.currentTarget.value)} />
        <Textarea autosize label="Compras o gastos necesarios (opcional)" minRows={2} value={value.necessaryPurchases} onChange={(event) => update('necessaryPurchases', event.currentTarget.value)} />
        <Select data={[{ value: 'taxed_nonzero', label: 'Gravada con IVA' }, { value: 'zero_with_credit', label: 'Tarifa 0% con crédito' }, { value: 'zero_without_credit', label: 'Tarifa 0% sin crédito' }, { value: 'mixed', label: 'Uso mixto' }, { value: 'export', label: 'Exportación' }, { value: 'unknown', label: 'Aún no lo sé' }, { value: 'other', label: 'Otro' }]} label="Tratamiento de ingresos/IVA" value={value.revenueVatTreatment} onChange={(next) => update('revenueVatTreatment', (next ?? 'unknown') as EconomicActivityRevisionInput['revenueVatTreatment'])} />
        {value.revenueVatTreatment === 'other' && <Textarea label="Describe el tratamiento" value={value.revenueVatTreatmentOther} onChange={(event) => update('revenueVatTreatmentOther', event.currentTarget.value)} />}
        {value.revenueVatTreatment === 'mixed' && <Textarea label="Explica el uso mixto (opcional)" value={value.mixedUseDescription} onChange={(event) => update('mixedUseDescription', event.currentTarget.value)} />}
        <Textarea autosize label="Datos adicionales (opcional)" minRows={2} value={value.additionalFacts} onChange={(event) => update('additionalFacts', event.currentTarget.value)} />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>Cancelar</Button><Button loading={loading} onClick={() => { const parsed = EconomicActivityRevisionInputSchema.safeParse(value); if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los campos requeridos.'); onSubmit(parsed.data) }}>Guardar revisión</Button></Group>
      </Stack>
    </Modal>
  )
}

function ProfileModal({
  activityOptions,
  fullScreen,
  loading,
  opened,
  profile,
  onClose,
  onSubmit,
}: {
  activityOptions: { value: string; label: string }[]
  fullScreen: boolean
  loading: boolean
  opened: boolean
  profile?: {
    revisions: Array<{
      displayName: string
      personalIdNumber: string | null
      professionalIdNumber: string | null
      hasEmploymentIncome: boolean
      hasRuc: boolean
      taxRegime: string
      vatFilingFrequency: string
      additionalFacts: string | null
      activities: Array<{ economicActivityRevisionId: string }>
    }>
  }
  onClose: () => void
  onSubmit: (value: TaxpayerProfileRevisionInput) => void
}) {
  const [step, setStep] = React.useState(0)
  const [value, setValue] = React.useState(blankProfile)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    const revision = profile?.revisions[0]
    setValue(revision ? { ...blankProfile, ...revision, personalIdNumber: revision.personalIdNumber ?? '', professionalIdNumber: revision.professionalIdNumber ?? '', taxRegime: revision.taxRegime as TaxpayerProfileRevisionInput['taxRegime'], vatFilingFrequency: revision.vatFilingFrequency as TaxpayerProfileRevisionInput['vatFilingFrequency'], additionalFacts: revision.additionalFacts ?? '', activityRevisionIds: revision.activities.map((item) => item.economicActivityRevisionId) } : blankProfile)
    setStep(0)
    setError(null)
  }, [opened, profile])
  const next = () => {
    const parsed = TaxpayerProfileRevisionInputSchema.omit({ activityRevisionIds: true }).safeParse(value)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los datos del perfil.')
    setError(null); setStep(1)
  }
  return (
    <Modal centered fullScreen={fullScreen} opened={opened} size="md" title={profile ? 'Nueva revisión de perfil' : 'Agregar perfil'} onClose={onClose}>
      <Stack gap="md">
        <Stepper active={step} size="sm"><Stepper.Step label="Datos" /><Stepper.Step label="Actividades" /></Stepper>
        {step === 0 ? <Stack gap="sm"><TextInput label="Nombre del perfil" value={value.displayName} onChange={(event) => setValue((current) => ({ ...current, displayName: event.currentTarget.value }))} /><Switch checked={value.hasEmploymentIncome} label="También tengo ingresos en relación de dependencia" onChange={(event) => setValue((current) => ({ ...current, hasEmploymentIncome: event.currentTarget.checked }))} /><Switch checked={value.hasRuc} label="Tengo RUC" onChange={(event) => setValue((current) => ({ ...current, hasRuc: event.currentTarget.checked, vatFilingFrequency: event.currentTarget.checked ? current.vatFilingFrequency : 'none' }))} /><TextInput label="Cédula (opcional)" maxLength={10} value={value.personalIdNumber} onChange={(event) => setValue((current) => ({ ...current, personalIdNumber: event.currentTarget.value }))} /><TextInput disabled={!value.hasRuc} label="RUC (opcional)" maxLength={13} value={value.professionalIdNumber} onChange={(event) => setValue((current) => ({ ...current, professionalIdNumber: event.currentTarget.value }))} /><Select data={[{ value: 'general', label: 'General' }, { value: 'rimpe_entrepreneur', label: 'RIMPE emprendedor' }, { value: 'rimpe_popular_business', label: 'RIMPE negocio popular' }, { value: 'unknown', label: 'Aún no lo sé' }]} disabled={!value.hasRuc} label="Régimen tributario" value={value.taxRegime} onChange={(next) => setValue((current) => ({ ...current, taxRegime: (next ?? 'unknown') as TaxpayerProfileRevisionInput['taxRegime'] }))} /><Select data={[{ value: 'none', label: 'Sin obligación de IVA' }, { value: 'monthly', label: 'Mensual' }, { value: 'semiannual', label: 'Semestral' }, { value: 'unknown', label: 'Aún no lo sé' }]} disabled={!value.hasRuc} label="Periodicidad de IVA" value={value.vatFilingFrequency} onChange={(next) => setValue((current) => ({ ...current, vatFilingFrequency: (next ?? 'none') as TaxpayerProfileRevisionInput['vatFilingFrequency'] }))} /><Textarea label="Datos adicionales (opcional)" value={value.additionalFacts} onChange={(event) => setValue((current) => ({ ...current, additionalFacts: event.currentTarget.value }))} /></Stack> : <Stack gap="sm"><Text size="sm">Selecciona actividades solo si este perfil tiene RUC. Para gastos personales no serán necesarias.</Text><MultiSelect disabled={!value.hasRuc} data={activityOptions} label="Actividades" value={value.activityRevisionIds} onChange={(next) => setValue((current) => ({ ...current, activityRevisionIds: next }))} /></Stack>}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="space-between"><Button variant="default" onClick={step ? () => setStep(0) : onClose}>{step ? 'Atrás' : 'Cancelar'}</Button>{step === 0 ? <Button onClick={next}>Continuar</Button> : <Button loading={loading} onClick={() => { const parsed = TaxpayerProfileRevisionInputSchema.safeParse(value); if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa las actividades seleccionadas.'); onSubmit(parsed.data) }}>Guardar revisión</Button>}</Group>
      </Stack>
    </Modal>
  )
}
