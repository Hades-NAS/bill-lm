import {
  Title,
  Text,
  Stack,
  Box,
  Group,
  Table,
  Badge,
  Paper,
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
import { LoaderText } from '#/components/shared/loader-text'

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
    'in-progress': 'En Progreso',
    completed: 'Completado',
    failed: 'Fallido',
    error: 'Error',
  }
  return labels[status] || status
}

function JobsListPage() {
  const [jobTelemetryModal, setJobTelemetryModal] = useModal<string>()

  const jobsQuery = useGetUserJobsQuery(50)

  const isLoading = isLoadingQuery(jobsQuery)
  const isSuccessWithData = isSuccessWithDataQuery(jobsQuery)
  const isEmpty = isEmptyArrayQuery(jobsQuery)
  const isError = isErrorQuery(jobsQuery)

  const handleViewTelemetry = (jobId: string) => {
    setJobTelemetryModal({ opened: true, data: jobId })
  }

  return (
    <Box py={40}>
      <Stack gap={32}>
        <div>
          <Title mb={8} order={1}>
            Mis Trabajos
          </Title>
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
            <Table.ScrollContainer minWidth={700}>
              <Table highlightOnHover striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Job ID</Table.Th>
                    <Table.Th>Colección</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Progreso</Table.Th>
                    <Table.Th>Creado</Table.Th>
                    <Table.Th>Actualizado</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {jobsQuery.data.map((job) => (
                    <Table.Tr key={job.jobId}>
                      <Table.Td>
                        <Text truncate size="xs" title={job.jobId}>
                          {job.jobId}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {job.data.collectionName || 'N/A'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getStatusColor(job.status)}
                          size="sm"
                          variant="filled"
                        >
                          {getStatusLabel(job.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{job.percentage || 0}%</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {DateTime.fromJSDate(job.createdAt).toLocaleString(
                            DateTime.DATETIME_SHORT,
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {DateTime.fromJSDate(job.updatedAt).toLocaleString(
                            DateTime.DATETIME_SHORT,
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={0}>
                          <Tooltip label="Ver telemetría">
                            <ActionIcon
                              size="sm"
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
}
