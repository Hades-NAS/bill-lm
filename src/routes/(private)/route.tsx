import { Container } from '@mantine/core'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(private)')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Container py={40} size="lg">
      <Outlet />
    </Container>
  )
}
