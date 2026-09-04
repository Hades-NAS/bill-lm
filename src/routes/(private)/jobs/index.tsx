import {
  Title,
  Text,
  Stack,
  Box,
  Group,
  Table,
  Badge,
  Button,
  Card,
  Flex,
  Paper,
  Progress,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { Eye } from 'lucide-react'
import { DateTime } from 'luxon'

import {
  isEmptyArrayQuery,
  isErrorQuery,
  isLoadingQuery,
  isSuccessWithDataQuery,
} from '#/utils/query'

import { useModal } from '#/hooks/modal'
import { useGetUserJobsQuery } from '#/hooks/query/telemetry'

import JobTelemetryPage from '#/components/job/job-telemetry'
import { EmptyState } from '#/components/shared/empty-state'
import {
  ContextGuideButton,
  openContextGuide,
} from '#/components/shared/context-help'
import { LoaderText } from '#/components/shared/loader-text'
import { useIsMobile } from '#/utils/mobile'

export const Route = createFileRoute('/(private)/jobs/')({
  component: JobsListPage,
})

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'yellow'
    case 'in-progress':
      return 'blue'
    case 'completed':
      return 'green'
    case 'failed':
    case 'error':
      return 'red'
    default:
      return 'gray'
  }
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    'in-progress': 'En progreso',
    completed: 'Completado',
    failed: 'Fallido',
    error: 'Error',
  }
  return labels[status] || status
}

function openJobsGuide() {
  openContextGuide({
    title: 'Guía de trabajos',
    introduction:
      'Cada trabajo representa una ejecución de análisis de una colección. Esta pantalla permite revisar su estado y la telemetría disponible.',
    items: [
      {
        title: 'Estados',
        description:
          'Pendiente y en progreso indican que el trabajo sigue en cola o ejecutándose. Completado terminó. Fallido o con error requiere revisar el detalle.',
      },
      {
        title: 'Progreso',
        description:
          'Muestra el avance reportado para las facturas incluidas en el trabajo.',
      },
      {
        title: 'Detalle',
        description:
          'Abre la telemetría para consultar eventos y mensajes del trabajo.',
      },
    ],
  })
}

function JobsListPage() {
  const [jobTelemetryModal, setJobTelemetryModal] = useModal<string>()

  const jobsQuery = useGetUserJobsQuery(50)

  const isLoading = isLoadingQuery(jobsQuery)
  const isSuccessWithData = isSuccessWithDataQuery(jobsQuery)
  const isEmpty = isEmptyArrayQuery(jobsQuery)
  const isError = isErrorQuery(jobsQuery)
  const isMobile = useIsMobile()

  const handleViewTelemetry = (jobId: string) => {
    setJobTelemetryModal({ opened: true, data: jobId })
  }

  return (
    <Box py={40}>
      <Stack gap={32}>
        <div>
          <Group gap="xs" mb={8}>
            <Title order={1}>Mis trabajos</Title>
            <ContextGuideButton title="trabajos" onClick={openJobsGuide} />
          </Group>
          <Text c="dimmed">Historial de análisis y telemetría de trabajos</Text>
        </div>

        {isError && (
          <EmptyState>
            Ocurrió un error al cargar tus trabajos. Por favor, intenta recargar
            la página.
          </EmptyState>
        )}

        {isLoading && <LoaderText>Cargando trabajos</LoaderText>}

        {isSuccessWithData && jobsQuery.isSuccess && (
          <Paper withBorder>
            {isMobile ? (
              <Stack gap="sm" p="sm">
                {jobsQuery.data.map((job) => (
                  <Card key={job.jobId} padding="sm" withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={600} lineClamp={1}>
                          {job.data.collectionName || 'Colección sin nombre'}
                        </Text>
                        <Badge color={getStatusColor(job.status)}>
                          {getStatusLabel(job.status)}
                        </Badge>
                      </Group>
                      <Group justify="space-between">
                        <Text c="dimmed" size="sm">
                          Actualizado {formatRelativeTime(job.updatedAt)}
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => handleViewTelemetry(job.jobId)}
                        >
                          Ver detalle
                        </Button>
                      </Group>
                      <Progress
                        aria-label={`Progreso de ${job.data.collectionName || 'la colección'}: ${Math.round(job.percentage || 0)}%`}
                        color={getStatusColor(job.status)}
                        value={job.percentage || 0}
                      />
                      <Text c="dimmed" size="xs">
                        {Math.round(job.percentage || 0)}% ·{' '}
                        {job.data.billIds.length} factura(s)
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Table.ScrollContainer minWidth={700}>
                <Table highlightOnHover striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Colección</Table.Th>
                      <Table.Th>Estado</Table.Th>
                      <Table.Th>Progreso</Table.Th>
                      <Table.Th>Actualizado</Table.Th>
                      <Table.Th>Acciones</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {jobsQuery.data.map((job) => (
                      <Table.Tr key={job.jobId}>
                        <Table.Td>
                          <Text>{job.data.collectionName || 'N/A'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={getStatusColor(job.status)}
                            variant="filled"
                          >
                            {getStatusLabel(job.status)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Flex align="center" gap="xs">
                            <Progress
                              aria-label={`Progreso: ${Math.round(job.percentage || 0)}%`}
                              style={{ flex: 1 }}
                              value={job.percentage || 0}
                            />
                            <Text size="sm">
                              {Math.round(job.percentage || 0)}%
                            </Text>
                          </Flex>
                        </Table.Td>
                        <Table.Td>
                          <Text>{formatRelativeTime(job.updatedAt)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={0}>
                            <Tooltip label="Ver telemetría">
                              <ActionIcon
                                aria-label={`Ver telemetría de ${job.data.collectionName || 'la colección'}`}
                                variant="subtle"
                                onClick={() => handleViewTelemetry(job.jobId)}
                              >
                                <Eye size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        )}

        {isEmpty && (
          <EmptyState>
            <Stack>
              <Text c="gray.6">
                No tienes trabajos registrados. Crea una colección y ejecuta un
                análisis para comenzar.
              </Text>
            </Stack>
          </EmptyState>
        )}
      </Stack>

      <JobTelemetryPage
        modal
        size="xl"
        state={jobTelemetryModal}
        onClose={() => {
          setJobTelemetryModal({ opened: false })
        }}
      />
    </Box>
  )

  function formatRelativeTime(date: Date) {
    return (
      DateTime.fromJSDate(date).toRelative({ locale: 'es' }) ??
      DateTime.fromJSDate(date).toLocaleString(DateTime.DATETIME_SHORT)
    )
  }
}
