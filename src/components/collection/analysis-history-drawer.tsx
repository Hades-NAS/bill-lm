import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useTRPC } from '#/integrations/trpc/react'

import type { inferRouterOutputs } from '@trpc/server'
import type { TRPCRouter } from '#/integrations/trpc/router'

type RouterOutputs = inferRouterOutputs<TRPCRouter>
type HistoryPage = RouterOutputs['collections']['listAnalysisRunHistory']
type HistoryItem = HistoryPage['items'][number]
type HistoryCursor = NonNullable<HistoryPage['nextCursor']>
type HistoryDetail = RouterOutputs['collections']['getAnalysisRunDetail']
type HistoryResult = HistoryDetail['results'][number]
type AvailableHistoryResult = Extract<
  HistoryResult,
  { status: 'available' }
>['result']

const purposeLabels: Record<string, string> = {
  vat_credit: 'Declaración de IVA',
  business_income_tax: 'IR: actividades económicas',
  personal_expenses: 'IR: gastos personales',
}

const statusLabels: Record<string, string> = {
  queued: 'En cola',
  running: 'En proceso',
  completed: 'Completado',
  failed: 'No completado',
  blocked: 'Bloqueado',
}

const statusColors: Record<string, string> = {
  queued: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  blocked: 'orange',
}

const classificationLabels: Record<string, string> = {
  eligible: 'Aplicable',
  ineligible: 'No aplicable',
  needs_review: 'Requiere revisión',
}

const creditTypeLabels: Record<string, string> = {
  total: 'Total',
  partial: 'Parcial',
  none: 'No aplica',
  undetermined: 'Por determinar',
}

export function getAnalysisRunStatusCopy(status: string) {
  switch (status) {
    case 'queued':
      return 'El análisis está en cola y comenzará pronto.'
    case 'running':
      return 'El análisis está procesando las facturas de esta ejecución.'
    case 'completed':
      return 'El análisis terminó y sus resultados están disponibles.'
    case 'blocked':
      return 'Esta ejecución no llamó al modelo porque faltó un requisito.'
    case 'failed':
      return 'El análisis no se completó. Revisa la configuración antes de intentarlo de nuevo.'
    default:
      return 'El estado de esta ejecución no está disponible.'
  }
}

export function getAnalysisPurposeLabel(purpose: string | null) {
  return purpose
    ? (purposeLabels[purpose] ?? 'Propósito no disponible')
    : 'Propósito no disponible'
}

function formatPeriod(period: HistoryItem['period']) {
  if (!period) return 'Período no disponible'

  return `${new Date(period.startDate).toLocaleDateString('es-EC', {
    timeZone: 'UTC',
  })} — ${new Date(period.endDate).toLocaleDateString('es-EC', {
    timeZone: 'UTC',
  })}`
}

function appendNewHistoryItems(
  current: Array<HistoryItem>,
  next: Array<HistoryItem>,
) {
  const knownIds = new Set(current.map((item) => item.id))
  return [...current, ...next.filter((item) => !knownIds.has(item.id))]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  )
}

