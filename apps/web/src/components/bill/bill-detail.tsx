import { Flex, Modal, Paper, ScrollArea, Text } from '@mantine/core'
import React from 'react'
import { InvoiceDetails } from '@bill-lm/ui'

import { TaxAnalysisResultSchema } from '#/schema/tax-analysis'

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

    return <InvoiceDetails
      invoice={{
        fileName: data.name,
        typeLabel: data.billType.toUpperCase(),
        importedAt: data.createdAt.toLocaleString('es-EC'),
        buyer: { name: data.buyerName, identifierLabel: data.billType === 'PERSONAL' ? 'Cédula' : 'RUC', identifier: data.idBuyer },
        seller: { name: data.socialName, identifier: data.idSeller, tradeName: data.comercialName, address: data.addressMatriz },
        totals: { subtotal: data.totalWithoutTaxes, taxes: data.taxes, total: data.totalAmount, currency: 'USD' },
        items: data.details.map((detail) => ({ id: detail.id, description: detail.description, unitPrice: detail.unitPrice, quantity: detail.quantity })),
      }}
      analysis={<Paper withBorder p="md">
        {hasAnalysis ? <Flex direction="column" gap={8}><Text size="sm">Clasificación: {analysis?.classification}</Text><Text size="sm">Razón: {analysis?.reasoning}</Text><Text c="dimmed" size="xs">{analysis?.advisoryNotice}</Text></Flex> : <EmptyState><Text size="md">Sin análisis disponible</Text><Text c="dimmed" size="sm">Esta factura aún no ha sido analizada. Regresa a la lista de facturas y selecciona Analizar para procesarla.</Text></EmptyState>}
      </Paper>}
    />
  }, [billDetailQuery.data, billDetailQuery.isError, isLoading])

  if (modal) {
    return (
      <Modal
        centered
        closeButtonProps={{ 'aria-label': 'Cerrar detalle de factura' }}
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
