import { Plus } from 'lucide-react'

import {
  Container,
  Title,
  Text,
  Stack,
  Box,
  Button,
  Group,
  Card,
  SimpleGrid,
} from '@mantine/core'

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(private)/collections')({
  component: CollectionsListPage,
})

function CollectionsListPage() {
  // Dummy data
  const collections = [
    {
      id: 1,
      name: 'Gastos 2024',
      description: 'Colección de gastos año fiscal 2024',
      year: 2024,
      invoiceCount: 15,
    },
    {
      id: 2,
      name: 'Gastos 2023',
      description: 'Colección de gastos año fiscal 2023',
      year: 2023,
      invoiceCount: 22,
    },
    {
      id: 3,
      name: 'Deducibles Oficina',
      description: 'Gastos de la oficina principal',
      year: 2024,
      invoiceCount: 8,
    },
  ]

  return (
    <Box py={40}>
      <Container size="lg">
        <Stack gap={32}>
          <Group justify="space-between">
            <div>
              <Title mb={8} order={1}>
                Mis Colecciones
              </Title>
              <Text c="dimmed">Administra tus colecciones de facturas</Text>
            </div>
            <Button color="violet" leftSection={<Plus size={18} />}>
              Nueva Colección
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={24}>
            {collections.map((collection) => (
              <Card
                key={collection.id}
                padding="lg"
                radius="md"
                shadow="sm"
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg"
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
                        {collection.invoiceCount} facturas
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
        </Stack>
      </Container>
    </Box>
  )
}
