import { AppShell, Center, Container, Group, Loader, Text } from '@mantine/core'
// import { useDisclosure } from '@mantine/hooks'
import { Navigate, createFileRoute, Link, Outlet } from '@tanstack/react-router'

import { useIsMobile } from '#/utils/mobile'

import { useJobsSubscriptionManager } from '#/hooks/use-jobs-subscription-manager'
import { useUserAuth } from '#/hooks/auth'

import { NavbarJobsIndicator } from '#/components/navbar-jobs-indicator'
import NavbarThemeIcon from '#/components/navbar-theme-icon'
import NavbarUserIcon from '#/components/user/navbar-icon'

export const Route = createFileRoute('/(private)')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoaded, isSignedIn, isEmailVerified } = useUserAuth()
  useJobsSubscriptionManager()
  // const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  // const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false)

  const isMobile = useIsMobile()

  if (!isLoaded) {
    return (
      <Center mih="100vh">
        <Loader aria-label="Comprobando sesión" />
      </Center>
    )
  }

  if (!isSignedIn || !isEmailVerified) {
    return <Navigate replace to="/sign-in" />
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: true, desktop: true },
        // collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" justify="space-between" px="md">
          <Group>
            {/* <Burger
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
            /> */}
            <Link to="/collections">
              <Text fw="bolder" size="xl">
                Bill-
                <Text inherit span c="violet" fw="bolder">
                  LM
                </Text>
              </Text>
            </Link>
          </Group>

          <Group gap="xs">
            <NavbarThemeIcon />
            <NavbarJobsIndicator />
            <NavbarUserIcon />
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