function DetailList({
  title,
  items,
  emptyCopy,
}: {
  title: string
  items: Array<string>
  emptyCopy: string
}) {
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        {title}
      </Text>
      {items.length ? (
        <Stack gap={4}>
          {items.map((item, index) => (
            <Text key={`${item}-${index}`} size="sm">
              • {item}
            </Text>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed" size="sm">
          {emptyCopy}
        </Text>
      )}
    </Stack>
  )
}

function ResultReferences({ result }: { result: AvailableHistoryResult }) {
  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Referencias consultadas
      </Text>
      <DetailList
        emptyCopy="No hay referencias oficiales disponibles."
        items={result.references.official.map(
          ({ articleOrSection }) => `Fuente oficial · ${articleOrSection}`,
        )}
        title="Normativa oficial"
      />
      <DetailList
        emptyCopy="No se usaron referencias adicionales."
        items={result.references.user.map(({ name }) => name)}
        title="Referencias aportadas"
      />
    </Stack>
  )
}

function SpecializedResult({ result }: { result: AvailableHistoryResult }) {
  const common = (
    <>
      <DetailField
        label="Clasificación"
        value={classificationLabels[result.classification] ?? 'No disponible'}
      />
      {result.classification === 'needs_review' && (
        <Alert color="orange" title="Revisión necesaria">
          Revisa la documentación indicada antes de tomar una decisión fiscal.
        </Alert>
      )}
      <DetailField label="Razonamiento" value={result.reasoning} />
      <DetailList
        emptyCopy="No se identificaron incertidumbres adicionales."
        items={result.uncertainties}
        title="Incertidumbres"
      />
    </>
  )

  switch (result.purpose) {
    case 'vat_credit':
      return (
        <Stack gap="md">
          {common}
          <DetailField
            label="Tipo de crédito de IVA"
            value={creditTypeLabels[result.creditType] ?? 'No disponible'}
          />
          <DetailField
            label="IVA de la factura"
            value={formatCurrency(result.invoiceVatAmount)}
          />
          {result.potentialCreditableVatAmount !== undefined && (
            <DetailField
              label="IVA potencialmente acreditable"
              value={formatCurrency(result.potentialCreditableVatAmount)}
            />
          )}
          {result.creditablePercentage !== undefined && (
            <DetailField
              label="Porcentaje potencialmente acreditable"
              value={`${result.creditablePercentage}%`}
            />
          )}
          <DetailField
            label="Proporcionalidad"
            value={
              result.proportionalityRequired
                ? 'Se requiere revisar proporcionalidad.'
                : 'No se requiere proporcionalidad.'
            }
          />
          <DetailList
            emptyCopy="No se identificó evidencia adicional pendiente."
            items={result.missingEvidence}
            title="Evidencia pendiente"
          />
          <ResultReferences result={result} />
          <Alert color="blue" title="Resultado orientativo">
            {result.advisoryNotice}
          </Alert>
        </Stack>
      )
    case 'business_income_tax':
      return (
        <Stack gap="md">
          {common}
          {result.businessUsePercentage !== undefined && (
            <DetailField
              label="Uso estimado para la actividad"
              value={`${result.businessUsePercentage}%`}
            />
          )}
          {result.potentialExpenseAmount !== undefined && (
            <DetailField
              label="Gasto potencialmente sustentable"
              value={formatCurrency(result.potentialExpenseAmount)}
            />
          )}
          <DetailField
            label="Uso mixto"
            value={
              result.mixedUseDetected
                ? 'Se identificó posible uso mixto.'
                : 'No se identificó uso mixto.'
            }
          />
          <DetailList
            emptyCopy="No se identificaron observaciones de sustento."
            items={result.substantiationIssues}
            title="Observaciones de sustento"
          />
          <DetailList
            emptyCopy="No se identificó evidencia adicional pendiente."
            items={result.missingEvidence}
            title="Evidencia pendiente"
          />
          <ResultReferences result={result} />
          <Alert color="blue" title="Resultado orientativo">
            {result.advisoryNotice}
          </Alert>
        </Stack>
      )
    case 'personal_expenses':
      return (
        <Stack gap="md">
          {common}
          <DetailField
            label="Categoría de gasto personal"
            value={result.personalExpenseCategory ?? 'Por determinar'}
          />
          {result.potentialEligibleAmount !== undefined && (
            <DetailField
              label="Monto potencialmente aplicable"
              value={formatCurrency(result.potentialEligibleAmount)}
            />
          )}
          {result.beneficiaryRelationship && (
            <DetailField
              label="Beneficiario"
              value={result.beneficiaryRelationship}
            />
          )}
          <DetailList
            emptyCopy="No se identificó evidencia adicional pendiente."
            items={result.missingEvidence}
            title="Evidencia pendiente"
          />
          <ResultReferences result={result} />
          <Alert color="blue" title="Resultado orientativo">
            {result.advisoryNotice}
          </Alert>
        </Stack>
      )
  }
}

function RunStatusBadge({ status }: { status: string }) {
  return (
    <Badge color={statusColors[status] ?? 'gray'} variant="light">
      {statusLabels[status] ?? 'No disponible'}
    </Badge>
  )
}

function RunListItem({
  run,
  onSelect,
}: {
  run: HistoryItem
  onSelect: (runId: string) => void
}) {
  return (
    <UnstyledButton
      aria-label={`Ver resumen del análisis ${getAnalysisPurposeLabel(run.purpose)}`}
      onClick={() => onSelect(run.id)}
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-sm)',
        padding: 'var(--mantine-spacing-sm)',
        textAlign: 'left',
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600}>{getAnalysisPurposeLabel(run.purpose)}</Text>
          <RunStatusBadge status={run.status} />
        </Group>
        <Text c="dimmed" size="sm">
          {formatPeriod(run.period)}
        </Text>
        <Group justify="space-between" wrap="nowrap">
          <Text c="dimmed" size="xs">
            {run.createdAt.toLocaleString('es-EC')}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Text c="dimmed" size="xs">
              {run.invoiceCount}{' '}
              {run.invoiceCount === 1 ? 'factura' : 'facturas'}
            </Text>
            <ChevronRight aria-hidden size={16} />
          </Group>
        </Group>
        <Text c="dimmed" size="xs">
          {run.provider && run.modelId
            ? `${run.provider} · ${run.modelId}`
            : 'Proveedor no disponible'}
        </Text>
      </Stack>
    </UnstyledButton>
  )
}

