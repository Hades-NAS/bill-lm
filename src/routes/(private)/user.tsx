import { createFileRoute } from '@tanstack/react-router'
import { Container, Title, Text, Stack, Box } from '@mantine/core'

export const Route = createFileRoute('/(private)/user')({
  component: UserPage,
})

function UserPage() {
  return (
    <Box py={40}>
      <Container size="md">
        <Stack gap={24}>
          <div>
            <Title order={1} mb={8}>
              Configuración de Perfil
            </Title>
            <Text c="dimmed">
              Panel de configuración del usuario - Dummy placeholder
            </Text>
          </div>

          <div style={{ padding: '24px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <Text>
              Aquí irá la configuración del perfil del usuario con opciones como:
              cambiar nombre, email, página, etc.
            </Text>
          </div>
        </Stack>
      </Container>
    </Box>
  )
}
