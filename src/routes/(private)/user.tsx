import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  FileInput,
  Group,
  Menu,
  Modal,
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
import { MoreHorizontal, Trash2 } from 'lucide-react'

import { useTRPC } from '#/integrations/trpc/react'
import { fileToBase64 } from '#/utils/file'

export const Route = createFileRoute('/(private)/user')({
  component: UserPage,
})

function UserPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const connections = useQuery(trpc.providerConnections.list.queryOptions())
  const fiscalReferences = useQuery(
    trpc.fiscalReferences.list.queryOptions(),
  )
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
  const invalidateFiscalReferences = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.fiscalReferences.list.queryKey(),
    })
  const uploadFiscalReference = useMutation(
    trpc.fiscalReferences.upload.mutationOptions({
      onSuccess: invalidateFiscalReferences,
    }),
  )
  const removeFiscalReference = useMutation(
    trpc.fiscalReferences.remove.mutationOptions({
      onSuccess: invalidateFiscalReferences,
    }),
  )
  const [provider, setProvider] = React.useState<'openai' | 'claude'>('openai')
  const [label, setLabel] = React.useState('')
  const [modelId, setModelId] = React.useState('gpt-4o-mini')
  const [apiKey, setApiKey] = React.useState('')
  const [createModalOpened, setCreateModalOpened] = React.useState(false)
  const [rotationId, setRotationId] = React.useState<string | null>(null)
  const [rotationKey, setRotationKey] = React.useState('')
  const [fiscalReferenceFile, setFiscalReferenceFile] =
    React.useState<File | null>(null)

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

          <Card withBorder>
            <Stack>
              <Group justify="space-between">
                <Title order={2}>Conexiones de proveedor</Title>
                <Button onClick={() => setCreateModalOpened(true)}>
                  Agregar conexión
                </Button>
              </Group>
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
                      loading={probeConnection.isPending}
                      size="xs"
                      variant="light"
                      onClick={() => probeConnection.mutate({ id: connection.id })}
                    >
                      Probar
                    </Button>
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
                        <Menu.Item onClick={() => setRotationId(connection.id)}>
                          Rotar clave
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          disabled={removeConnection.isPending}
                          leftSection={<Trash2 size={16} />}
                          onClick={() =>
                            removeConnection.mutate({ id: connection.id })
                          }
                        >
                          Eliminar conexión
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
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
          <Card withBorder>
            <Stack>
              <div>
                <Title order={2}>Referencias fiscales</Title>
                <Text c="dimmed" size="sm">
                  Material autogestionado global para tus análisis. No se trata
                  como normativa oficial ni como dictamen jurídico.
                </Text>
              </div>
              <Alert color="blue">
                Puedes mantener hasta tres archivos Markdown o PDFs con texto
                seleccionable. Los PDFs se convierten a Markdown en el servidor.
              </Alert>
              <FileInput
                accept=".md,.markdown,text/markdown,text/plain,application/pdf"
                clearable
                disabled={
                  uploadFiscalReference.isPending ||
                  (fiscalReferences.data?.length ?? 0) >= 3
                }
                label="Archivo de referencia"
                placeholder="Selecciona un PDF o Markdown"
                value={fiscalReferenceFile}
                onChange={setFiscalReferenceFile}
              />
              <Group justify="flex-end">
                <Button
                  disabled={
                    !fiscalReferenceFile ||
                    (fiscalReferences.data?.length ?? 0) >= 3
                  }
                  loading={uploadFiscalReference.isPending}
                  onClick={async () => {
                    if (!fiscalReferenceFile) return
                    const mimeType =
                      fiscalReferenceFile.type === 'application/pdf'
                        ? 'application/pdf'
                        : fiscalReferenceFile.type === 'text/plain'
                          ? 'text/plain'
                          : 'text/markdown'
                    uploadFiscalReference.mutate(
                      {
                        file: {
                          name: fiscalReferenceFile.name,
                          base64: await fileToBase64(fiscalReferenceFile),
                          mimeType,
                        },
                      },
                      { onSuccess: () => setFiscalReferenceFile(null) },
                    )
                  }}
                >
                  Agregar referencia
                </Button>
              </Group>
              {uploadFiscalReference.error && (
                <Alert color="red">
                  {uploadFiscalReference.error.message}
                </Alert>
              )}
              {fiscalReferences.data?.map((reference) => (
                <Group key={reference.id} justify="space-between">
                  <div>
                    <Text fw={600}>{reference.name}</Text>
                    <Text c="dimmed" size="sm">
                      {reference.sourceType === 'PDF'
                        ? 'PDF normalizado a Markdown'
                        : 'Markdown normalizado'}
                    </Text>
                  </div>
                  <ActionIcon
                    aria-label={`Eliminar ${reference.name}`}
                    color="red"
                    loading={removeFiscalReference.isPending}
                    onClick={() =>
                      removeFiscalReference.mutate({ id: reference.id })
                    }
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
              ))}
              {fiscalReferences.data?.length === 0 && (
                <Text c="dimmed">
                  Aún no tienes referencias fiscales configuradas.
                </Text>
              )}
            </Stack>
          </Card>
          <Modal
            centered
            onClose={closeCreateModal}
            opened={createModalOpened}
            title="Agregar conexión"
          >
            <Stack>
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
            onClose={closeRotationModal}
            opened={rotationId !== null}
            title="Rotar API key"
          >
            <Stack>
              <Text size="sm">
                La clave anterior dejará de usarse para futuras ejecuciones.
              </Text>
              <PasswordInput
                label="Nueva API key"
                value={rotationKey}
                onChange={(event) => setRotationKey(event.currentTarget.value)}
              />
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
