import {
  Title,
  Text,
  Stack,
  Box,
  Button,
  Group,
  Card,
  SimpleGrid,
  Center,
} from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { notify } from '#/utils/notifications'
import {
  isEmptyArrayQuery,
  isErrorQuery,
  isLoadingQuery,
  isSuccessWithDataQuery,
} from '#/utils/query'

import { useModal } from '#/hooks/modal'
import { useGetCollectionsQuery } from '#/hooks/query/collection'

import CollectionForm from '#/components/collection/form'
import { EmptyState } from '#/components/shared/empty-state'
import { LoaderText } from '#/components/shared/loader-text'

import type { CollectionBaseType } from '#/integrations/trpc/procedures/collections'

export const Route = createFileRoute('/(private)/collections/')({
  component: CollectionsListPage,
})

function CollectionsListPage() {
  const [modalCollectionForm, setCollectionForm] =
    useModal<CollectionBaseType>()

  const collectionQuery = useGetCollectionsQuery({
    search: {},
    sort: {},
  })

  const isLoading = isLoadingQuery(collectionQuery)

  const isSuccessWithData = isSuccessWithDataQuery(collectionQuery)

  const isEmpty = isEmptyArrayQuery(collectionQuery)

  const isError = isErrorQuery(collectionQuery)

  return (
    <Box py={40}>
      <Stack gap={32}>
        <Group justify="space-between">
          <div>
            <Title mb={8} order={1}>
              Mis Colecciones
            </Title>
            <Text c="dimmed">Administra tus colecciones de facturas</Text>
          </div>

          {isSuccessWithData && (
            <Button
              leftSection={<Plus size={18} />}
              onClick={() => {
                setCollectionForm({ opened: true })
              }}
            >
              Nueva Colección
            </Button>
          )}
        </Group>

        {isError && (
          <EmptyState>
            Ocurrió un error al cargar tus colecciones. Por favor, intenta
            recargar la página.
          </EmptyState>
        )}

        {isLoading && <LoaderText>Cargando colecciones</LoaderText>}

        {isSuccessWithData && collectionQuery.isSuccess && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={24}>
            {collectionQuery.data.map((collection) => (
              <Card
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg"
                key={collection.id}
                padding="lg"
                radius="md"
                shadow="sm"
              >
                <Stack gap={12}>
                  <div>
                    <Title mb={4} order={3} size={18}>
                      {collection.name}
                    </Title>
                    <Text c="dimmed" size="sm">
                      {collection.description}
                    </Text>
                  </div>

                  <Group justify="space-between" mt={12}>
                    <div>
                      <Text fw={500} size="sm">
                        Año: {collection.year}
                      </Text>
                      <Text c="dimmed" size="sm">
                        {collection._count.bills} facturas
                      </Text>
                    </div>
                  </Group>

                  <Button
                    fullWidth
                    color="violet"
                    component="a"
                    href={`/collections/${collection.id}`}
                    mt={8}
                    variant="light"
                  >
                    Ver Detalle
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {isEmpty && (
          <EmptyState>
            <Stack>
              <Text c="gray.6">
                No tienes colecciones creadas. Crea una nueva colección para
                empezar a organizar tus facturas.
              </Text>

              <Center>
                <Button
                  leftSection={<Plus size={18} />}
                  mt={16}
                  onClick={() => {
                    setCollectionForm({ opened: true })
                  }}
                >
                  Nueva Colección
                </Button>
              </Center>
            </Stack>
          </EmptyState>
        )}
      </Stack>

      <CollectionForm
        modal
        state={modalCollectionForm}
        onClose={() => {
          setCollectionForm({ opened: false })
        }}
        onSubmitted={() => {
          setCollectionForm({ opened: false })
        }}
      />
    </Box>
  )
}
