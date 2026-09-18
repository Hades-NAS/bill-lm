import {
  Badge,
  Fieldset,
  Flex,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Table,
  Tabs,
  Text,
} from '@mantine/core'
import { ShoppingBagIcon, Sparkles } from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

import { TaxAnalysisResultSchema } from '#/schema/tax-analysis'

import { getColorBillTargetType } from '#/utils/bill'
import { useIsMobile } from '#/utils/mobile'
import { isLoadingQuery } from '#/utils/query'

// import { useUserAuth } from '#/hooks/auth'
// import { useDeleteBillsMutation } from '#/hooks/mutation/bill'
import { useGetBillDetailQuery } from '#/hooks/query/bill'

import {
  ContextGuideButton,
  openContextGuide,
} from '#/components/shared/context-help'
import { EmptyState } from '#/components/shared/empty-state'
import { LoaderText } from '#/components/shared/loader-text'
import { NumberDisplay } from '#/components/shared/number-display'

import type { ModalPageProps } from '#/schema/page'

export function getAnalysisResult(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const candidate = snapshot as Record<string, unknown>
  const createdAt = candidate.createdAt
  const result = TaxAnalysisResultSchema.safeParse({
    ...candidate,
    createdAt: typeof createdAt === 'string' ? new Date(createdAt) : createdAt,
  })
  return result.success ? result.data : null
}

function openBillDetailGuide() {
  openContextGuide({
    title: 'Guía del detalle de factura',
    introduction:
      'Este detalle muestra la información extraída del XML de un comprobante que pertenece a una colección.',
    items: [
      {
        title: 'Datos del comprobante',
        description:
          'Revisa emisor, receptor, fecha, totales y tipo de factura antes de usarla en un análisis.',
      },
      {
        title: 'Productos o servicios',
        description:
          'Muestra el detalle reportado por el XML, como descripción, cantidad y valor unitario.',
      },
      {
        title: 'Análisis',
        description:
          'Los resultados tributarios se guardan por ejecución y conservan el contexto aplicado en ese momento.',
      },
    ],
  })
}

