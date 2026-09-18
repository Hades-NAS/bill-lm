import {
  Title,
  Text,
  Stack,
  Box,
  Button,
  Group,
  Card,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Center,
  Skeleton,
  Checkbox,
  Flex,
  List,
  Modal,
  Alert,
  Select,
  MultiSelect,
  TextInput,
} from '@mantine/core'
import { useListState, useViewportSize } from '@mantine/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  Edit,
  EyeIcon,
  History,
  NotepadText,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

import { useTRPC } from '#/integrations/trpc/react'

import { getColorBillTargetType } from '#/utils/bill'
import { useIsMobile } from '#/utils/mobile'
import {
  isLoadingMutation,
  isLoadingOrRefetchQuery,
  isLoadingQuery,
} from '#/utils/query'

import { useModal } from '#/hooks/modal'
import { useDeleteBillsMutation } from '#/hooks/mutation/bill'
import { useAnalyzeCollectionMutation } from '#/hooks/mutation/collection'
import {
  useCheckCanAnalyzeCollectionQuery,
  useGetCollectionByIdQuery,
} from '#/hooks/query/collection'
import { billsKeys } from '#/hooks/query-keys'

import BillDetailPage from '#/components/bill/bill-detail'
import BillAddForm from '#/components/bill/form'
import { AnalysisHistoryDrawer } from '#/components/collection/analysis-history-drawer'
import CollectionForm from '#/components/collection/form'
import ConfModal from '#/components/shared/conf-modal'
import {
  ContextGuideButton,
  FieldHelpLabel,
  openContextGuide,
} from '#/components/shared/context-help'
import { EmptyState } from '#/components/shared/empty-state'
import Input from '#/components/shared/input'
import { NumberDisplay } from '#/components/shared/number-display'
import { QuickFilter } from '#/components/shared/quick-filter'

import type { FilterValue, FilterField } from '#/components/shared/quick-filter'
import type { LLMPreset } from '#/config/llm-config'
import type { CollectionBaseType } from '#/integrations/trpc/procedures/bills'
import type { AnalyzeCollectionRequest } from '#/schema/collections'

export const Route = createFileRoute('/(private)/collections/$id')({
  ssr: false,
  component: CollectionDetailPage,
})

const filterFields: Array<FilterField> = [
  {
    name: 'name',
    label: 'Nombre',
    type: 'text',
    placeholder: 'Buscar por nombre',
    clearable: true,
  },
]

function openAnalysisContextGuide() {
  openContextGuide({
    title: 'Guía del contexto de análisis',
    introduction:
      'El contexto indica cómo interpretar las facturas de esta colección. Cada cambio crea una revisión para preservar los análisis anteriores.',
    items: [
      {
        title: 'Propósito',
        description:
          'Define el tipo de análisis: IVA, impuesto a la renta de actividades económicas o gastos personales.',
      },
      {
        title: 'Período',
        description: 'Delimita las fechas que cubre esta revisión de contexto.',
        example: 'Del 1 al 30 de septiembre de 2026.',
      },
      {
        title: 'Perfil y actividades',
        description:
          'Selecciona la configuración tributaria vigente. Los gastos personales no usan actividades económicas.',
      },
      {
        title: 'Revisión',
        description:
          'Al guardar, el sistema conserva una versión nueva. Los resultados anteriores siguen vinculados a la versión que usaron.',
      },
    ],
  })
}

function openAnalysisHistoryGuide() {
  openContextGuide({
    title: 'Guía del historial de análisis',
    introduction:
      'Cada ejecución guarda el contexto, las facturas, la conexión y las referencias usadas en ese momento.',
    items: [
      {
        title: 'Ejecución bloqueada',
        description:
          'Aparece cuando falta configuración necesaria. El sistema no llama al modelo en ese caso.',
      },
      {
        title: 'Resultado',
        description:
          'Muestra cuántas facturas procesó la ejecución y el proveedor o modelo usado.',
      },
    ],
  })
}

function openInvoicesGuide() {
  openContextGuide({
    title: 'Guía de facturas',
    introduction:
      'Las facturas pertenecen a esta colección y se analizan con el contexto que configures para ella.',
    items: [
      {
        title: 'Carga',
        description:
          'Sube el XML original de cada comprobante electrónico. Puedes cargar hasta diez por vez.',
      },
      {
        title: 'Selección',
        description:
          'Selecciona una o más facturas para eliminarlas. La eliminación no modifica ejecuciones que ya terminaron.',
      },
      {
        title: 'Resultados',
        description:
          'Cada análisis conserva un resultado por factura junto con el contexto usado.',
      },
    ],
  })
}

