import { SignUp } from '@clerk/clerk-react'
import { Box, Center, Container, Paper } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(public)/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <Box bg="gray.0" min-h="100vh" py={40}>
      <Container size="sm">
        <Center>
          <Paper p="xl" radius="md" shadow="sm">
            <SignUp />
          </Paper>
        </Center>
      </Container>
    </Box>
  )
}
