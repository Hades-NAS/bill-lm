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
} from '@mantine/core'
import { useListState, useViewportSize } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Calendar,
  ChevronLeft,
  Edit,
  EyeIcon,
  File,
  NotepadText,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

import { getColorBillTargetType, getColorPercentage } from '#/utils/bill'
import {
  isLoadingMutation,
  isLoadingOrRefetchQuery,
  isLoadingQuery,
} from '#/utils/query'

import { useUserAuth } from '#/hooks/auth'
import { useModal } from '#/hooks/modal'
import { useDeleteBillsMutation } from '#/hooks/mutation/bill'
import { useAnalyzeCollectionMutation } from '#/hooks/mutation/collection'
import { useGetCollectionByIdQuery } from '#/hooks/query/collection'
import { billsKeys } from '#/hooks/query-keys'

import BillDetailPage from '#/components/bill/bill-detail'
import BillAddForm from '#/components/bill/form'
import CollectionForm from '#/components/collection/form'
import ConfModal from '#/components/shared/conf-modal'
import { NumberDisplay } from '#/components/shared/number-display'
import TextWithIcon from '#/components/shared/text-icon'

import type { CollectionBaseType } from '#/integrations/trpc/procedures/bills'
import type { AnalyzeCollectionRequest } from '#/schema/collections'

export const Route = createFileRoute('/(private)/collections/$id')({
  component: CollectionDetailPage,
})

