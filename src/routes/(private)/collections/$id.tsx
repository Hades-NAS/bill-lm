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
  ThemeIcon,
  Textarea,
  Alert,
} from '@mantine/core'
import { useListState, useViewportSize } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronLeft,
  Edit,
  EyeIcon,
  HelpCircle,
  NotepadText,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

import { useTRPC } from '#/integrations/trpc/react'

import { getColorBillTargetType, getColorPercentage } from '#/utils/bill'
import { useIsMobile } from '#/utils/mobile'
import {
  isLoadingMutation,
  isLoadingOrRefetchQuery,
  isLoadingQuery,
} from '#/utils/query'
import { formatRUC } from '#/utils/string'

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
import CollectionForm from '#/components/collection/form'
import ConfModal from '#/components/shared/conf-modal'
import { EmptyState } from '#/components/shared/empty-state'
import Input from '#/components/shared/input'
import { NumberDisplay } from '#/components/shared/number-display'
import { QuickFilter } from '#/components/shared/quick-filter'
import TextWithIcon from '#/components/shared/text-icon'

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
  {
    name: 'percentage',
    label: 'Porcentaje',
    type: 'threshold',
    placeholder: 'Buscar por porcentaje',
    clearable: true,
    // defaultValue: DateTime.now().year,
  },
]