function CollectionDetailPage() {
  const { id: collectionId } = Route.useParams()

  const [filter, setFilter] = React.useState<FilterValue>({
    field: 'name',
    type: 'text',
    value: '',
  })

  const [billModal, setBillModal] = useModal<string>(collectionId)

  const [preset, setPreset] = React.useState<LLMPreset>('strict')

  const [billDeleteModal, setBillDeleteModal] = React.useState(false)

  const [analyzeModal, setAnalyzeModal] = useModal<AnalyzeCollectionRequest>()

  const [billDetailModal, setBillDetailModal] = useModal<string>()

  const [modalCollectionForm, setCollectionForm] =
    useModal<CollectionBaseType>()

  const [selectedRows, handlerSelectRows] = useListState<string>([])

  const collectionQuery = useGetCollectionByIdQuery(collectionId)

  const userCanAnalyzeQuery = useCheckCanAnalyzeCollectionQuery()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const profilesQuery = useQuery(
    trpc.taxpayerProfiles.listProfiles.queryOptions(),
  )
  const contextRevisionsQuery = useQuery(
    trpc.collections.listContextRevisions.queryOptions({ id: collectionId }),
  )
  const createContextRevision = useMutation(
    trpc.collections.createContextRevision.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.collections.listContextRevisions.queryKey({
            id: collectionId,
          }),
        }),
    }),
  )
  const [contextModalOpened, setContextModalOpened] = React.useState(false)
  const [historyDrawerOpened, setHistoryDrawerOpened] = React.useState(false)
  const [purpose, setPurpose] = React.useState<
    'vat_credit' | 'business_income_tax' | 'personal_expenses'
  >('personal_expenses')
  const [profileRevisionId, setProfileRevisionId] = React.useState<
    string | null
  >(null)
  const [activityRevisionIds, setActivityRevisionIds] = React.useState<
    Array<string>
  >([])
  const [periodStartDate, setPeriodStartDate] = React.useState(
    `${collectionQuery.data?.year ?? DateTime.now().year}-01-01`,
  )
  const [periodEndDate, setPeriodEndDate] = React.useState(
    `${collectionQuery.data?.year ?? DateTime.now().year}-12-31`,
  )
  const connectionsQuery = useQuery(
    trpc.providerConnections.list.queryOptions(),
  )
  const [credentialId, setCredentialId] = React.useState<string | null>(null)
  const activeConnections =
    connectionsQuery.data?.filter((connection) => connection.isActive) ?? []
  const analysisConfigLoading = connectionsQuery.isPending
  const analysisConfigError = connectionsQuery.isError
  const analysisConfigReady =
    !analysisConfigLoading &&
    !analysisConfigError &&
    activeConnections.length > 0

  const profileOptions = React.useMemo(() => {
    const options = (profilesQuery.data ?? []).flatMap((profile) => {
      const revision = profile.revisions[0]
      if (!revision) return []

      return [
        {
          value: revision.id,
          label: `${revision.displayName} · rev. ${revision.revision}`,
          activityRevisionIds: revision.activities.map(
            ({ economicActivityRevision }) => economicActivityRevision.id,
          ),
          activities: revision.activities.map(
            ({ economicActivityRevision }) => ({
              value: economicActivityRevision.id,
              label: economicActivityRevision.displayName,
            }),
          ),
        },
      ]
    })
    const currentRevision = contextRevisionsQuery.data?.[0]
    if (
      currentRevision &&
      !options.some(
        (option) => option.value === currentRevision.taxpayerProfileRevisionId,
      )
    ) {
      options.push({
        value: currentRevision.taxpayerProfileRevisionId,
        label: `${currentRevision.taxpayerProfileRevision.displayName} · rev. ${currentRevision.taxpayerProfileRevision.revision}`,
        activityRevisionIds: currentRevision.activities.map(
          (activity) => activity.economicActivityRevisionId,
        ),
        activities: currentRevision.activities.map((activity) => ({
          value: activity.economicActivityRevisionId,
          label: activity.economicActivityRevision.displayName,
        })),
      })
    }
    return options
  }, [contextRevisionsQuery.data, profilesQuery.data])
  const selectedProfile = profileOptions.find(
    (profile) => profile.value === profileRevisionId,
  )

  React.useEffect(() => {
    if (!contextModalOpened) return

    const currentRevision = contextRevisionsQuery.data?.[0]
    if (currentRevision) {
      setPurpose(
        currentRevision.purpose as
          | 'vat_credit'
          | 'business_income_tax'
          | 'personal_expenses',
      )
      setProfileRevisionId(currentRevision.taxpayerProfileRevisionId)
      setActivityRevisionIds(
        currentRevision.activities.map(
          (activity) => activity.economicActivityRevisionId,
        ),
      )
      setPeriodStartDate(
        DateTime.fromJSDate(currentRevision.periodStartDate, {
          zone: 'utc',
        }).toISODate() ?? '',
      )
      setPeriodEndDate(
        DateTime.fromJSDate(currentRevision.periodEndDate, {
          zone: 'utc',
        }).toISODate() ?? '',
      )
      return
    }

    const year = collectionQuery.data?.year ?? DateTime.now().year
    setPurpose('personal_expenses')
    setProfileRevisionId(null)
    setActivityRevisionIds([])
    setPeriodStartDate(`${year}-01-01`)
    setPeriodEndDate(`${year}-12-31`)
  }, [
    collectionQuery.data?.year,
    contextModalOpened,
    contextRevisionsQuery.data,
  ])

  const analyzeCollectionMutation = useAnalyzeCollectionMutation()

  const billsCalcQuery = useQuery({
    enabled: !!collectionQuery.data,
    queryKey: billsKeys.calc(collectionId, collectionQuery.data?.bills || []),
    queryFn: () => {
      const total = collectionQuery.data?.bills.length ?? 0
      return {
        analyzed: 0,
        pending: total,
        fullAnalyzed: false,
        partialAnalyzed: false,
        notAnalyzed: total > 0,
      }
    },
  })

  const deleteBillsMutation = useDeleteBillsMutation({
    onSuccess: () => {
      handlerSelectRows.setState([])
      setBillDeleteModal(false)
    },
  })

  const isMobile = useIsMobile()

  const isLoading = isLoadingQuery(collectionQuery, userCanAnalyzeQuery)

  const isLoadingOrRefetch = isLoadingOrRefetchQuery(collectionQuery)

  const isLoadingDelete = isLoadingMutation(deleteBillsMutation)

  const isAnalyzing = isLoadingMutation(analyzeCollectionMutation)

  const { height } = useViewportSize()

  const rowsMemo = React.useMemo(
    () => renderRows(),
    [collectionQuery.data?.bills, selectedRows, filter],
  )
  const mobileBillsMemo = React.useMemo(
    () => renderMobileBills(),
    [collectionQuery.data?.bills, selectedRows, filter],
  )

  return (
    <React.Fragment>
      <BillDetailPage
        modal
        size="xl"
        state={billDetailModal}
        onClose={() => setBillDetailModal({ opened: false })}
      />

      <CollectionForm
        modal
        size="xl"
        state={modalCollectionForm}
        onClose={() => {
          setCollectionForm({ opened: false })
        }}
        onSubmitted={() => {
          setCollectionForm({ opened: false })
        }}
      />

      <AnalysisHistoryDrawer
        collectionId={collectionId}
        collectionName={collectionQuery.data?.name ?? 'Colección'}
        isMobile={isMobile}
        opened={historyDrawerOpened}
        onClose={() => setHistoryDrawerOpened(false)}
        onOpenGuide={openAnalysisHistoryGuide}
      />

      <Modal
        centered
        fullScreen={isMobile}
        opened={contextModalOpened}
        title={
          <Group gap="xs">
            <Text fw={600}>Configurar contexto de análisis</Text>
            <ContextGuideButton
              title="el contexto de análisis"
              onClick={openAnalysisContextGuide}
            />
          </Group>
        }
        onClose={() => setContextModalOpened(false)}
      >
        <Stack gap="sm">
          <Alert color="blue">
            El contexto se guarda como una nueva revisión; los análisis
            anteriores no cambian.
          </Alert>
          <Select
            data={[
              { value: 'vat_credit', label: 'Declaración de IVA' },
              {
                value: 'business_income_tax',
                label: 'IR: gastos de actividades económicas',
              },
              { value: 'personal_expenses', label: 'IR: gastos personales' },
            ]}
            label={
              <FieldHelpLabel
                hint="Define el tipo de cálculo que quieres preparar para esta colección."
                label="Propósito"
              />
            }
            value={purpose}
            onChange={(value) => {
              const next = (value ?? 'personal_expenses') as typeof purpose
              setPurpose(next)
              if (next === 'personal_expenses') setActivityRevisionIds([])
            }}
          />
          <TextInput
            label={
              <FieldHelpLabel
                hint="Indica la primera fecha que cubre esta revisión de contexto."
                label="Inicio del período"
              />
            }
            type="date"
            value={periodStartDate}
            onChange={(event) => setPeriodStartDate(event.currentTarget.value)}
          />
          <TextInput
            label={
              <FieldHelpLabel
                hint="Indica la última fecha que cubre esta revisión de contexto."
                label="Fin del período"
              />
            }
            type="date"
            value={periodEndDate}
            onChange={(event) => setPeriodEndDate(event.currentTarget.value)}
          />
          <Select
            data={profileOptions}
            label={
              <FieldHelpLabel
                hint="Elige el perfil tributario vigente para este análisis."
                label="Perfil tributario"
              />
            }
            value={profileRevisionId}
            onChange={(nextProfileRevisionId) => {
              setProfileRevisionId(nextProfileRevisionId)
              const nextProfile = profileOptions.find(
                (profile) => profile.value === nextProfileRevisionId,
              )
              setActivityRevisionIds(nextProfile?.activityRevisionIds ?? [])
            }}
          />
          <MultiSelect
            data={selectedProfile?.activities ?? []}
            disabled={purpose === 'personal_expenses' || !profileRevisionId}
            label={
              <FieldHelpLabel
                hint="Selecciona las actividades vinculadas al IVA o al impuesto a la renta de tu negocio."
                label="Actividades económicas"
              />
            }
            value={activityRevisionIds}
            onChange={setActivityRevisionIds}
          />
          {createContextRevision.error && (
            <Alert color="red">{createContextRevision.error.message}</Alert>
          )}
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              {contextRevisionsQuery.data?.[0]
                ? `Revisión actual: ${contextRevisionsQuery.data[0].revision}`
                : 'Aún no hay contexto.'}
            </Text>
            <Button
              disabled={!profileRevisionId}
              loading={createContextRevision.isPending}
              onClick={() => {
                if (!profileRevisionId) return
                createContextRevision.mutate(
                  {
                    collectionId,
                    purpose,
                    period: {
                      startDate: periodStartDate,
                      endDate: periodEndDate,
                    },
                    taxpayerProfileRevisionId: profileRevisionId,
                    activityRevisionIds,
                  },
                  { onSuccess: () => setContextModalOpened(false) },
                )
              }}
            >
              Guardar contexto
            </Button>
          </Group>
        </Stack>
      </Modal>

      <BillAddForm
        modal
        size="xl"
        state={{
          opened: billModal.opened,
          data: {
            collectionId: billModal.data || '',
          },
        }}
        onClose={() => {
          setBillModal({ opened: false })
        }}
        onSubmitted={() => {
          setBillModal({ opened: false })
        }}
      />

      <ConfModal
        loading={isLoadingDelete}
        opened={billDeleteModal}
        title={
          selectedRows.length === 1 ? 'Eliminar factura' : 'Eliminar facturas'
        }
        onCancel={() => setBillDeleteModal(false)}
        onConfirm={() => {
          deleteBillsMutation.mutate({ collectionId, billIds: selectedRows })
        }}
      >
        {selectedRows.length === 1 && (
          <Box>
            <Text>¿Estás seguro de que deseas eliminar esta factura?</Text>
            <List withPadding mt={16} size="sm" spacing="xs" type="ordered">
              <List.Item>
                <Text>{getBillName(selectedRows[0])}</Text>
              </List.Item>
            </List>
          </Box>
        )}
        {selectedRows.length > 1 && (
          <Box>
            <Text>
              ¿Estás seguro de que deseas eliminar estas {selectedRows.length}{' '}
              facturas?
            </Text>
          </Box>
        )}
      </ConfModal>

      <Modal
        centered
        opened={!!analyzeModal.opened}
        size="lg"
        title={
          <Group gap="xs">
            <Text fw="bolder" size="lg">
              Analizar colección
            </Text>
            <ContextGuideButton
              title="el contexto de análisis"
              onClick={openAnalysisContextGuide}
            />
          </Group>
        }
        onClose={() => {
          setAnalyzeModal({ opened: false })
        }}
      >
        {billsCalcQuery.data && billsCalcQuery.data.fullAnalyzed && (
          <Text>
            Esta colección tiene{' '}
            <Text component="span" fw="bold">
              todas sus facturas analizadas
            </Text>
            . ¿Estás seguro de que deseas volver a analizarlas?
          </Text>
        )}
        {billsCalcQuery.data && billsCalcQuery.data.partialAnalyzed && (
          <Text>
            Esta colección tiene
            {''}
            <Text component="span" fw="bold">
              {billsCalcQuery.data.analyzed} facturas analizadas y{' '}
              {billsCalcQuery.data.pending} pendientes
            </Text>
            . ¿Estás seguro de que deseas volver a analizarlas?
          </Text>
        )}
        {billsCalcQuery.data && billsCalcQuery.data.notAnalyzed && (
          <Text>
            Esta colección tiene{' '}
            <Text component="span" fw="bold">
              {billsCalcQuery.data.pending} facturas pendientes de analizar
            </Text>
            . ¿Estás seguro de que deseas analizarlas?
          </Text>
        )}

        {analysisConfigLoading ? (
          <Stack gap="xs" mt="md">
            <Text c="dimmed" size="sm">
              Cargando configuración de análisis…
            </Text>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        ) : analysisConfigError ? (
          <Alert color="red" mt="md">
            No pudimos comprobar tu configuración. Cierra este modal e intenta
            nuevamente antes de analizar.
          </Alert>
        ) : activeConnections.length === 0 ? (
          <Alert color="orange" mt="md">
            Necesitas una conexión activa para analizar.{' '}
            <Link to="/user">Configurar proveedor</Link>
          </Alert>
        ) : activeConnections.length > 1 ? (
          <Input
            data={activeConnections.map((connection) => ({
              value: connection.id,
              label: `${connection.label} · ${connection.modelId}`,
            }))}
            label={
              <FieldHelpLabel
                hint="Elige qué conexión activa procesará esta ejecución. El resultado guardará proveedor y modelo usados."
                label="Conexión"
              />
            }
            mt="md"
            typeInput="select"
            value={
              credentialId ??
              activeConnections.find((connection) => connection.isDefault)
                ?.id ??
              activeConnections[0]?.id
            }
            onChange={(value) => setCredentialId(value)}
          />
        ) : null}

        {analysisConfigReady && (
          <Input
            data={[
              { value: 'strict', label: 'Estricto' },
              { value: 'balanced', label: 'Equilibrado' },
              { value: 'creative', label: 'Flexible' },
            ]}
            label="Preset de análisis"
            mt="md"
            typeInput="select"
            value={preset}
            onChange={(value) => setPreset(value as LLMPreset)}
          />
        )}

        <Group justify="flex-end" mt={24}>
          <Button
            variant="outline"
            onClick={() => {
              setAnalyzeModal({ opened: false })
            }}
          >
            Cancelar
          </Button>
          {billsCalcQuery.data && billsCalcQuery.data.notAnalyzed && (
            <Button
              color="violet"
              disabled={
                !analysisConfigReady || !userCanAnalyzeQuery.data?.canAnalyze
              }
              loading={isAnalyzing}
              onClick={analyzeByType.bind(null, 'all')}
            >
              Analizar
            </Button>
          )}
          {billsCalcQuery.data && billsCalcQuery.data.partialAnalyzed && (
            <Button
              color="violet"
              disabled={
                !analysisConfigReady || !userCanAnalyzeQuery.data?.canAnalyze
              }
              loading={isAnalyzing}
              variant={billsCalcQuery.data.fullAnalyzed ? 'light' : 'filled'}
              onClick={analyzeByType.bind(null, 'missing')}
            >
              Analizar pendientes
            </Button>
          )}
          {billsCalcQuery.data &&
            (billsCalcQuery.data.fullAnalyzed ||
              billsCalcQuery.data.partialAnalyzed) && (
              <Button
                color="violet"
                disabled={
                  !analysisConfigReady || !userCanAnalyzeQuery.data?.canAnalyze
                }
                loading={isAnalyzing}
                onClick={analyzeByType.bind(null, 'all')}
              >
                Re-analizar todo
              </Button>
            )}
        </Group>
      </Modal>

      <Box>
        <Stack gap="md">
          <Group>
            <Link to="/collections">
              <Button leftSection={<ChevronLeft size={20} />} variant="subtle">
                Volver a colecciones
              </Button>
            </Link>
          </Group>

          {collectionQuery.isError && (
            <EmptyState>
              <Text c="red" size="lg">
                Error al cargar la colección. Intenta recargar la página.
              </Text>
            </EmptyState>
          )}

          {!collectionQuery.isError && (
            <React.Fragment>
              <Card withBorder padding="lg" radius="md" shadow="sm">
                <Stack gap={12}>
                  <Skeleton visible={isLoading}>
                    <Box>
                      <Flex align="center" justify="space-between">
                        <Title mb={8} order={2}>
                          {collectionQuery.data?.name}
                        </Title>

                        <ActionIcon
                          size="md"
                          variant="subtle"
                          onClick={() => {
                            if (!collectionQuery.data) return

                            setCollectionForm({
                              opened: true,
                              data: {
                                _count: {
                                  bills: collectionQuery.data.bills.length || 0,
                                },
                                ...collectionQuery.data,
                              },
                            })
                          }}
                        >
                          <Tooltip label="Editar colección">
                            <Edit size={20} />
                          </Tooltip>
                        </ActionIcon>
                      </Flex>

                      <Text c="gray">
                        {collectionQuery.data?.description || 'Sin descripción'}
                      </Text>
                    </Box>
                  </Skeleton>

                  <Skeleton visible={isLoading}>
                    <Flex align="baseline" justify="flex-end">
                      <Flex
                        align="baseline"
                        gap="md"
                        justify="flex-end"
                        style={{
                          alignSelf: isMobile ? 'center' : 'flex-end',
                        }}
                      >
                        <Button
                          leftSection={<NotepadText size={18} />}
                          variant="subtle"
                          onClick={() => setContextModalOpened(true)}
                        >
                          Contexto
                        </Button>
                        <Button
                          leftSection={<History size={18} />}
                          variant="subtle"
                          onClick={() => setHistoryDrawerOpened(true)}
                        >
                          Historial
                        </Button>
                        <Tooltip
                          label={
                            !analysisConfigReady
                              ? 'Configura una conexión de proveedor activa antes de analizar.'
                              : userCanAnalyzeQuery.data?.canAnalyze
                                ? 'Analizar facturas de esta colección con IA usando tu conexión y referencias configuradas.'
                                : 'Su cuenta no tiene permisos para analizar esta colección. Contacta al administrador (enmanuelmag@cardor.dev) para más información.'
                          }
                          openDelay={
                            userCanAnalyzeQuery.data?.canAnalyze ? 1000 : 0
                          }
                        >
                          <Button
                            color="violet"
                            disabled={
                              !collectionQuery.data ||
                              collectionQuery.data.bills.length === 0 ||
                              !analysisConfigReady ||
                              !userCanAnalyzeQuery.data?.canAnalyze
                            }
                            leftSection={<Sparkles size={18} />}
                            variant="light"
                            onClick={() => setAnalyzeModal({ opened: true })}
                          >
                            Analizar colección
                          </Button>
                        </Tooltip>
                      </Flex>
                    </Flex>
                  </Skeleton>
                </Stack>
              </Card>

              <Box>
                <Card withBorder padding="md" radius="md" shadow="sm">
                  <Flex
                    align="flex-start"
                    direction={{
                      md: 'row',
                      xs: 'column',
                    }}
                    justify={{
                      xs: 'center',
                      md: 'space-between',
                    }}
                    mih={52}
                  >
                    <Stack gap={8}>
                      <Group gap="xs">
                        <Title order={2}>Facturas</Title>
                        <ContextGuideButton
                          title="subir facturas"
                          onClick={openInvoicesGuide}
                        />
                      </Group>
                      <Group>
                        <Badge color="violet">
                          {billsCalcQuery.data?.analyzed || 0} analizadas
                        </Badge>
                        <Badge color="gray">
                          {billsCalcQuery.data?.pending || 0} pendientes
                        </Badge>
                      </Group>
                    </Stack>
                    <Group>
                      {selectedRows.length > 0 && (
                        <Button
                          color="red"
                          disabled={selectedRows.length === 0}
                          leftSection={<Trash2 size={16} />}
                          variant="light"
                          onClick={() => {
                            if (selectedRows.length === 0) return
                            setBillDeleteModal(true)
                          }}
                        >
                          Eliminar
                        </Button>
                      )}
                      {selectedRows.length === 0 && (
                        <Tooltip
                          label={
                            contextRevisionsQuery.data?.[0]
                              ? 'Sube XML de facturas que coincidan con el perfil del contexto.'
                              : 'Configura el contexto tributario antes de subir facturas.'
                          }
                        >
                          <Button
                            color="violet"
                            disabled={!contextRevisionsQuery.data?.[0]}
                            leftSection={<Upload size={18} />}
                            onClick={() => {
                              setBillModal({ opened: true, data: collectionId })
                            }}
                          >
                            Subir facturas
                          </Button>
                        </Tooltip>
                      )}
                    </Group>
                  </Flex>

                  <Flex justify="space-between" my="sm">
                    <Flex mb="xs">
                      <Box>
                        {selectedRows.length > 0 && (
                          <Text c="dimmed">
                            {selectedRows.length} factura(s) seleccionada(s)
                          </Text>
                        )}
                        {selectedRows.length === 0 &&
                          collectionQuery.data?.bills &&
                          collectionQuery.data.bills.length > 0 && (
                            <Text c="dimmed">
                              Selecciona una factura para ver opciones
                              adicionales
                            </Text>
                          )}
                      </Box>
                    </Flex>
                  </Flex>

                  <Skeleton visible={isLoading || isLoadingOrRefetch}>
                    <QuickFilter
                      fields={filterFields}
                      filter={filter}
                      onSearch={(value) => {
                        if (isLoading || isLoadingOrRefetch) return

                        if (selectedRows.length > 0) {
                          handlerSelectRows.setState([])
                        }

                        setFilter(value)
                      }}
                    >
                      {isMobile ? (
                        mobileBillsMemo
                      ) : (
                        <Table.ScrollContainer
                          maxHeight={height * 0.5}
                          minWidth={700}
                          px={0}
                        >
                          <Table highlightOnHover striped px={0}>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th w="3%">
                                  <Checkbox
                                    aria-label="Select all rows"
                                    checked={
                                      collectionQuery.data &&
                                      collectionQuery.data.bills.length > 0 &&
                                      selectedRows.length ===
                                        collectionQuery.data.bills.length
                                    }
                                    indeterminate={
                                      selectedRows.length > 0 &&
                                      collectionQuery.data &&
                                      selectedRows.length <
                                        collectionQuery.data.bills.length
                                    }
                                    onChange={(event) => {
                                      if (!collectionQuery.data) return

                                      const checked =
                                        event.currentTarget.checked

                                      if (checked) {
                                        handlerSelectRows.setState(
                                          collectionQuery.data.bills.map(
                                            (b) => b.id,
                                          ),
                                        )
                                      } else {
                                        handlerSelectRows.setState([])
                                      }
                                    }}
                                  />
                                </Table.Th>
                                <Table.Th w="12%">Archivo</Table.Th>
                                <Table.Th w="10%">Secuencial</Table.Th>
                                <Table.Th w="11%">Tipo</Table.Th>
                                <Table.Th w="10%">Fecha</Table.Th>
                                <Table.Th w="8%">Subtotal</Table.Th>
                                <Table.Th w="8%">Impuestos</Table.Th>
                                <Table.Th w="8%">Total</Table.Th>
                                <Table.Th w="8%" />
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{rowsMemo}</Table.Tbody>
                          </Table>
                        </Table.ScrollContainer>
                      )}
                    </QuickFilter>
                  </Skeleton>
                </Card>
              </Box>
            </React.Fragment>
          )}
        </Stack>
      </Box>
    </React.Fragment>
  )

  function analyzeByType(type: 'missing' | 'all') {
    setAnalyzeModal({ opened: false })
    analyzeCollectionMutation.mutate({
      collectionId,
      collectionName: collectionQuery.data?.name || 'Colección',
      type,
      billIds: [],
      preset,
      credentialId:
        credentialId ??
        activeConnections.find((connection) => connection.isDefault)?.id ??
        activeConnections[0]?.id,
    })
  }

  function renderRows() {
    const bills = getFilteredBills()

    if (bills.length === 0) {
      return (
        <Table.Tr>
          <Table.Td colSpan={11}>
            <Center my="lg">
              <Text c="dimmed">
                No hay facturas en esta colección. Sube tus facturas para
                analizarlas y organizarlas.
              </Text>
            </Center>
          </Table.Td>
        </Table.Tr>
      )
    }
    const rows = bills.map((bill) => (
      <Table.Tr key={bill.id}>
        <Table.Td>
          <Checkbox
            aria-label="Select row"
            checked={selectedRows.includes(bill.id)}
            onChange={(event) => {
              const checked = event.currentTarget.checked

              if (checked) {
                handlerSelectRows.append(bill.id)
              } else {
                const index = selectedRows.indexOf(bill.id)
                handlerSelectRows.remove(index)
              }
            }}
          />
        </Table.Td>
        <Table.Td>
          <Text inherit lineClamp={1}>
            {bill.name}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text inherit lineClamp={1}>
            {bill.number}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge
            color={getColorBillTargetType(bill.billType)}
            size="md"
            variant="filled"
          >
            {bill.billType.toUpperCase()}
          </Badge>
        </Table.Td>
        <Table.Td>
          {DateTime.fromJSDate(bill.createdAt).toLocaleString(
            DateTime.DATE_MED,
          )}
        </Table.Td>
        <Table.Td>
          <NumberDisplay
            thousandSeparator
            prefix="$ "
            value={bill.totalWithoutTaxes}
          />
        </Table.Td>
        <Table.Td>
          <NumberDisplay thousandSeparator prefix="$ " value={bill.taxes} />
        </Table.Td>
        <Table.Td>
          <NumberDisplay
            thousandSeparator
            prefix="$ "
            value={bill.totalAmount}
          />
        </Table.Td>
        <Table.Td>
          <Group gap={4}>
            <Tooltip label="Ver detalles">
              <ActionIcon
                size="md"
                variant="subtle"
                onClick={() => {
                  setBillDetailModal({ opened: true, data: bill.id })
                }}
              >
                <EyeIcon size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Eliminar">
              <ActionIcon
                color="red"
                disabled={selectedRows.length > 0}
                size="md"
                variant="subtle"
                onClick={() => {
                  handlerSelectRows.setState([bill.id])
                  setBillDeleteModal(true)
                }}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Table.Td>
      </Table.Tr>
    ))
    return rows
  }

  function renderMobileBills() {
    const bills = getFilteredBills()

    if (bills.length === 0) {
      return (
        <EmptyState
          description="Sube facturas XML para organizarlas y analizarlas."
          title="No hay facturas para mostrar"
          variant={filter.value ? 'no-results' : 'empty'}
        />
      )
    }

    return (
      <Stack gap="sm">
        {bills.map((bill) => (
          <Card withBorder key={bill.id} padding="sm">
            <Stack gap="xs">
              <Group align="flex-start" justify="space-between" wrap="nowrap">
                <Checkbox
                  aria-label={`Seleccionar ${bill.name}`}
                  checked={selectedRows.includes(bill.id)}
                  onChange={(event) => {
                    if (event.currentTarget.checked) {
                      handlerSelectRows.append(bill.id)
                    } else {
                      handlerSelectRows.remove(selectedRows.indexOf(bill.id))
                    }
                  }}
                />
                <Box style={{ flex: 1 }}>
                  <Text fw={600} lineClamp={1}>
                    {bill.name}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {DateTime.fromJSDate(bill.createdAt).toLocaleString(
                      DateTime.DATE_MED,
                    )}
                  </Text>
                </Box>
                <Badge color={getColorBillTargetType(bill.billType)}>
                  {bill.billType.toUpperCase()}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text fw={600} size="sm">
                  <NumberDisplay
                    thousandSeparator
                    prefix="$ "
                    value={bill.totalAmount}
                  />
                </Text>
              </Group>
              <Group gap="xs" justify="flex-end">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() =>
                    setBillDetailModal({ opened: true, data: bill.id })
                  }
                >
                  Ver detalle
                </Button>
                <ActionIcon
                  aria-label={`Eliminar ${bill.name}`}
                  color="red"
                  disabled={selectedRows.length > 0}
                  variant="subtle"
                  onClick={() => {
                    handlerSelectRows.setState([bill.id])
                    setBillDeleteModal(true)
                  }}
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>
    )
  }

  function getFilteredBills() {
    const bills = collectionQuery.data?.bills || []

    if (!filter.field || !filter.value) return bills

    return bills.filter((bill) => {
      const fieldValue = bill[filter.field as keyof typeof bill]

      if (filter.type === 'text' && typeof fieldValue === 'string') {
        return fieldValue
          .toLowerCase()
          .includes(String(filter.value).toLowerCase())
      }

      if (filter.type === 'number' && typeof fieldValue === 'number') {
        return fieldValue === Number(filter.value)
      }

      if (filter.type === 'threshold' && typeof fieldValue === 'number') {
        switch (filter.condition) {
          case '>':
            return fieldValue > filter.value
          case '>=':
            return fieldValue >= filter.value
          case '<':
            return fieldValue < filter.value
          case '<=':
            return fieldValue <= filter.value
          default:
            return false
        }
      }

      return false
    })
  }

  function getBillName(id: string) {
    const bill = collectionQuery.data?.bills.find((b) => b.id === id)
    return bill?.name || 'Factura'
  }
}