function RunSummary({
  detail,
  onSelectResult,
}: {
  detail: HistoryDetail
  onSelectResult: (resultIndex: number) => void
}) {
  const frozenContext = detail.frozenContext
  const isBlocked = detail.status === 'blocked'

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>{getAnalysisPurposeLabel(detail.purpose)}</Title>
        <RunStatusBadge status={detail.status} />
      </Group>
      <Text c="dimmed" size="sm">
        {getAnalysisRunStatusCopy(detail.status)}
      </Text>
      {isBlocked && detail.blockMessage && (
        <Alert color="orange" title="Acción necesaria">
          {detail.blockMessage}
        </Alert>
      )}
      {detail.status === 'failed' && (
        <Alert color="red" title="Revisa la configuración">
          Configura el contexto y la conexión antes de iniciar otra ejecución.
        </Alert>
      )}
      <Divider />
      <Stack gap={4}>
        <Text c="dimmed" size="xs">
          Período
        </Text>
        <Text size="sm">{formatPeriod(detail.period)}</Text>
      </Stack>
      <Stack gap={4}>
        <Text c="dimmed" size="xs">
          Facturas
        </Text>
        <Text size="sm">
          {detail.invoiceCount}{' '}
          {detail.invoiceCount === 1
            ? 'factura incluida'
            : 'facturas incluidas'}
        </Text>
      </Stack>
      <Stack gap={4}>
        <Text c="dimmed" size="xs">
          Conexión usada
        </Text>
        <Text size="sm">
          {detail.provider && detail.modelId
            ? `${detail.provider} · ${detail.modelId}`
            : 'No disponible'}
        </Text>
      </Stack>
      {frozenContext.status === 'available' && (
        <>
          <Stack gap={4}>
            <Text c="dimmed" size="xs">
              Revisión de contexto
            </Text>
            <Text size="sm">Revisión {frozenContext.context.revision}</Text>
          </Stack>
          <Stack gap={4}>
            <Text c="dimmed" size="xs">
              Ruleset oficial
            </Text>
            <Text size="sm">Versión {frozenContext.ruleset.version}</Text>
          </Stack>
        </>
      )}
      <Divider />
      <Stack gap="sm">
        <Text fw={600}>Resultados por factura</Text>
        {detail.results.length === 0 ? (
          <Text c="dimmed" size="sm">
            Esta ejecución aún no tiene resultados por factura.
          </Text>
        ) : (
          detail.results.map((result, index) => (
            <UnstyledButton
              key={`${result.createdAt.toISOString()}-${index}`}
              aria-label={`Ver resultado de la factura ${index + 1}`}
              onClick={() => onSelectResult(index)}
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-sm)',
                padding: 'var(--mantine-spacing-sm)',
                textAlign: 'left',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={600}>Factura {index + 1}</Text>
                  <Text c="dimmed" size="sm">
                    {getAnalysisPurposeLabel(result.purpose)}
                  </Text>
                </Stack>
                <ChevronRight aria-hidden size={16} />
              </Group>
            </UnstyledButton>
          ))
        )}
      </Stack>
    </Stack>
  )
}

function InvoiceResultDetail({ result }: { result: HistoryResult }) {
  if (result.status === 'unavailable') {
    return (
      <Alert color="orange" title="Resultado no disponible">
        {result.message}
      </Alert>
    )
  }

  return <SpecializedResult result={result.result} />
}