function CollectionDetailPage() {
  const { id: collectionId } = Route.useParams()

  const modalInstId = React.useRef(`collection-detail-${collectionId}`)

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
  const connectionsQuery = useQuery(
    trpc.providerConnections.list.queryOptions(),
  )
  const fiscalReferencesQuery = useQuery(
    trpc.fiscalReferences.list.queryOptions(),
  )
  const [credentialId, setCredentialId] = React.useState<string | null>(null)
  const activeConnections =
    connectionsQuery.data?.filter((connection) => connection.isActive) ?? []
  const analysisConfigLoading =
    connectionsQuery.isPending || fiscalReferencesQuery.isPending
  const analysisConfigError =
    connectionsQuery.isError || fiscalReferencesQuery.isError
  const analysisConfigReady =
    !analysisConfigLoading &&
    !analysisConfigError &&
    activeConnections.length > 0 &&
    (fiscalReferencesQuery.data?.length ?? 0) > 0

  const analyzeCollectionMutation = useAnalyzeCollectionMutation()

  const billsCalcQuery = useQuery({
    enabled: !!collectionQuery.data,
    queryKey: billsKeys.calc(collectionId, collectionQuery.data?.bills || []),
    queryFn: () => {
      let analyzed = 0
      let pending = 0

      collectionQuery.data?.bills.forEach((bill) => {
        if (bill.percentage !== null) {
          analyzed++
        } else {
          pending++
        }
      })

      const fullAnalyzed = collectionQuery.data?.bills.length === analyzed
      const partialAnalyzed =
        analyzed > 0 && collectionQuery.data?.bills.length !== analyzed
      const notAnalyzed = analyzed === 0

      return { analyzed, pending, fullAnalyzed, partialAnalyzed, notAnalyzed }
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

      <BillAddForm
        modal
        size="xl"
        state={{
          opened: billModal.opened,
          data: {
            collectionId: billModal.data || '',
            personalIdNumber: collectionQuery.data?.personalIdNumber || '',
            professionalIdNumber:
              collectionQuery.data?.professionalIdNumber || '',
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
          <Text fw="bolder" size="lg">
            Analizar colección
          </Text>
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
        ) : fiscalReferencesQuery.data?.length === 0 ? (
          <Alert color="orange" mt="md">
            Necesitas al menos una referencia fiscal autogestionada para
            analizar. <Link to="/user">Configurar referencias</Link>
          </Alert>
        ) : activeConnections.length > 1 ? (
          <Input
            data={activeConnections.map((connection) => ({
              value: connection.id,
              label: `${connection.label} · ${connection.modelId}`,
            }))}
            label="Conexión"
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
              disabled={!analysisConfigReady || !userCanAnalyzeQuery.data?.canAnalyze}
              loading={isAnalyzing}
              onClick={analyzeByType.bind(null, 'all')}
            >
              Analizar
            </Button>
          )}
          {billsCalcQuery.data && billsCalcQuery.data.partialAnalyzed && (
            <Button
              color="violet"
              disabled={!analysisConfigReady || !userCanAnalyzeQuery.data?.canAnalyze}
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
                disabled={!analysisConfigReady || !userCanAnalyzeQuery.data?.canAnalyze}
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
                    <Flex
                      align="baseline"
                      direction={isMobile ? 'column' : 'row'}
                      justify={{
                        xs: 'center',
                        md: 'space-between',
                      }}
                    >
                      <Flex gap="md">
                        <Stack gap={4}>
                          <Text c="gray.6" size="sm">
                            CED:
                            <Text component="span" fw={600} ml={4}>
                              {collectionQuery.data?.personalIdNumber || 'N/A'}
                            </Text>
                          </Text>
                          <Text c="gray.6" size="sm">
                            RUC:
                            <Text component="span" fw={600} ml={4}>
                              {formatRUC(
                                collectionQuery.data?.professionalIdNumber ||
                                  'N/A',
                              )}
                            </Text>
                          </Text>
                        </Stack>
                      </Flex>
                      <Flex
                        align="baseline"
                        gap="md"
                        justify="flex-end"
                        style={{
                          alignSelf: isMobile ? 'center' : 'flex-end',
                        }}
                      >
                        <Button
                          leftSection={<EyeIcon size={18} />}
                          variant="subtle"
                          onClick={() => seeInstructions()}
                        >
                          Ver instrucciones
                        </Button>
                        <Tooltip
                          label={
                            !analysisConfigReady
                              ? 'Configura una conexión activa y al menos una referencia fiscal antes de analizar.'
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
                      <Title order={2}>Facturas</Title>
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
                        <Button
                          color="violet"
                          leftSection={<Upload size={18} />}
                          onClick={() => {
                            setBillModal({ opened: true, data: collectionId })
                          }}
                        >
                          Subir facturas
                        </Button>
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

                                    const checked = event.currentTarget.checked

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
                              <Table.Th w="10%">
                                <TextWithIcon
                                  multiLine
                                  iconPosition="right"
                                  maxWidth={400}
                                  openDelay={500}
                                  tooltip={
                                    'Porcentaje de confianza de que esta factura es deducible según el análisis de IA. Un porcentaje más alto indica una mayor confianza en la deducibilidad de la factura.'
                                  }
                                >
                                  <TextWithIcon.Text inherit>
                                    Porcentaje
                                  </TextWithIcon.Text>
                                  <TextWithIcon.Icon
                                    c="violet"
                                    size="xs"
                                    variant="transparent"
                                  >
                                    <ThemeIcon size="xs">
                                      <HelpCircle size={18} />
                                    </ThemeIcon>
                                  </TextWithIcon.Icon>
                                </TextWithIcon>
                              </Table.Th>
                              <Table.Th>Razonamiento</Table.Th>
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
      instructions: collectionQuery.data?.instructions || '',
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
          {bill.percentage !== null ? (
            <Badge color={getColorPercentage(bill.percentage)} variant="filled">
              {bill.percentage}%
            </Badge>
          ) : (
            <Badge color="gray">Pendiente</Badge>
          )}
        </Table.Td>
        <Table.Td>
          {bill.reason ? (
            <Tooltip label="Ver razonamiento">
              <ActionIcon
                aria-label={`Ver razonamiento de ${bill.name}`}
                color="violet"
                size="sm"
                variant="subtle"
                onClick={() => setBillDetailModal({ opened: true, data: bill.id })}
              >
                <NotepadText size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Text c="dimmed" size="sm">
              -
            </Text>
          )}
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
          <Card key={bill.id} padding="sm" withBorder>
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
                {bill.percentage !== null ? (
                  <Badge color={getColorPercentage(bill.percentage)}>
                    {bill.percentage}%
                  </Badge>
                ) : (
                  <Badge color="gray">Pendiente</Badge>
                )}
              </Group>
              <Group gap="xs" justify="flex-end">
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setBillDetailModal({ opened: true, data: bill.id })}
                >
                  {bill.reason ? 'Ver razonamiento' : 'Ver detalle'}
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
    let bills = collectionQuery.data?.bills || []

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

  function seeInstructions() {
    modals.open({
      modalId: modalInstId.current,
      centered: true,
      size: 'lg',
      title: (
        <Text fw="bolder" size="lg">
          Instrucciones de la colección
        </Text>
      ),
      children: (
        <Flex direction="column" gap="md">
          <Text size="md">
            Estas son las instrucciones que el agente, usará como referencia
            para facturas que sea de tipo{' '}
            <Text component="span" fw="bold">
              profesional
            </Text>
            . Puedes especificar los detalles de la actividad profesional y que
            compras o gastos serían deducibles
          </Text>
          <Textarea autosize readOnly maxRows={100} size="md" variant="filled">
            {collectionQuery.data?.instructions ||
              'No hay instrucciones para esta colección.'}
          </Textarea>
          <Button
            fullWidth
            mt="md"
            variant="outline"
            onClick={() => {
              if (!collectionQuery.data) return

              modals.close(modalInstId.current)
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
            Editar instrucciones
          </Button>
        </Flex>
      ),
    })
  }
}
