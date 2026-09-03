import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'

import { useTRPC } from '#/integrations/trpc/react'

export const Route = createFileRoute('/(private)/user')({
  component: UserPage,
})

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
    trpc.providerConnections.probe.mutationOptions({
      onSuccess: invalidateConnections,
    }),
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
  const [rotationId, setRotationId] = React.useState<string | null>(null)
  const [rotationKey, setRotationKey] = React.useState('')
  const [editId, setEditId] = React.useState<string | null>(null)
  const [editLabel, setEditLabel] = React.useState('')
  const [editModelId, setEditModelId] = React.useState('')
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

          <Card withBorder>
            <Stack>
              <Title order={2}>Conexiones de proveedor</Title>
              <Alert color="blue">
                Puedes guardar varias conexiones; una será la predeterminada y
                podrás elegir otra al analizar.
              </Alert>
              {connections.data?.map((connection) => (
                <Card key={connection.id} padding="sm" withBorder>
                  <Group justify="space-between">
                  <div>
                    <Text fw={600}>
                      {connection.label}{' '}
                      {connection.isDefault && (
                        <Badge ml="xs">Predeterminada</Badge>
                      )}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {connection.provider} · {connection.modelId} · termina en{' '}
                      {connection.secretLastFour}
                    </Text>
                  </div>
                  <Badge color={connection.isActive ? 'green' : 'gray'}>
                    {connection.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                  </Group>
                  <Group mt="sm">
                    <Button
                      disabled={connection.isDefault}
                      loading={updateConnection.isPending}
                      size="xs"
                      variant="light"
                      onClick={() =>
                        updateConnection.mutate({
                          id: connection.id,
                          isDefault: true,
                        })
                      }
                    >
                      Predeterminada
                    </Button>
                    <Button
                      leftSection={<Pencil size={14} />}
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setEditId(connection.id)
                        setEditLabel(connection.label)
                        setEditModelId(connection.modelId)
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      loading={updateConnection.isPending}
                      size="xs"
                      variant="light"
                      onClick={() =>
                        updateConnection.mutate({
                          id: connection.id,
                          isActive: !connection.isActive,
                        })
                      }
                    >
                      {connection.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      loading={probeConnection.isPending}
                      size="xs"
                      variant="light"
                      onClick={() => probeConnection.mutate({ id: connection.id })}
                    >
                      Probar
                    </Button>
                    <Button size="xs" variant="light" onClick={() => setRotationId(connection.id)}>
                      Rotar clave
                    </Button>
                    <ActionIcon
                      aria-label="Eliminar conexión"
                      color="red"
                      loading={removeConnection.isPending}
                      onClick={() => removeConnection.mutate({ id: connection.id })}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                  {connection.probedAt && (
                    <Text c={connection.lastProbeError ? 'red' : 'green'} mt="xs" size="xs">
                      {connection.lastProbeError ?? 'Conexión validada'}.
                    </Text>
                  )}
                </Card>
              ))}
              {connections.data?.length === 0 && (
                <Text c="dimmed">Aún no tienes una conexión configurada.</Text>
              )}
            </Stack>
          </Card>
          {rotationId && (
            <Card withBorder>
              <Stack>
                <Title order={2}>Rotar API key</Title>
                <Text size="sm">
                  La clave anterior dejará de usarse para futuras ejecuciones.
                </Text>
                <PasswordInput label="Nueva API key" value={rotationKey} onChange={(event) => setRotationKey(event.currentTarget.value)} />
                <Group justify="flex-end">
                  <Button variant="default" onClick={() => { setRotationId(null); setRotationKey('') }}>Cancelar</Button>
                  <Button loading={rotateConnection.isPending} onClick={() => rotateConnection.mutate({ id: rotationId, apiKey: rotationKey }, { onSuccess: () => { setRotationId(null); setRotationKey('') } })}>Rotar</Button>
                </Group>
              </Stack>
            </Card>
          )}
          {editId && (
            <Card withBorder>
              <Stack>
                <Title order={2}>Editar conexión</Title>
                <TextInput
                  label="Nombre"
                  value={editLabel}
                  onChange={(event) => setEditLabel(event.currentTarget.value)}
                />
                <TextInput
                  label="Modelo"
                  value={editModelId}
                  onChange={(event) => setEditModelId(event.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    onClick={() => setEditId(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    loading={updateConnection.isPending}
                    onClick={() =>
                      updateConnection.mutate(
                        { id: editId, label: editLabel, modelId: editModelId },
                        { onSuccess: () => setEditId(null) },
                      )
                    }
                  >
                    Guardar cambios
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
          <Card withBorder>
            <Stack>
              <Title order={2}>Agregar conexión</Title>
              <Select
                data={[
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'claude', label: 'Claude' },
                ]}
                label="Proveedor"
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
                label="Nombre"
                placeholder="Trabajo"
                value={label}
                onChange={(event) => setLabel(event.currentTarget.value)}
              />
              <TextInput
                label="Modelo"
                value={modelId}
                onChange={(event) => setModelId(event.currentTarget.value)}
              />
              <PasswordInput
                label="API key"
                value={apiKey}
                onChange={(event) => setApiKey(event.currentTarget.value)}
              />
              <Button
                loading={createConnection.isPending}
                onClick={() =>
                  createConnection.mutate({
                    provider,
                    label,
                    modelId,
                    apiKey,
                    makeDefault: connections.data?.length === 0,
                  })
                }
              >
                Guardar conexión
              </Button>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
