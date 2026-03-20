import { Container } from '@mantine/core'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { useIsMobile } from '#/utils/mobile'

export const Route = createFileRoute('/(private)')({
  component: RouteComponent,
})

function RouteComponent() {
  const isMobile = useIsMobile()

  return (
    <Container fluid={isMobile} px={0} py={40} size="xl">
      <Outlet />
    </Container>
  )
}
