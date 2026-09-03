import { Box, Container, Paper, Stack, Text, Title } from '@mantine/core'

import type { ReactNode } from 'react'

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Box bg="gray.0" mih="100vh" py={{ base: 'xl', sm: 72 }}>
      <Container px="md" size={460}>
        <Paper withBorder p={{ base: 'lg', sm: 'xl' }} radius="lg" shadow="sm">
          <Stack gap="xl">
            <Stack gap={6}>
              <Text c="violet" fw={700} size="sm" tt="uppercase">
                {eyebrow}
              </Text>
              <Title order={1} size="h2">
                {title}
              </Title>
              <Text c="dimmed" size="sm">
                {description}
              </Text>
            </Stack>
            {children}
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}
