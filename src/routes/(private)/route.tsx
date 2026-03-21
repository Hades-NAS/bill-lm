import { AppShell, Burger, Container, Group, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { useIsMobile } from '#/utils/mobile'

import { NavbarJobsIndicator } from '#/components/navbar-jobs-indicator'

export const Route = createFileRoute('/(private)')({
  component: RouteComponent,
})

function RouteComponent() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false)

  const isMobile = useIsMobile()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" justify="space-between" px="md">
          <Group>
            <Burger
              hiddenFrom="sm"
              opened={mobileOpened}
              size="sm"
              onClick={toggleMobile}
            />
            <Burger
              opened={desktopOpened}
              size="sm"
              visibleFrom="sm"
              onClick={toggleDesktop}
            />
            <Text fw="bolder" size="xl">
              Bill-
              <Text inherit span c="violet" fw="bolder">
                LM
              </Text>
            </Text>
          </Group>

          <Group gap="xs">
            <NavbarJobsIndicator />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md"></AppShell.Navbar>
      <AppShell.Main>
        <Container fluid={isMobile} px={0} py="md" size="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
