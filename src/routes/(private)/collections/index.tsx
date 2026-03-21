import {
  Title,
  Text,
  Stack,
  Box,
  Button,
  Group,
  SimpleGrid,
  Center,
} from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import {
  isEmptyArrayQuery,
  isErrorQuery,
  isLoadingQuery,
  isSuccessWithDataQuery,
} from '#/utils/query'

import { useModal } from '#/hooks/modal'
import { useGetCollectionsQuery } from '#/hooks/query/collection'

import { CollectionCard } from '#/components/collection/collection-card'
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
              <CollectionCard data={collection} key={collection.id} />
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
