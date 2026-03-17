import { Center, Stack, Text, Title } from '@mantine/core'

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <Center>
      <Stack>
        <Title>Welcome to TanStack Start Starter!</Title>

        <Text>
          This is the home page. Use the navigation links to explore the app and
          see examples of TanStack Router, React Query, TRPC, Prisma, and more.
        </Text>
      </Stack>
    </Center>
  )
}
