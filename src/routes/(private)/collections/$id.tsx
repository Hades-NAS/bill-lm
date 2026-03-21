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
} from '@mantine/core'
import { useListState } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Calendar, ChevronLeft, Trash2, Upload } from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

import { getColorBillType, getColorPercentage } from '#/utils/bill'
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

import BillAddForm from '#/components/collection/form/bill-form'
import ConfModal from '#/components/shared/conf-modal'
import TextWithIcon from '#/components/shared/text-icon'

import type { AnalyzeCollectionRequest } from '#/schema/collections'

export const Route = createFileRoute('/(private)/collections/$id')({
  component: CollectionDetailPage,
})

function CollectionDetailPage() {
  const { id: collectionId } = Route.useParams()

  const auth = useUserAuth()

  const [billModal, setBillModal] = useModal<string>(collectionId)

  const [billDeleteModal, setBillDeleteModal] = React.useState(false)

  const [analyzeModal, setAnalyzeModal] = useModal<AnalyzeCollectionRequest>()

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

  const rowsMemo = React.useMemo(
    () => renderRows(),
    [collectionQuery.data?.bills, selectedRows],
  )

  return (
    <React.Fragment>
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
                  <Title mb={8} order={2}>
                    {collectionQuery.data?.name || 'Colección'}
                  </Title>
                  <TextWithIcon>
                    <TextWithIcon.Icon size="xs">
                      <Calendar />
                    </TextWithIcon.Icon>
                    <TextWithIcon.Text c="gray.7" size="md">
                      {DateTime.fromJSDate(
                        collectionQuery.data?.createdAt || new Date(),
                      ).toLocaleString(DateTime.DATE_MED)}
                    </TextWithIcon.Text>
                  </TextWithIcon>
                  <Text c="dimmed" mt={4}>
                    {collectionQuery.data?.description || 'Sin descripción'}
                  </Text>
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
                    variant="light"
                    onClick={() => setAnalyzeModal({ opened: true })}
                  >
                    Analizar Colección
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
                <Table.ScrollContainer maxHeight={200} minWidth={700}>
                  <Table highlightOnHover striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th />
                        <Table.Th w="25%">Archivo</Table.Th>
                        <Table.Th w="6%">Tipo</Table.Th>
                        <Table.Th w="10%">Fecha</Table.Th>
                        <Table.Th w="10%">Deducibilidad</Table.Th>
                        <Table.Th w="39%">Razonamiento</Table.Th>
                        <Table.Th />
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
          <Table.Td colSpan={7}>
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
    const rows = bills.map((invoice) => (
      <Table.Tr key={invoice.id}>
        <Table.Td>
          <Checkbox
            aria-label="Select row"
            checked={selectedRows.includes(invoice.id)}
            onChange={(event) => {
              const checked = event.currentTarget.checked

              if (checked) {
                handlerSelectRows.append(invoice.id)
              } else {
                const index = selectedRows.indexOf(invoice.id)
                handlerSelectRows.remove(index)
              }
            }}
          />
        </Table.Td>
        <Table.Td>
          <Text inherit>{invoice.name}</Text>
        </Table.Td>
        <Table.Td>
          <Badge
            color={getColorBillType(invoice.fileType)}
            size="md"
            variant="filled"
          >
            {invoice.fileType.toUpperCase()}
          </Badge>
        </Table.Td>
        <Table.Td>
          {DateTime.fromJSDate(invoice.createdAt).toLocaleString(
            DateTime.DATE_MED,
          )}
        </Table.Td>
        <Table.Td>
          {invoice.percentage !== null ? (
            <Badge
              color={getColorPercentage(invoice.percentage)}
              variant="filled"
            >
              {invoice.percentage}%
            </Badge>
          ) : (
            <Badge color="gray">Pendiente</Badge>
          )}
        </Table.Td>
        <Table.Td>
          {invoice.reason ? (
            <Tooltip multiline label={invoice.reason}>
              <Text lineClamp={4} size="sm">
                {invoice.reason}
              </Text>
            </Tooltip>
          ) : (
            <Text c="dimmed" size="sm">
              -
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          <Tooltip label="Eliminar">
            <ActionIcon
              color="red"
              disabled={selectedRows.length > 0}
              size="sm"
              variant="subtle"
              onClick={() => {
                handlerSelectRows.setState([invoice.id])
                setBillDeleteModal(true)
              }}
            >
              <Trash2 size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
    ))
    return rows
  }

  function getBillName(id: string) {
    const bill = collectionQuery.data?.bills.find((b) => b.id === id)
    return bill?.name || 'Factura'
  }
}