function CollectionDetailPage() {
  const { id: collectionId } = Route.useParams()

  const modalInstId = React.useRef(`collection-detail-${collectionId}`)

  const auth = useUserAuth()

  const [billModal, setBillModal] = useModal<string>(collectionId)

  const [billDeleteModal, setBillDeleteModal] = React.useState(false)

  const [analyzeModal, setAnalyzeModal] = useModal<AnalyzeCollectionRequest>()

  const [billDetailModal, setBillDetailModal] = useModal<string>()

  const [modalCollectionForm, setCollectionForm] =
    useModal<CollectionBaseType>()

  const [selectedRows, handlerSelectRows] = useListState<string>([])

  const collectionQuery = useGetCollectionByIdQuery(collectionId)

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

  const isLoading = isLoadingQuery(collectionQuery)

  const isLoadingOrRefetch = isLoadingOrRefetchQuery(collectionQuery)

  const isLoadingCalc = isLoadingOrRefetchQuery(billsCalcQuery)

  const isLoadingDelete = isLoadingMutation(deleteBillsMutation)

  const isAnalyzing = isLoadingMutation(analyzeCollectionMutation)

  const { height } = useViewportSize()

  const rowsMemo = React.useMemo(
    () => renderRows(),
    [collectionQuery.data?.bills, selectedRows],
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
        state={billModal}
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
          deleteBillsMutation.mutate({
            auth,
            data: { collectionId, billIds: selectedRows },
          })
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
          <Text fw={500} size="lg">
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
              loading={isAnalyzing}
              onClick={analyzeByType.bind(null, 'all')}
            >
              Analizar
            </Button>
          )}
          {billsCalcQuery.data && billsCalcQuery.data.partialAnalyzed && (
            <Button
              color="violet"
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
                Volver a Colecciones
              </Button>
            </Link>
          </Group>

          <Card withBorder padding="lg" radius="md" shadow="sm">
            <Stack gap={12}>
              <Skeleton visible={isLoading}>
                <Box>
                  <Flex align="center" justify="space-between">
                    <Title mb={8} order={2}>
                      {collectionQuery.data?.name || 'Colección'}
                    </Title>

                    <ActionIcon
                      size="sm"
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
                        <Edit />
                      </Tooltip>
                    </ActionIcon>
                  </Flex>

                  <Text c="dimmed">
                    {collectionQuery.data?.description || 'Sin descripción'}
                  </Text>

                  <TextWithIcon>
                    <TextWithIcon.Icon c="violet.3" size="xs">
                      <Calendar />
                    </TextWithIcon.Icon>
                    <TextWithIcon.Text c="dimmed" size="md">
                      {DateTime.fromJSDate(
                        collectionQuery.data?.createdAt || new Date(),
                      ).toLocaleString(DateTime.DATE_MED)}
                    </TextWithIcon.Text>
                  </TextWithIcon>
                </Box>
              </Skeleton>

              <Skeleton visible={isLoadingCalc || isLoading}>
                <Group>
                  <Badge color="violet">
                    {billsCalcQuery.data?.analyzed || 0} analizadas
                  </Badge>
                  <Badge color="gray">
                    {billsCalcQuery.data?.pending || 0} pendientes
                  </Badge>
                </Group>
              </Skeleton>

              <Skeleton visible={isLoading}>
                <Group mt={12}>
                  <Button
                    color="violet"
                    leftSection={<Upload size={18} />}
                    onClick={() => {
                      setBillModal({ opened: true, data: collectionId })
                    }}
                  >
                    Subir Facturas
                  </Button>
                  <Button
                    color="violet"
                    disabled={
                      !collectionQuery.data ||
                      collectionQuery.data.bills.length === 0
                    }
                    leftSection={<Sparkles size={18} />}
                    variant="light"
                    onClick={() => setAnalyzeModal({ opened: true })}
                  >
                    Analizar Colección
                  </Button>
                  <Button
                    leftSection={<EyeIcon size={18} />}
                    variant="subtle"
                    onClick={seeInstructions}
                  >
                    Ver Instrucciones
                  </Button>
                </Group>
              </Skeleton>
            </Stack>
          </Card>

          <Box>
            <Flex
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
              <Title mb={16} order={2}>
                Facturas
              </Title>

              {selectedRows.length > 0 && (
                <Group mb={16}>
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
                </Group>
              )}
            </Flex>

            <Card withBorder padding="md" radius="md" shadow="sm">
              <Box mb="xs">
                {selectedRows.length > 0 && (
                  <Text c="dimmed">
                    {selectedRows.length} factura(s) seleccionada(s)
                  </Text>
                )}
                {selectedRows.length === 0 &&
                  collectionQuery.data?.bills &&
                  collectionQuery.data.bills.length > 0 && (
                    <Text c="dimmed">
                      Selecciona una factura para ver opciones adicionales
                    </Text>
                  )}
              </Box>

              <Skeleton visible={isLoading || isLoadingOrRefetch}>
                <Table.ScrollContainer
                  maxHeight={height * 0.5}
                  minWidth={700}
                  px={0}
                >
                  <Table highlightOnHover striped px={0}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w="3%" />
                        <Table.Th w="12%">Archivo</Table.Th>
                        <Table.Th w="10%">Secuencial</Table.Th>
                        <Table.Th w="11%">Tipo</Table.Th>
                        <Table.Th w="10%">Fecha</Table.Th>
                        <Table.Th w="8%">Subtotal</Table.Th>
                        <Table.Th w="8%">Impuestos</Table.Th>
                        <Table.Th w="8%">Total</Table.Th>
                        <Table.Th w="10%">Deducibilidad</Table.Th>
                        <Table.Th>Razonamiento</Table.Th>
                        <Table.Th w="8%" />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{rowsMemo}</Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Skeleton>
            </Card>
          </Box>
        </Stack>
      </Box>
    </React.Fragment>
  )

  function analyzeByType(type: 'missing' | 'all') {
    setAnalyzeModal({ opened: false })
    analyzeCollectionMutation.mutate({
      auth,
      data: {
        collectionId,
        collectionName: collectionQuery.data?.name || 'Colección',
        instructions: collectionQuery.data?.instructions || '',
        type,
        billIds: [],
      },
    })
  }

  function renderRows() {
    const bills = collectionQuery.data?.bills || []

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
            <Tooltip multiline label={bill.reason} maw={500}>
              <ThemeIcon color="violet" size="sm" variant="subtle">
                <NotepadText size={16} />
              </ThemeIcon>
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

  function getBillName(id: string) {
    const bill = collectionQuery.data?.bills.find((b) => b.id === id)
    return bill?.name || 'Factura'
  }

  function seeInstructions() {
    modals.open({
      id: modalInstId.current,
      centered: true,
      title: <Text size="lg">Instrucciones de la colección</Text>,
      children: (
        <Text size="sm">
          {collectionQuery.data?.instructions ||
            'No hay instrucciones para esta colección.'}
        </Text>
      ),
    })
  }
}