export function AnalysisHistoryDrawer({
  collectionId,
  collectionName,
  opened,
  onClose,
  onOpenGuide,
  isMobile,
}: {
  collectionId: string
  collectionName: string
  opened: boolean
  onClose: () => void
  onOpenGuide: () => void
  isMobile: boolean
}) {
  const trpc = useTRPC()
  const [requestedCursor, setRequestedCursor] = useState<
    HistoryCursor | undefined
  >()
  const [items, setItems] = useState<Array<HistoryItem>>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(
    null,
  )
  const loadedPageRef = useRef<string | null>(null)
  const previousCollectionIdRef = useRef(collectionId)

  const historyQuery = useQuery({
    ...trpc.collections.listAnalysisRunHistory.queryOptions({
      collectionId,
      cursor: requestedCursor,
      limit: 10,
    }),
    enabled: opened,
  })
  const detailQuery = useQuery({
    ...trpc.collections.getAnalysisRunDetail.queryOptions({
      collectionId,
      runId: selectedRunId ?? collectionId,
    }),
    enabled: opened && selectedRunId !== null,
  })

  const pageKey = requestedCursor
    ? `${requestedCursor.createdAt.toISOString()}:${requestedCursor.id}`
    : 'first'

  useEffect(() => {
    if (!opened || !historyQuery.data || loadedPageRef.current === pageKey)
      return

    loadedPageRef.current = pageKey
    setItems((current) =>
      requestedCursor
        ? appendNewHistoryItems(current, historyQuery.data.items)
        : historyQuery.data.items,
    )
  }, [historyQuery.data, opened, pageKey, requestedCursor])

  const reset = useCallback(() => {
    setRequestedCursor(undefined)
    setItems([])
    setSelectedRunId(null)
    setSelectedResultIndex(null)
    loadedPageRef.current = null
  }, [])

  useEffect(() => {
    if (previousCollectionIdRef.current === collectionId) return

    previousCollectionIdRef.current = collectionId
    reset()
  }, [collectionId, reset])

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSelect = (runId: string) => {
    setSelectedRunId(runId)
    setSelectedResultIndex(null)
  }
  const handleBack = () => {
    setSelectedRunId(null)
    setSelectedResultIndex(null)
  }
  const handleBackToRun = () => setSelectedResultIndex(null)
  const nextCursor = historyQuery.data?.nextCursor ?? null

  return (
    <Drawer
      closeButtonProps={{ 'aria-label': 'Cerrar historial de análisis' }}
      opened={opened}
      position="right"
      scrollAreaComponent={ScrollArea.Autosize}
      size={isMobile ? '100%' : 'lg'}
      title={
        <Group gap="xs">
          <Title order={2}>Historial de análisis</Title>
          <Button
            aria-label="Ver guía del historial de análisis"
            onClick={onOpenGuide}
            size="compact-xs"
            variant="subtle"
          >
            Ayuda
          </Button>
        </Group>
      }
      onClose={handleClose}
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          {collectionName}
        </Text>
        {selectedRunId ? (
          detailQuery.isPending ? (
            <Stack aria-label="Cargando resumen del análisis" gap="sm">
              <Skeleton height={28} />
              <Skeleton height={72} />
              <Skeleton height={54} />
            </Stack>
          ) : detailQuery.isError ? (
            <Alert color="red" title="No se pudo cargar el resumen">
              Intenta abrir esta ejecución nuevamente.
            </Alert>
          ) : detailQuery.data ? (
            <Box>
              {selectedResultIndex !== null ? (
                <>
                  <Button
                    aria-label="Volver al resumen del análisis"
                    leftSection={<ArrowLeft size={16} />}
                    mb="md"
                    variant="subtle"
                    onClick={handleBackToRun}
                  >
                    Volver al resumen
                  </Button>
                  <Stack gap="md">
                    <Title order={3}>
                      Factura {selectedResultIndex + 1}
                    </Title>
                    {detailQuery.data.results[selectedResultIndex] ? (
                      <InvoiceResultDetail
                        result={detailQuery.data.results[selectedResultIndex]}
                      />
                    ) : (
                      <Alert color="orange" title="Resultado no disponible">
                        Esta factura ya no tiene un resultado que se pueda
                        mostrar.
                      </Alert>
                    )}
                  </Stack>
                </>
              ) : (
                <>
                  <Button
                    aria-label="Volver al historial de análisis"
                    leftSection={<ArrowLeft size={16} />}
                    mb="md"
                    variant="subtle"
                    onClick={handleBack}
                  >
                    Volver al historial
                  </Button>
                  <RunSummary
                    detail={detailQuery.data}
                    onSelectResult={setSelectedResultIndex}
                  />
                </>
              )}
            </Box>
          ) : null
        ) : historyQuery.isPending && items.length === 0 ? (
          <Stack aria-label="Cargando historial de análisis" gap="sm">
            <Skeleton height={108} />
            <Skeleton height={108} />
            <Skeleton height={108} />
          </Stack>
        ) : historyQuery.isError ? (
          <Alert color="red" title="No se pudo cargar el historial">
            Intenta recargar esta vista para volver a consultar las ejecuciones.
          </Alert>
        ) : items.length === 0 ? (
          <Alert color="blue" title="Aún no hay ejecuciones">
            Configura el contexto y analiza facturas para ver aquí los bloqueos
            y resultados.
          </Alert>
        ) : (
          <>
            <Stack gap="sm">
              {items.map((run) => (
                <RunListItem key={run.id} run={run} onSelect={handleSelect} />
              ))}
            </Stack>
            {nextCursor && (
              <Button
                aria-label="Cargar más ejecuciones de análisis"
                loading={historyQuery.isFetching}
                variant="light"
                onClick={() => setRequestedCursor(nextCursor)}
              >
                Ver más
              </Button>
            )}
          </>
        )}
      </Stack>
    </Drawer>
  )
}
