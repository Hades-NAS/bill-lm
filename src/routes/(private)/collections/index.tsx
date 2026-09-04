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
import { useLocalStorage } from '@mantine/hooks'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import {
  isEmptyArrayQuery,
  isErrorQuery,
  isLoadingQuery,
  isSuccessWithDataQuery,
} from '#/utils/query'
import { isEmptyObject } from '#/utils/string'

import { useModal } from '#/hooks/modal'
import { useGetCollectionsQuery } from '#/hooks/query/collection'

import { CollectionCard } from '#/components/collection/collection-card'
import CollectionForm from '#/components/collection/form'
import { EmptyState } from '#/components/shared/empty-state'
import {
  ContextGuideButton,
  openContextGuide,
} from '#/components/shared/context-help'
import { LoaderText } from '#/components/shared/loader-text'
import { QuickFilter } from '#/components/shared/quick-filter'

import type { FilterField, FilterValue } from '#/components/shared/quick-filter'
import type { CollectionBaseType } from '#/integrations/trpc/procedures/collections'

const filterFields: Array<FilterField> = [
  {
    name: 'name',
    label: 'Nombre',
    type: 'text',
    placeholder: 'Buscar por nombre',
    clearable: true,
  },
  {
    name: 'year',
    label: 'Año',
    type: 'number',
    placeholder: 'Buscar por año',
    clearable: true,
    // defaultValue: DateTime.now().year,
  },
]

export const Route = createFileRoute('/(private)/collections/')({
  component: CollectionsListPage,
})

const defaultFilter: FilterValue = {
  field: 'name',
  type: 'text',
  value: '',
}

function openCollectionsGuide() {
  openContextGuide({
    title: 'Guía de colecciones',
    introduction:
      'Una colección organiza facturas que quieres revisar juntas. Puedes separarlas por período, actividad o propósito tributario.',
    items: [
      {
        title: 'Organización',
        description:
          'Crea una colección para un conjunto que necesites consultar o analizar de forma independiente.',
        example: 'Facturas personales de 2026 o IVA de enero.',
      },
      {
        title: 'Contexto de análisis',
        description:
          'Dentro de cada colección eliges el perfil, las actividades, el propósito y el período que aplican al análisis.',
      },
      {
        title: 'Facturas',
        description:
          'Sube comprobantes XML. La colección conserva sus facturas y sus ejecuciones de análisis por separado.',
      },
    ],
  })
}

function CollectionsListPage() {
  const [modalCollectionForm, setCollectionForm] =
    useModal<CollectionBaseType>()

  const [filter, setFilter] = useLocalStorage<FilterValue>({
    key: 'collections-list-filter-value-v2',
    defaultValue: defaultFilter,
    deserialize: (str) =>
      str ? (JSON.parse(str) as FilterValue) : defaultFilter,
    serialize: JSON.stringify,
  })

  const collectionQuery = useGetCollectionsQuery({
    search: {
      [filter.field]: filter.value,
    },
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
            <Group gap="xs" mb={8}>
              <Title order={1}>Mis colecciones</Title>
              <ContextGuideButton
                title="colecciones"
                onClick={openCollectionsGuide}
              />
            </Group>
            <Text c="dimmed">Administra tus colecciones de facturas</Text>
          </div>

          <Button
            leftSection={<Plus size={18} />}
            onClick={() => {
              setCollectionForm({ opened: true })
            }}
          >
            Nueva colección
          </Button>
        </Group>

        <QuickFilter
          fields={filterFields}
          filter={filter}
          loading={isLoading}
          onSearch={(value) => setFilter(value)}
        >
          {isSuccessWithData && collectionQuery.isSuccess && (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={24}>
              {collectionQuery.data.map((collection) => (
                <CollectionCard data={collection} key={collection.id} />
              ))}
            </SimpleGrid>
          )}
        </QuickFilter>

        {isError && (
          <EmptyState>
            Ocurrió un error al cargar tus colecciones. Por favor, intenta
            recargar la página.
          </EmptyState>
        )}

        {isLoading && <LoaderText>Cargando colecciones</LoaderText>}

        {isEmpty && isEmptyObject(filter) && (
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
                  Nueva colección
                </Button>
              </Center>
            </Stack>
          </EmptyState>
        )}
        {isEmpty && !isEmptyObject(filter) && (
          <EmptyState>
            <Text c="gray.6">
              No se encontraron colecciones que coincidan con tus criterios de
              búsqueda. Intenta ajustar o eliminar los filtros para ver más
              resultados.
            </Text>
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
