import {
  Badge,
  Box,
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
import { Activity, BarChart3 } from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

import { useIsMobile } from '#/utils/mobile'
import { isLoadingQuery } from '#/utils/query'

import {
  useGetAgentCallsQuery,
  useGetJobStatsQuery,
} from '#/hooks/query/telemetry'

import { EmptyState } from '#/components/shared/empty-state'
import { LoaderText } from '#/components/shared/loader-text'
import { NumberDisplay } from '#/components/shared/number-display'

import type { AnalyzeJobData } from '#/schema/collections'
import type { ModalPageProps } from '#/schema/page'

const JobTelemetryPage = (props: ModalPageProps<string>) => {
  const {
    state: { opened, data: jobId },
    modal,
    size = 'lg',
    onClose: outerOnClose,
  } = props

  const jobStatsQuery = useGetJobStatsQuery(jobId)
  const agentCallsQuery = useGetAgentCallsQuery(jobId)

  const isLoading =
    isLoadingQuery(jobStatsQuery) || isLoadingQuery(agentCallsQuery)

  const isMobile = useIsMobile()

  const Content = React.useMemo(() => {
    if (isLoading) {
      return <LoaderText>Cargando telemetría del job</LoaderText>
    }

    if (jobStatsQuery.isError || agentCallsQuery.isError) {
      return (
        <EmptyState>
          <Text size="lg">Error al cargar telemetría</Text>
          <Text c="dimmed">
            Ocurrió un error al cargar los datos de telemetría. Por favor,
            intenta de nuevo.
          </Text>
        </EmptyState>
      )
    }

    if (!jobStatsQuery.data) {
      return (
        <EmptyState>
          <Text size="lg">Sin telemetría disponible</Text>
          <Text c="dimmed">
            No se encontraron datos de telemetría para este job. Es posible que
            aún se esté procesando.
          </Text>
        </EmptyState>
      )
    }

    const stats = jobStatsQuery.data
    const agentCalls = agentCallsQuery.data

    return (
      <Flex direction="column" gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Paper withBorder p="md" radius="md">
            <Flex direction="column" gap={8}>
              <Text c="dimmed" fw={500} size="xs">
                Total Tokens
              </Text>
              <Text fw={700} size="xl">
                <NumberDisplay
                  thousandSeparator
                  prefix=""
                  value={stats.totalTokens || 0}
                />
              </Text>
            </Flex>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Flex direction="column" gap={8}>
              <Text c="dimmed" fw={500} size="xs">
                Llamadas
              </Text>
              <Text fw={700} size="xl">
                {stats.callCount || 0}
              </Text>
            </Flex>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Flex direction="column" gap={8}>
              <Text c="dimmed" fw={500} size="xs">
                Duración Promedio
              </Text>
              <Text fw={700} size="xl">
                {agentCalls?.avgDuration || 0}
                <Text span c="dimmed" size="sm">
                  {' '}
                  ms
                </Text>
              </Text>
            </Flex>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Flex direction="column" gap={8}>
              <Text c="dimmed" fw={500} size="xs">
                Última Actualización
              </Text>
              <Text size="xs">
                {DateTime.fromJSDate(stats.updatedAt).toLocaleString(
                  DateTime.DATETIME_SHORT,
                )}
              </Text>
            </Flex>
          </Paper>
        </SimpleGrid>

        <Tabs defaultValue="calls" mt={12} variant="pills">
          <Tabs.List>
            <Tabs.Tab leftSection={<Activity size={14} />} value="calls">
              Llamadas a Agente
            </Tabs.Tab>
            <Tabs.Tab leftSection={<BarChart3 size={14} />} value="summary">
              Resumen
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="calls">
            <Paper withBorder mt="md" p={0}>
              {agentCalls?.calls.length === 0 ? (
                <Box p="md">
                  <EmptyState>
                    <Text size="sm">Sin llamadas registradas</Text>
                  </EmptyState>
                </Box>
              ) : (
                <Table.ScrollContainer maxHeight={400} minWidth={700}>
                  <Table highlightOnHover striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Bill ID</Table.Th>
                        <Table.Th>Tokens</Table.Th>
                        <Table.Th>Duración</Table.Th>
                        <Table.Th>Preset</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Timestamp</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {agentCalls?.calls.map((call) => (
                        <Table.Tr key={`${call.billId}-${call.timestamp}`}>
                          <Table.Td>
                            <Text truncate size="xs">
                              {call.billId.slice(0, 6)}...
                              {call.billId.slice(-6)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              <NumberDisplay
                                thousandSeparator
                                prefix=""
                                value={call.tokensTotal || 0}
                              />
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{call.duration}ms</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={getPresetColor(call.preset)}
                              size="xs"
                              variant="filled"
                            >
                              {call.preset}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={
                                call.status === 'success' ? 'green' : 'red'
                              }
                              size="xs"
                              variant="filled"
                            >
                              {call.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">
                              {DateTime.fromJSDate(
                                new Date(call.timestamp),
                              ).toLocaleString(
                                DateTime.DATETIME_SHORT_WITH_SECONDS,
                              )}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="summary">
            <Flex direction="column" gap="md">
              <Fieldset legend="Estadísticas Generales">
                <Flex direction="column" gap="sm">
                  <Flex justify="space-between">
                    <Text size="sm">Total de Tokens Procesados:</Text>
                    <Text fw={600}>
                      <NumberDisplay
                        thousandSeparator
                        prefix=""
                        value={stats.totalTokens || 0}
                      />
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text size="sm">Número de Llamadas:</Text>
                    <Text fw={600}>{stats.callCount || 0}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text size="sm">Duración Promedio por Llamada:</Text>
                    <Text fw={600}>{agentCalls?.avgDuration || 0} ms</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text size="sm">Tokens Promedio por Llamada:</Text>
                    <Text fw={600}>
                      <NumberDisplay
                        thousandSeparator
                        prefix=""
                        value={
                          stats.callCount
                            ? Math.round(
                                (stats.totalTokens || 0) / stats.callCount,
                              )
                            : 0
                        }
                      />
                    </Text>
                  </Flex>
                </Flex>
              </Fieldset>

              <Fieldset legend="Distribución por Preset">
                {agentCalls?.calls && agentCalls.calls.length > 0 && (
                  <Flex direction="column" gap="sm">
                    {Array.from(
                      new Set(agentCalls.calls.map((c: any) => c.preset)),
                    ).map((preset: string) => {
                      const presetCalls = agentCalls.calls.filter(
                        (c: any) => c.preset === preset,
                      )
                      const presetTokens = presetCalls.reduce(
                        (sum: number, c: any) => sum + (c.tokensTotal || 0),
                        0,
                      )
                      return (
                        <Flex justify="space-between" key={preset}>
                          <Text size="sm">
                            <Badge
                              color={getPresetColor(preset as any)}
                              size="xs"
                              variant="filled"
                            >
                              {preset}
                            </Badge>{' '}
                            ({presetCalls.length} llamadas)
                          </Text>
                          <Text fw={600}>
                            <NumberDisplay
                              thousandSeparator
                              prefix=""
                              value={presetTokens}
                            />{' '}
                            tokens
                          </Text>
                        </Flex>
                      )
                    })}
                  </Flex>
                )}
              </Fieldset>
            </Flex>
          </Tabs.Panel>
        </Tabs>
      </Flex>
    )
  }, [
    jobStatsQuery.data,
    jobStatsQuery.isError,
    agentCallsQuery.data,
    agentCallsQuery.isError,
    isLoading,
  ])

  if (modal) {
    return (
      <Modal
        centered
        fullScreen={isMobile}
        opened={Boolean(opened)}
        scrollAreaComponent={ScrollArea.Autosize}
        size={size}
        title={
          <Text fw="bolder" size="lg">
            Telemetría del Job
          </Text>
        }
        onClose={() => outerOnClose?.()}
      >
        {Content}
      </Modal>
    )
  }

  function getPresetColor(preset: AnalyzeJobData['data']['preset']) {
    if (preset === 'strict') {
      return 'red'
    }
    if (preset === 'balanced') {
      return 'yellow'
    }
    if (preset === 'creative') {
      return 'green'
    }
    return 'gray'
  }
}

export default JobTelemetryPage
