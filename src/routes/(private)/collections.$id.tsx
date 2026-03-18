import { ChevronLeft, Trash2, Upload } from 'lucide-react'

import {
  Container,
  Title,
  Text,
  Stack,
  Box,
  Button,
  Group,
  Card,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core'

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(private)/collections/$id')({
  component: CollectionDetailPage,
})

function CollectionDetailPage() {
  const params = Route.useParams()
  const collectionId = params.id

  const invoices = [
    {
      id: 1,
      filename: 'factura-001.xml',
      fileType: 'xml',
      createdAt: '2024-01-15',
      percentage: 85.5,
      analyze: 'Gasto deducible según normativa SRI',
    },
    {
      id: 2,
      filename: 'factura-002.pdf',
      fileType: 'pdf',
      createdAt: '2024-01-16',
      percentage: 60.0,
      analyze: 'Parcialmente deducible',
    },
    {
      id: 3,
      filename: 'factura-003.xml',
      fileType: 'xml',
      createdAt: '2024-01-17',
      percentage: null,
      analyze: null,
    },
  ]

  const rows = invoices.map((invoice) => (
    <Table.Tr key={invoice.id}>
      <Table.Td>{invoice.filename}</Table.Td>
      <Table.Td>
        <Badge size="sm" variant="light">
          {invoice.fileType.toUpperCase()}
        </Badge>
      </Table.Td>
      <Table.Td>{invoice.createdAt}</Table.Td>
      <Table.Td>
        {invoice.percentage !== null ? (
          <Badge color="green">{invoice.percentage}%</Badge>
        ) : (
          <Badge color="gray">Pendiente</Badge>
        )}
      </Table.Td>
      <Table.Td>
        {invoice.analyze ? (
          <Text size="sm">{invoice.analyze}</Text>
        ) : (
          <Text c="dimmed" size="sm">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Tooltip label="Eliminar">
          <ActionIcon color="red" size="sm" variant="subtle">
            <Trash2 size={16} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Box py={40}>
      <Container size="lg">
        <Stack gap={32}>
          <Group>
            <Button
              component="a"
              href="/collections"
              leftSection={<ChevronLeft size={18} />}
              variant="subtle"
            >
              Volver a Colecciones
            </Button>
          </Group>

          <Card padding="lg" radius="md" shadow="sm">
            <Stack gap={12}>
              <div>
                <Title mb={8} order={1}>
                  Gastos {collectionId}
                </Title>
                <Text c="dimmed" mb={16}>
                  Colección de facturas del año fiscal
                </Text>
              </div>

              <Group>
                <Badge>Año: 2024</Badge>
                <Badge color="violet">
                  {invoices.filter((inv) => inv.percentage !== null).length}{' '}
                  analizadas
                </Badge>
                <Badge color="gray">
                  {invoices.filter((inv) => inv.percentage === null).length}{' '}
                  pendientes
                </Badge>
              </Group>

              <Group mt={12}>
                <Button color="violet" leftSection={<Upload size={18} />}>
                  Subir Facturas
                </Button>
                <Button color="violet" variant="light">
                  Analizar Colección
                </Button>
              </Group>
            </Stack>
          </Card>

          <div>
            <Title mb={16} order={2}>
              Facturas
            </Title>

            <Card padding="lg" radius="md" shadow="sm">
              <Table highlightOnHover striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Archivo</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Deducibilidad</Table.Th>
                    <Table.Th>Razonamiento</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </Card>
          </div>
        </Stack>
      </Container>
    </Box>
  )
}
