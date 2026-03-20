import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Indicator,
  Modal,
  Popover,
  Progress,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { useNavigate } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { DateTime } from 'luxon'

import { useJobsStore } from '#/integrations/jobs/jobs.store'

/**
 * Navbar indicator for background jobs
 * Shows a pulsing indicator with badge when jobs are in progress
 * Click to view job details in popover (desktop) or modal (mobile)
 */
export function NavbarJobsIndicator() {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const [opened, { close, toggle }] = useDisclosure(false)

  const activeJobs = useJobsStore((state) => state.activeJobs)
  const hasJobs = activeJobs.length > 0

  // Separate jobs into in-progress and completed
  const inProgressJobs = activeJobs.filter(
    (j) => j.status === 'pending' || j.status === 'in-progress',
  )
  const hasActiveJobs = inProgressJobs.length > 0

  const handleViewCollection = (collectionId: string) => {
    navigate({
      to: '/collections/$id',
      params: { id: collectionId },
    })
    close()
  }

  const completedJobs = activeJobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed',
  )

  const content = hasJobs ? (
    <Stack gap="sm" w={isMobile ? '100%' : 320}>
      <Group justify="space-between">
        <Text fw={500} size="sm">
          {activeJobs.length} análisis
        </Text>
        <Text c="dimmed" size="xs">
          ({inProgressJobs.length} activos)
        </Text>
      </Group>

      <Stack gap="md">
        {/* In-progress section */}
        {inProgressJobs.length > 0 && (
          <>
            <Box>
              <Text c="blue" fw={500} mb="xs" size="xs">
                En Progreso ({inProgressJobs.length})
              </Text>
              <Stack gap="sm">
                {inProgressJobs.map((job) => (
                  <Box
                    key={job.jobId}
                    p="sm"
                    style={{
                      border: '1px solid var(--mantine-color-blue-1)',
                      backgroundColor: 'var(--mantine-color-blue-0)',
                      borderRadius: 'var(--mantine-radius-md)',
                    }}
                  >
                    {/* Job header with status */}
                    <Group justify="space-between" mb="xs">
                      <Text c="dimmed" size="xs">
                        {job.jobId.slice(0, 8)}...
                      </Text>
                      <Badge
                        color={job.status === 'pending' ? 'gray' : 'blue'}
                        size="sm"
                        variant="light"
                      >
                        {job.status === 'pending' ? 'Pendiente' : 'En progreso'}
                      </Badge>
                    </Group>

                    {/* Collection link */}
                    <Group mb="xs">
                      <Text c="dimmed" size="xs">
                        Colección:
                      </Text>
                      <Text
                        truncate
                        c="violet"
                        component="button"
                        fw={500}
                        size="xs"
                        style={{
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                        onClick={() =>
                          handleViewCollection(job.data.collectionId)
                        }
                      >
                        {job.data.collectionId}
                      </Text>
                    </Group>

                    {/* Progress bar */}
                    <Group justify="space-between" mb="xs">
                      <Text c="dimmed" size="xs">
                        Progreso
                      </Text>
                      <Text fw={500} size="xs">
                        {Math.round(job.percentage)}%
                      </Text>
                    </Group>
                    <Progress
                      mb="xs"
                      radius="md"
                      size="sm"
                      value={job.percentage}
                    />

                    {/* Timestamps */}
                    <Text c="dimmed" size="xs">
                      {DateTime.fromJSDate(job.createdAt).toLocaleString(
                        DateTime.DATETIME_SHORT,
                      )}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          </>
        )}

        {/* Completed section */}
        {completedJobs.length > 0 && (
          <>
            <Box>
              <Text c="dimmed" fw={500} mb="xs" size="xs">
                Completados ({completedJobs.length})
              </Text>
              <Stack gap="sm">
                {completedJobs.map((job) => (
                  <Box
                    key={job.jobId}
                    opacity={0.75}
                    p="sm"
                    style={{
                      border: '1px solid var(--mantine-color-gray-2)',
                      borderRadius: 'var(--mantine-radius-md)',
                    }}
                  >
                    {/* Job header with status */}
                    <Group justify="space-between" mb="xs">
                      <Text c="dimmed" size="xs">
                        {job.jobId.slice(0, 8)}...
                      </Text>
                      <Badge
                        color={job.status === 'completed' ? 'green' : 'red'}
                        size="sm"
                        variant="light"
                      >
                        {job.status === 'completed' ? 'Completado' : 'Error'}
                      </Badge>
                    </Group>

                    {/* Collection link */}
                    <Group mb="xs">
                      <Text c="dimmed" size="xs">
                        Colección:
                      </Text>
                      <Text
                        truncate
                        c="violet"
                        component="button"
                        fw={500}
                        size="xs"
                        style={{
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                        onClick={() =>
                          handleViewCollection(job.data.collectionId)
                        }
                      >
                        {job.data.collectionId}
                      </Text>
                    </Group>

                    {/* Error message */}
                    {job.status === 'failed' && job.error && (
                      <Text c="red" mb="xs" size="xs">
                        Error: {job.error}
                      </Text>
                    )}

                    {/* Timestamps */}
                    <Text c="dimmed" size="xs">
                      {DateTime.fromJSDate(job.updatedAt).toLocaleString(
                        DateTime.DATETIME_SHORT,
                      )}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Stack>
  ) : (
    <Stack gap="sm" w={isMobile ? '100%' : 320}>
      <Text c="dimmed" fw={500} size="sm">
        No hay análisis
      </Text>
      <Text c="dimmed" size="xs">
        Inicia un análisis en una colección para ver el progreso aquí.
      </Text>
    </Stack>
  )

  // Desktop: Popover
  if (!isMobile) {
    return (
      <Popover
        withArrow
        opened={opened}
        position="bottom-end"
        shadow="md"
        onChange={toggle}
      >
        <Popover.Target>
          <Tooltip
            label={
              hasActiveJobs
                ? 'Ver análisis en progreso'
                : hasJobs
                  ? 'Ver análisis completados'
                  : 'No hay análisis'
            }
            openDelay={1250}
            position="left"
          >
            <ActionIcon
              aria-label="Ver análisis"
              radius="md"
              size="lg"
              variant="default"
              onClick={toggle}
            >
              <Indicator
                color={
                  hasActiveJobs ? 'violet' : hasJobs ? 'gray' : 'transparent'
                }
                offset={0}
                processing={hasActiveJobs}
                size={10}
              >
                <Clock size={20} />
              </Indicator>
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>{content}</Popover.Dropdown>
      </Popover>
    )
  }

  // Mobile: Modal
  return (
    <>
      <Tooltip
        label={
          hasActiveJobs
            ? 'Ver análisis en progreso'
            : hasJobs
              ? 'Ver análisis completados'
              : 'No hay análisis'
        }
        openDelay={1250}
        position="left"
      >
        <ActionIcon
          aria-label="Ver análisis"
          radius="md"
          size="lg"
          variant="default"
          onClick={toggle}
        >
          <Indicator
            color={hasActiveJobs ? 'violet' : hasJobs ? 'gray' : 'transparent'}
            offset={10}
            processing={hasActiveJobs}
            size={8}
          >
            <Clock size={20} />
          </Indicator>
        </ActionIcon>
      </Tooltip>

      <Modal
        centered
        opened={opened}
        size="md"
        title={
          hasActiveJobs
            ? 'Análisis en progreso'
            : hasJobs
              ? 'Análisis completados'
              : 'Sin análisis'
        }
        onClose={close}
      >
        {content}
      </Modal>
    </>
  )
}
