import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Container,
  Group,
  Menu,
  Modal,
  PasswordInput,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import React from 'react'
import { ConnectionRow } from '@bill-lm/ui'

import { useTRPC } from '#/integrations/trpc/react'

import {
  ContextGuideButton,
  FieldHelpLabel,
  openContextGuide,
} from '#/components/shared/context-help'

export const Route = createFileRoute('/(private)/user')({
  component: UserPage,
})

function openConnectionsGuide() {
  openContextGuide({
    title: 'Guía de conexiones de proveedor',
    introduction:
      'Una conexión guarda la forma en que Bill-LM usa tu proveedor de IA. La clave se cifra en el servidor y no vuelve al navegador.',
    items: [
      {
        title: 'Proveedor y modelo',
        description:
          'Elige el servicio y el modelo que procesarán tus facturas. Puedes conservar varias conexiones para usos distintos.',
        example: 'OpenAI con gpt-4o-mini para pruebas cotidianas.',
      },
      {
        title: 'Clave de API',
        description:
          'Autoriza el uso de tu cuenta del proveedor. Rótala si la reemplazas o sospechas que se expuso.',
      },
      {
        title: 'Conexión predeterminada',
        description:
          'El sistema la propone al iniciar un análisis. Puedes elegir otra conexión activa en cada colección.',
      },
    ],
  })
}
function UserPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const connections = useQuery(trpc.providerConnections.list.queryOptions())
  const createConnection = useMutation(
    trpc.providerConnections.create.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.providerConnections.list.queryKey(),
        }),
    }),
  )
  const invalidateConnections = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.providerConnections.list.queryKey(),
    })
  const updateConnection = useMutation(
    trpc.providerConnections.update.mutationOptions({
      onSuccess: invalidateConnections,
    }),
  )
  const probeConnection = useMutation(
    trpc.providerConnections.probe.mutationOptions(),
  )
  const removeConnection = useMutation(
    trpc.providerConnections.remove.mutationOptions({
      onSuccess: invalidateConnections,
    }),
  )
  const rotateConnection = useMutation(
    trpc.providerConnections.rotate.mutationOptions({
      onSuccess: invalidateConnections,
    }),
  )
  const [provider, setProvider] = React.useState<'openai' | 'claude'>('openai')
  const [label, setLabel] = React.useState('')
  const [modelId, setModelId] = React.useState('gpt-4o-mini')
  const [apiKey, setApiKey] = React.useState('')
  const [createModalOpened, setCreateModalOpened] = React.useState(false)
  const [rotationId, setRotationId] = React.useState<string | null>(null)
  const [rotationKey, setRotationKey] = React.useState('')
  const [probeFeedback, setProbeFeedback] = React.useState<
    Record<
      string,
      { status: 'idle' | 'pending' | 'success' | 'error'; message?: string }
    >
  >({})
  const probeGeneration = React.useRef<Record<string, number>>({})
  const connectionFingerprints = React.useRef<Record<string, string>>({})

  React.useEffect(() => {
    const next = Object.fromEntries(
      (connections.data ?? []).map((connection) => [
        connection.id,
        `${connection.modelId}:${connection.secretLastFour}`,
      ]),
    )
    const ids = new Set([
      ...Object.keys(connectionFingerprints.current),
      ...Object.keys(next),
    ])
    for (const id of ids) {
      if (
        connectionFingerprints.current[id] !== undefined &&
        connectionFingerprints.current[id] !== next[id]
      ) {
        probeGeneration.current[id] = (probeGeneration.current[id] ?? 0) + 1
        setProbeFeedback((current) => ({
          ...current,
          [id]: { status: 'idle' },
        }))
      }
    }
    connectionFingerprints.current = next
  }, [connections.data])

  const invalidateProbe = (id: string) => {
    probeGeneration.current[id] = (probeGeneration.current[id] ?? 0) + 1
    setProbeFeedback((current) => ({ ...current, [id]: { status: 'idle' } }))
  }

  const connectionError = [
    createConnection.error,
    updateConnection.error,
    probeConnection.error,
    removeConnection.error,
    rotateConnection.error,
  ].find((error) => error != null)

  const closeCreateModal = () => {
    setCreateModalOpened(false)
    setProvider('openai')
    setLabel('')
    setModelId('gpt-4o-mini')
    setApiKey('')
  }
  const closeRotationModal = () => {
    setRotationId(null)
    setRotationKey('')
  }
  return (
    <Box py={40}>
      <Container size="md">
        <Stack gap={24}>
          <div>
            <Title mb={8} order={1}>
              Configuración
            </Title>
            <Text c="dimmed">
              Tus claves se cifran en el servidor y nunca vuelven al navegador.
            </Text>
          </div>

          <Box>
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <Title order={2}>Conexiones de proveedor</Title>
                  <ContextGuideButton
                    title="conexiones de proveedor"
                    onClick={openConnectionsGuide}
                  />
                </Group>
                <Button onClick={() => setCreateModalOpened(true)}>
                  Agregar conexión
                </Button>
              </Group>
              <Alert color="blue">
                Puedes guardar varias conexiones; una será la predeterminada y
                podrás elegir otra al analizar.
              </Alert>
              {connections.isPending && (
                <Stack gap="xs">
                  <Skeleton height={74} />
                  <Skeleton height={74} />
                </Stack>
              )}
              {connections.isError && (
                <Alert
                  color="red"
                  title="No pudimos cargar tus conexiones"
                  withCloseButton={false}
                >
                  <Stack gap="xs">
                    <Text size="sm">{connections.error.message}</Text>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => connections.refetch()}
                    >
                      Reintentar
                    </Button>
                  </Stack>
                </Alert>
              )}
              {connectionError && (
                <Alert color="red" title="No se pudo actualizar la conexión">
                  {connectionError.message}
                </Alert>
              )}
              {connections.data?.map((connection) => (
                <ConnectionRow
                  actions={
                    <Menu position="bottom-end" shadow="md" width={220}>
                      <Menu.Target>
                        <ActionIcon
                          aria-label={`Más acciones para ${connection.label}`}
                          variant="light"
                        >
                          <MoreHorizontal size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          disabled={
                            connection.isDefault || updateConnection.isPending
                          }
                          onClick={() =>
                            updateConnection.mutate({
                              id: connection.id,
                              isDefault: true,
                            })
                          }
                        >
                          Establecer como predeterminada
                        </Menu.Item>
                        <Menu.Item
                          disabled={updateConnection.isPending}
                          onClick={() =>
                            updateConnection.mutate({
                              id: connection.id,
                              isActive: !connection.isActive,
                            })
                          }
                        >
                          {connection.isActive ? 'Desactivar' : 'Activar'}
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            invalidateProbe(connection.id)
                            setRotationId(connection.id)
                          }}
                        >
                          Rotar clave
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          disabled={removeConnection.isPending}
                          leftSection={<Trash2 size={16} />}
                          onClick={() => {
                            invalidateProbe(connection.id)
                            removeConnection.mutate({ id: connection.id })
                          }}
                        >
                          Eliminar conexión
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  }
                  isActive={connection.isActive}
                  isDefault={connection.isDefault}
                  key={connection.id}
                  label={connection.label}
                  model={`${connection.modelId} · termina en ${connection.secretLastFour}`}
                  probeMessage={
                    probeFeedback[connection.id]?.message ??
                    connection.lastProbeError ??
                    (connection.probedAt ? 'Conexión validada' : null)
                  }
                  probeStatus={
                    probeFeedback[connection.id]?.status ??
                    (connection.lastProbeError
                      ? 'error'
                      : connection.probedAt
                        ? 'success'
                        : 'idle')
                  }
                  provider={connection.provider}
                  onProbe={() => {
                    const generation =
                      (probeGeneration.current[connection.id] ?? 0) + 1
                    probeGeneration.current[connection.id] = generation
                    setProbeFeedback((current) => ({
                      ...current,
                      [connection.id]: { status: 'pending' },
                    }))
                    probeConnection.mutate(
                      { id: connection.id },
                      {
                        onSuccess: (result) => {
                          if (
                            probeGeneration.current[connection.id] ===
                            generation
                          )
                            setProbeFeedback((current) => ({
                              ...current,
                              [connection.id]: result.lastProbeError
                                ? {
                                    status: 'error',
                                    message: result.lastProbeError,
                                  }
                                : result.probedAt
                                  ? {
                                      status: 'success',
                                      message: 'Conexión validada',
                                    }
                                  : { status: 'idle' },
                            }))
                        },
                        onError: (error) => {
                          if (
                            probeGeneration.current[connection.id] ===
                            generation
                          )
                            setProbeFeedback((current) => ({
                              ...current,
                              [connection.id]: {
                                status: 'error',
                                message: error.message,
                              },
                            }))
                        },
                      },
                    )
                  }}
                />
              ))}
              {!connections.isPending &&
                !connections.isError &&
                connections.data?.length === 0 && (
                  <Alert color="gray" title="Aún no tienes conexiones">
                    Agrega una conexión para poder analizar facturas con tu
                    propia API key.
                  </Alert>
                )}
            </Stack>
          </Box>

          <Modal
            centered
            closeButtonProps={{ 'aria-label': 'Cerrar agregar conexión' }}
            opened={createModalOpened}
            title={
              <Group gap="xs">
                <Text fw={600}>Agregar conexión</Text>
                <ContextGuideButton
                  title="conexiones de proveedor"
                  onClick={openConnectionsGuide}
                />
              </Group>
            }
            onClose={closeCreateModal}
          >
            <Stack>
              <Select
                data={[
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'claude', label: 'Claude' },
                ]}
                label={
                  <FieldHelpLabel
                    hint="Elige el proveedor que emitió tu API key."
                    label="Proveedor"
                  />
                }
                value={provider}
                onChange={(value) => {
                  const next = value as 'openai' | 'claude'
                  setProvider(next)
                  setModelId(
                    next === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-5',
                  )
                }}
              />
              <TextInput
                label={
                  <FieldHelpLabel
                    hint="Usa un nombre para reconocer esta conexión al analizar una colección."
                    label="Nombre"
                  />
                }
                placeholder="Trabajo"
                value={label}
                onChange={(event) => setLabel(event.currentTarget.value)}
              />
              <TextInput
                label={
                  <FieldHelpLabel
                    hint="Escribe el identificador del modelo habilitado en tu cuenta del proveedor."
                    label="Modelo"
                  />
                }
                value={modelId}
                onChange={(event) => setModelId(event.currentTarget.value)}
              />
              <PasswordInput
                label={
                  <FieldHelpLabel
                    hint="La clave se cifra antes de guardarse. No se muestra de nuevo después de crear la conexión."
                    label="API key"
                  />
                }
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
              />
              {createConnection.error && (
                <Alert color="red" title="No se pudo guardar la conexión">
                  {createConnection.error.message}
                </Alert>
              )}
              <Button
                disabled={!label.trim() || !modelId.trim() || apiKey.length < 8}
                loading={createConnection.isPending}
                onClick={() =>
                  createConnection.mutate(
                    {
                      provider,
                      label,
                      modelId,
                      apiKey,
                      makeDefault: connections.data?.length === 0,
                    },
                    { onSuccess: closeCreateModal },
                  )
                }
              >
                Guardar conexión
              </Button>
            </Stack>
          </Modal>
          <Modal
            centered
            closeButtonProps={{ 'aria-label': 'Cerrar rotar API key' }}
            opened={rotationId !== null}
            title={
              <Group gap="xs">
                <Text fw={600}>Rotar API key</Text>
                <ContextGuideButton
                  title="conexiones de proveedor"
                  onClick={openConnectionsGuide}
                />
              </Group>
            }
            onClose={closeRotationModal}
          >
            <Stack>
              <Text size="sm">
                La clave anterior dejará de usarse para futuras ejecuciones.
              </Text>
              <PasswordInput
                label={
                  <FieldHelpLabel
                    hint="Reemplaza la clave guardada. Las ejecuciones futuras usarán la nueva clave."
                    label="Nueva API key"
                  />
                }
                value={rotationKey}
                onChange={(event) => setRotationKey(event.currentTarget.value)}
              />
              {rotateConnection.error && (
                <Alert color="red" title="No se pudo rotar la clave">
                  {rotateConnection.error.message}
                </Alert>
              )}
              <Group justify="flex-end">
                <Button variant="default" onClick={closeRotationModal}>
                  Cancelar
                </Button>
                <Button
                  disabled={rotationKey.length < 8}
                  loading={rotateConnection.isPending}
                  onClick={() => {
                    if (!rotationId) return
                    rotateConnection.mutate(
                      { id: rotationId, apiKey: rotationKey },
                      { onSuccess: closeRotationModal },
                    )
                  }}
                >
                  Rotar clave
                </Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      </Container>
    </Box>
  )
}