const BillDetailPage = (props: ModalPageProps<string>) => {
  const {
    state: { opened, data: billId },
    modal,
    size = 'lg',
    // onSubmitted,
    onClose: outerOnClose,
  } = props

  const billDetailQuery = useGetBillDetailQuery(billId)

  const isLoading = isLoadingQuery(billDetailQuery)

  const isMobile = useIsMobile()

  // const auth = useUserAuth()

  // const deleteBillsMutation = useDeleteBillsMutation({
  //   onSuccess: () => {
  //     onSubmitted?.()
  //     outerOnClose?.()
  //   },
  // })

  const Content = React.useMemo(() => {
    if (isLoading) {
      return <LoaderText>Cargando detalles de factura</LoaderText>
    }

    if (billDetailQuery.isError) {
      return (
        <EmptyState>
          <Text size="lg">Error al cargar detalles de factura</Text>
          <Text c="dimmed">
            Ocurrió un error al cargar los detalles de esta factura. Por favor,
            intenta de nuevo.
          </Text>
        </EmptyState>
      )
    }

    if (!billDetailQuery.data) {
      return (
        <EmptyState>
          <Text size="lg">Factura no encontrada</Text>
          <Text c="dimmed">
            No se encontró la factura que estás buscando. Es posible que haya
            sido eliminada.
          </Text>
        </EmptyState>
      )
    }

    const { data } = billDetailQuery

    const analysis = getAnalysisResult(
      data.latestAnalysisResult?.resultSnapshot,
    )
    const hasAnalysis = analysis !== null

    return (
      <Flex direction="column" gap="sm">
        <Fieldset legend="Datos del archivo">
          <Flex justify="space-between">
            <Text size="sm">{data.name}</Text>
            <Badge
              color={getColorBillTargetType(data.billType)}
              size="sm"
              variant="filled"
            >
              {data.billType.toUpperCase()}
            </Badge>
          </Flex>

          <Text c="dimmed" size="xs">
            {DateTime.fromJSDate(data.createdAt).toLocaleString(
              DateTime.DATETIME_MED,
            )}
          </Text>
        </Fieldset>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={16}>
          <Fieldset legend="Datos del comprador">
            <Text size="sm">{data.buyerName}</Text>
            <Text c="dimmed" size="xs">
              {data.billType === 'PERSONAL' ? 'Cédula' : 'RUC'}: {data.idBuyer}
            </Text>
          </Fieldset>

          <Fieldset legend="Datos del emisor">
            <Text size="sm">{data.socialName}</Text>
            <Text c="dimmed" size="xs">
              RUC: {data.idSeller}
            </Text>
            <Text c="dimmed" size="xs">
              Nombre comercial: {data.comercialName}
            </Text>
            <Text c="dimmed" lineClamp={2} size="xs">
              Dirección: {data.addressMatriz}
            </Text>
          </Fieldset>
        </SimpleGrid>

        <Paper withBorder p={0}>
          <Table highlightOnHover striped m={0} p={0}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Subtotal</Table.Th>
                <Table.Th>Impuestos</Table.Th>
                <Table.Th>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>
                  <NumberDisplay
                    thousandSeparator
                    prefix="$ "
                    value={data.totalWithoutTaxes}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberDisplay
                    thousandSeparator
                    prefix="$ "
                    value={data.taxes}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberDisplay
                    thousandSeparator
                    prefix="$ "
                    value={data.totalAmount}
                  />
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>

        <Tabs defaultValue="analyze" mt={12} variant="pills">
          <Tabs.List>
            <Tabs.Tab leftSection={<Sparkles size={14} />} value="analyze">
              Análisis
            </Tabs.Tab>
            <Tabs.Tab
              leftSection={<ShoppingBagIcon size={14} />}
              value="details"
            >
              Detalles
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="analyze">
            <Paper withBorder mt="md" p="md">
              {hasAnalysis && (
                <Flex direction="column" gap={8}>
                  {analysis && (
                    <>
                      <Text size="sm">
                        Clasificación: {analysis.classification}
                      </Text>
                      <Text size="sm">Razón: {analysis.reasoning}</Text>
                      <Text c="dimmed" size="xs">
                        {analysis.advisoryNotice}
                      </Text>
                    </>
                  )}
                </Flex>
              )}
              {!hasAnalysis && (
                <EmptyState>
                  <Text size="md">Sin análisis disponible</Text>
                  <Text c="dimmed" size="sm">
                    Esta factura aún no ha sido analizada. Por favor, regresa a
                    la lista de facturas y selecciona "Analizar" para procesar
                    esta factura.
                  </Text>
                </EmptyState>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="details">
            <Paper withBorder mt="md" p={0}>
              <Table.ScrollContainer maxHeight={210} minWidth={700}>
                <Table highlightOnHover striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Nombre</Table.Th>
                      <Table.Th>Precio unitario</Table.Th>
                      <Table.Th>Cantidad</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.details.map((detail) => (
                      <Table.Tr key={detail.id}>
                        <Table.Td>{detail.description}</Table.Td>
                        <Table.Td>
                          <NumberDisplay
                            thousandSeparator
                            prefix="$ "
                            value={detail.unitPrice}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberDisplay
                            thousandSeparator
                            value={detail.quantity}
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Flex>
    )
  }, [billDetailQuery.data, billDetailQuery.isError, isLoading])

  if (modal) {
    return (
      <Modal
        centered
        fullScreen={isMobile}
        opened={Boolean(opened)}
        scrollAreaComponent={ScrollArea.Autosize}
        size={size}
        title={
          <Flex align="center" gap="xs">
            <Text fw="bolder" size="lg">
              Detalle de factura
            </Text>
            <ContextGuideButton
              title="el detalle de factura"
              onClick={openBillDetailGuide}
            />
          </Flex>
        }
        onClose={() => outerOnClose?.()}
      >
        {Content}
      </Modal>
    )
  }
}

export default BillDetailPage
