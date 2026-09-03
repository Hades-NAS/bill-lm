import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  FileInput,
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

import { useTRPC } from '#/integrations/trpc/react'

import { fileToBase64 } from '#/utils/file'

import ConfModal from '#/components/shared/conf-modal'

export const Route = createFileRoute('/(private)/user')({
  component: UserPage,
})

function UserPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const connections = useQuery(trpc.providerConnections.list.queryOptions())
  const fiscalReferences = useQuery(trpc.fiscalReferences.list.queryOptions())
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
  const [fiscalReferenceModalOpened, setFiscalReferenceModalOpened] =
    React.useState(false)
  const [referenceToRemove, setReferenceToRemove] = React.useState<{
    id: string
    name: string
  } | null>(null)

  const connectionError = [
    createConnection.error,
    updateConnection.error,
    probeConnection.error,
    removeConnection.error,
    rotateConnection.error,
  ].find((error) => error != null)
  const fiscalReferenceError = [
    uploadFiscalReference.error,
    removeFiscalReference.error,
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
  const closeFiscalReferenceModal = () => {
    setFiscalReferenceModalOpened(false)
    setFiscalReferenceFile(null)
    uploadFiscalReference.reset()
  }
  const uploadReference = async () => {
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
      { onSuccess: closeFiscalReferenceModal },
    )
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
                <Title order={2}>Conexiones de proveedor</Title>
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
                <Box
                  bd="1px solid var(--mantine-color-default-border)"
                  key={connection.id}
                  p="sm"
                  style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                >
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>
                        {connection.label}{' '}
                        {connection.isDefault && (
                          <Badge ml="xs">Predeterminada</Badge>
                        )}
                      </Text>
                      <Text c="dimmed" size="sm">
                        {connection.provider} · {connection.modelId} · termina
                        en {connection.secretLastFour}
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
                      onClick={() =>
                        probeConnection.mutate({ id: connection.id })
                      }
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
                    <Text
                      c={connection.lastProbeError ? 'red' : 'green'}
                      mt="xs"
                      size="xs"
                    >
                      {connection.lastProbeError ?? 'Conexión validada'}.
                    </Text>
                  )}
                </Box>
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

          <Divider />

          <Box>
            <Stack gap="md">
              <Group align="flex-start" justify="space-between">
                <div>
                  <Title order={2}>Referencias fiscales</Title>
                  <Text c="dimmed" size="sm">
                    Material autogestionado global para tus análisis. No se
                    trata como normativa oficial ni como dictamen jurídico.
                  </Text>
                </div>
                <Button
                  disabled={
                    fiscalReferences.isPending ||
                    (fiscalReferences.data?.length ?? 0) >= 3
                  }
                  onClick={() => setFiscalReferenceModalOpened(true)}
                >
                  Agregar referencia
                </Button>
              </Group>
              <Alert color="blue">
                {fiscalReferences.data?.length ?? 0}/3 referencias. Aceptamos
                Markdown o PDFs con texto seleccionable; los PDFs se convierten
                a Markdown en el servidor.
              </Alert>
              {fiscalReferences.isPending && (
                <Stack gap="xs">
                  <Skeleton height={62} />
                  <Skeleton height={62} />
                </Stack>
              )}
              {fiscalReferences.isError && (
                <Alert color="red" title="No pudimos cargar tus referencias">
                  <Stack gap="xs">
                    <Text size="sm">{fiscalReferences.error.message}</Text>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => fiscalReferences.refetch()}
                    >
                      Reintentar
                    </Button>
                  </Stack>
                </Alert>
              )}
              {fiscalReferenceError && (
                <Alert color="red" title="No se pudo actualizar la referencia">
                  {fiscalReferenceError.message}
                </Alert>
              )}
              {fiscalReferences.data?.map((reference) => (
                <Group
                  bd="1px solid var(--mantine-color-default-border)"
                  justify="space-between"
                  key={reference.id}
                  p="sm"
                  style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                >
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
                    loading={
                      removeFiscalReference.isPending &&
                      referenceToRemove?.id === reference.id
                    }
                    onClick={() => setReferenceToRemove(reference)}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
              ))}
              {!fiscalReferences.isPending &&
                !fiscalReferences.isError &&
                fiscalReferences.data?.length === 0 && (
                  <Alert color="gray" title="Aún no tienes referencias">
                    Agrega hasta tres documentos que quieras usar como contexto
                    en análisis futuros.
                  </Alert>
                )}
            </Stack>
          </Box>
          <Modal
            centered
            opened={fiscalReferenceModalOpened}
            title="Agregar referencia fiscal"
            onClose={closeFiscalReferenceModal}
          >
            <Stack>
              <Alert color="blue">
                Puedes mantener hasta tres referencias globales. Aceptamos
                Markdown, texto plano y PDF con texto seleccionable; los PDF se
                convierten a Markdown en el servidor y no se conserva el PDF
                original.
              </Alert>
              <FileInput
                clearable
                accept=".md,.markdown,text/markdown,text/plain,application/pdf"
                disabled={uploadFiscalReference.isPending}
                label="Archivo de referencia"
                placeholder="Selecciona un PDF o Markdown"
                value={fiscalReferenceFile}
                onChange={setFiscalReferenceFile}
              />
              {uploadFiscalReference.isPending && (
                <Text c="dimmed" size="sm">
                  Convirtiendo, limpiando y guardando la referencia…
                </Text>
              )}
              {uploadFiscalReference.error && (
                <Alert color="red" title="No se pudo agregar la referencia">
                  {uploadFiscalReference.error.message}
                </Alert>
              )}
              <Group justify="flex-end">
                <Button
                  disabled={uploadFiscalReference.isPending}
                  variant="default"
                  onClick={closeFiscalReferenceModal}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={!fiscalReferenceFile}
                  loading={uploadFiscalReference.isPending}
                  onClick={uploadReference}
                >
                  Guardar referencia
                </Button>
              </Group>
            </Stack>
          </Modal>
          <ConfModal
            confirmColor="red"
            confirmText="Eliminar referencia"
            consequence="Los resultados ya generados no cambian; la referencia dejará de usarse en análisis futuros."
            loading={removeFiscalReference.isPending}
            opened={referenceToRemove !== null}
            title="Eliminar referencia fiscal"
            variant="destructive"
            onCancel={() => setReferenceToRemove(null)}
            onConfirm={() => {
              if (!referenceToRemove) return
              removeFiscalReference.mutate(
                { id: referenceToRemove.id },
                { onSuccess: () => setReferenceToRemove(null) },
              )
            }}
          >
            <Text>
              Se eliminará <b>{referenceToRemove?.name}</b>. Dejará de influir
              en análisis futuros; los resultados ya generados no se modifican.
            </Text>
          </ConfModal>
          <Modal
            centered
            opened={createModalOpened}
            title="Agregar conexión"
            onClose={closeCreateModal}
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
            opened={rotationId !== null}
            title="Rotar API key"
            onClose={closeRotationModal}
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
