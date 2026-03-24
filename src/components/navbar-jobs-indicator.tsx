import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Group,
  Indicator,
  Modal,
  Paper,
  Popover,
  Progress,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, useNavigate } from '@tanstack/react-router'
import { BrushCleaning, Clock } from 'lucide-react'
import { DateTime } from 'luxon'

import { useJobsStore } from '#/integrations/store/jobs.store'

import { useIsMobile } from '#/utils/mobile'

import type { JobStatusItem } from '#/integrations/store/jobs.store'

/**
 * Job card component - renders a single job with appropriate styling based on status
 * Handles both in-progress and completed states
 */
interface JobCardProps {
  job: JobStatusItem
  onCollectionClick: (collectionId: string) => void
}

function JobCard({ job, onCollectionClick }: JobCardProps) {
  const isActive = job.status === 'pending' || job.status === 'in-progress'
  const isCompleted = job.status === 'completed'

  return (
    <Paper
      withBorder
      bd={
        isActive
          ? '1px solid var(--mantine-color-blue-1)'
          : '1px solid var(--mantine-color-gray-2)'
      }
      bg={isActive ? 'blue.0' : undefined}
      key={job.jobId}
      opacity={isActive ? 1 : 0.75}
      p="sm"
    >
      {/* Job header with status */}
      <Group justify="space-between" mb="xs">
        <Text size="xs">{getTypeJobLabel(job.data.type)}</Text>
        <Badge
          color={
            isActive
              ? job.status === 'pending'
                ? 'gray'
                : 'blue'
              : isCompleted
                ? 'green'
                : 'red'
          }
          size="sm"
          variant="light"
        >
          {job.status === 'pending'
            ? 'Pendiente'
            : job.status === 'in-progress'
              ? 'En progreso'
              : job.status === 'completed'
                ? 'Completado'
                : 'Error'}
        </Badge>
      </Group>

      {/* Collection link */}
      <Box mb="sm">
        <Text
          c={getColorByStatus(job.status)}
          component="button"
          fw={500}
          lineClamp={1}
          size="sm"
          style={{
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
          onClick={() => onCollectionClick(job.data.collectionId)}
        >
          {job.data.collectionName}
        </Text>

        <Text c="dimmed" mt={2} size="xs">
          {job.data.billIds.length} factura(s)
        </Text>
      </Box>

      {/* Progress bar - only show for active jobs */}
      {isActive && (
        <>
          <Group justify="space-between" mb="xs">
            <Text c="dimmed" size="xs">
              Progreso
            </Text>
            <Text fw={500} size="xs">
              {Math.round(job.percentage)}%
            </Text>
          </Group>
          <Progress
            color="blue"
            mb="xs"
            radius="md"
            size="sm"
            value={job.percentage}
          />
        </>
      )}

      {/* Error message - only show for failed jobs */}
      {job.status === 'failed' && (
        <Text c="red.8" mb="xs" size="xs">
          Error: {job.error}
        </Text>
      )}

      {/* Timestamps */}
      <Text c="dimmed" size="xs">
        {DateTime.fromJSDate(
          isActive ? job.createdAt : job.updatedAt,
        ).toLocaleString(DateTime.DATETIME_SHORT)}
      </Text>
    </Paper>
  )

  function getColorByStatus(status: JobStatusItem['status']) {
    if (status === 'pending') {
      return 'gray'
    } else if (status === 'in-progress') {
      return 'blue.8'
    } else if (status === 'completed') {
      return 'green.8'
    } else {
      return 'red.8'
    }
  }

  function getTypeJobLabel(type: JobStatusItem['data']['type']) {
    if (type === 'all') {
      return 'Análisis completo'
    } else if (type === 'missing') {
      return 'Análisis de faltantes'
    } else if (type === 'analyzed') {
      return 'Re-análisis de analizados'
    } else {
      return 'Análisis específico'
    }
  }
}

/**
 * Navbar indicator for background jobs
 * Shows a pulsing indicator with badge when jobs are in progress
 * Click to view job details in popover (desktop) or modal (mobile)
 */
export function NavbarJobsIndicator() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [opened, { close, toggle }] = useDisclosure(false)

  const activeJobs = useJobsStore((state) => state.activeJobs)
  const clearJobs = useJobsStore((state) => state.clearJobs)
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
        <Box>
          <Text fw={500} size="sm">
            {activeJobs.length} análisis
          </Text>
          <Link style={{ textDecoration: 'none' }} to="/jobs">
            <Anchor size="xs">Ver todos</Anchor>
          </Link>
        </Box>
        <Tooltip withArrow label="Limpiar lista" position="bottom">
          <ActionIcon size={'md'} variant="light" onClick={() => clearJobs()}>
            <BrushCleaning size={16} />
          </ActionIcon>
        </Tooltip>
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
                  <JobCard
                    job={job}
                    key={job.jobId}
                    onCollectionClick={handleViewCollection}
                  />
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
                  <JobCard
                    job={job}
                    key={job.jobId}
                    onCollectionClick={handleViewCollection}
                  />
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
        No hay análisis en progreso
      </Text>
      <Text c="dimmed" size="xs">
        Inicia un análisis en una colección para ver el progreso aquí
      </Text>
      <Text c="dimmed" size="xs">
        O revisa análisis anteriores completados{' '}
        <Link style={{ textDecoration: 'underline' }} to="/jobs">
          <Text c="violet" component="span" size="xs">
            en la página de trabajos
          </Text>
        </Link>
      </Text>
    </Stack>
  )

  // Desktop: Popover
  if (!isMobile) {
    return (
      <Popover
        withArrow
        offset={0}
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
                color="violet"
                disabled={!inProgressJobs.length}
                offset={0}
                processing={hasActiveJobs}
                size={10}
              >
                <Clock size={20} />
              </Indicator>
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown bd="1px solid var(--mantine-color-gray-4)">
          {content}
        </Popover.Dropdown>
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
            color="violet"
            disabled={!inProgressJobs.length}
            offset={10}
            processing={hasActiveJobs}
            size={10}
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
