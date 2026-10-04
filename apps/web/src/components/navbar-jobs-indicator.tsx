import {
  ActionIcon,
  Box,
  Divider,
  Group,
  Indicator,
  Modal,
  Popover,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, useNavigate } from '@tanstack/react-router'
import { BrushCleaning, Clock } from 'lucide-react'
import { RunListItem } from '@bill-lm/ui'

import { useJobsStore } from '#/integrations/store/jobs.store'

import { useIsMobile } from '#/utils/mobile'

import { useMarkAsReadMutation } from '#/hooks/mutation/bill'

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
  const status =
    job.status === 'pending'
      ? 'queued'
      : job.status === 'in-progress'
        ? 'running'
        : job.status
  const typeLabels: Record<JobStatusItem['data']['type'], string> = {
    all: 'Análisis completo',
    missing: 'Análisis de faltantes',
    analyzed: 'Re-análisis de analizados',
    specific: 'Análisis específico',
  }
  return (
    <RunListItem
      error={job.error}
      invoiceCount={job.data.billIds.length}
      onOpen={() => onCollectionClick(job.data.collectionId)}
      progress={
        job.status === 'pending' || job.status === 'in-progress'
          ? job.percentage
          : null
      }
      runType={typeLabels[job.data.type]}
      status={status}
      timestamp={(job.status === 'pending' || job.status === 'in-progress'
        ? job.createdAt
        : job.updatedAt
      ).toLocaleString('es-EC')}
      title={job.data.collectionName}
    />
  )
}

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
  const attentionJobs = activeJobs.filter((j) => j.status === 'blocked')
  const indicatorCount = inProgressJobs.length + attentionJobs.length

  const markAsReadMutation = useMarkAsReadMutation({
    onSuccess: () => {
      clearJobs()
    },
  })

  const content = hasJobs ? (
    <Stack gap="sm" w={isMobile ? '100%' : 320}>
      <Group justify="space-between">
        <Box>
          <Text fw={500} size="sm">
            {activeJobs.length} análisis
          </Text>
          <Link to="/jobs">
            <Text size="xs" style={{ textDecoration: 'underline' }}>
              Ver todos
            </Text>
          </Link>
        </Box>
        <Tooltip
          withArrow
          label="Marcar todos como leídos y ocultar esta lista"
          position="bottom"
        >
          <ActionIcon
            aria-label="Marcar todos los análisis como leídos"
            loading={markAsReadMutation.isPending}
            size={'md'}
            variant="light"
            onClick={() => markAsReadMutation.mutate({})}
          >
            <BrushCleaning size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Divider />

      <Stack gap="md">
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
            {completedJobs.length > 0 && <Divider />}
          </>
        )}

        {attentionJobs.length > 0 && (
          <>
            {(inProgressJobs.length > 0 || completedJobs.length > 0) && (
              <Divider />
            )}
            <Box>
              <Text c="orange" fw={500} mb="xs" size="xs">
                Requieren atención ({attentionJobs.length})
              </Text>
              <Stack gap="sm">
                {attentionJobs.map((job) => (
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
            <Indicator
              color="violet"
              disabled={!indicatorCount}
              label={indicatorCount > 99 ? '99+' : indicatorCount || undefined}
              offset={0}
              processing={hasActiveJobs}
              size={20}
            >
              <ActionIcon
                aria-label={`Ver análisis${indicatorCount ? `: ${indicatorCount} requieren atención o están en progreso` : ''}`}
                radius="md"
                size="lg"
                variant="default"
                onClick={toggle}
              >
                <Clock size={20} />
              </ActionIcon>
            </Indicator>
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
        <Indicator
          color="violet"
          disabled={!indicatorCount}
          label={indicatorCount > 99 ? '99+' : indicatorCount || undefined}
          offset={10}
          processing={hasActiveJobs}
          size={20}
        >
          <ActionIcon
            aria-label={`Ver análisis${indicatorCount ? `: ${indicatorCount} requieren atención o están en progreso` : ''}`}
            radius="md"
            size="lg"
            variant="default"
            onClick={toggle}
          >
            <Clock size={20} />
          </ActionIcon>
        </Indicator>
      </Tooltip>

      <Modal
        centered
        closeButtonProps={{ 'aria-label': 'Cerrar análisis' }}
        opened={opened}
        size="md"
        title={
          <Text fw="bolder" size="lg">
            {hasActiveJobs
              ? 'Análisis en progreso'
              : hasJobs
                ? 'Análisis completados'
                : 'Sin análisis'}
          </Text>
        }
        onClose={close}
      >
        {content}
      </Modal>
    </>
  )
}
