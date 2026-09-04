import { AppShell, Center, Container, Group, Loader, NavLink, Stack, Text } from '@mantine/core'
// import { useDisclosure } from '@mantine/hooks'
import { Navigate, createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { BriefcaseBusiness, LibraryBig, Settings, User } from 'lucide-react'

import { useIsMobile } from '#/utils/mobile'

import { useUserAuth } from '#/hooks/auth'
import { useJobsSubscriptionManager } from '#/hooks/use-jobs-subscription-manager'

import { NavbarJobsIndicator } from '#/components/navbar-jobs-indicator'
import NavbarThemeIcon from '#/components/navbar-theme-icon'

export const Route = createFileRoute('/(private)')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoaded, isSignedIn, isEmailVerified } = useUserAuth()
  useJobsSubscriptionManager()
  // const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  // const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false)

  const isMobile = useIsMobile()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

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
        collapsed: { mobile: true, desktop: false },
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
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <NavLink component={Link} to="/collections" active={pathname.startsWith('/collections')} label="Colecciones" leftSection={<LibraryBig size={18} />} />
          <NavLink component={Link} to="/profiles" active={pathname === '/profiles'} label="Perfiles y actividades" leftSection={<BriefcaseBusiness size={18} />} />
          <NavLink component={Link} to="/user" active={pathname === '/user'} label="Configuración" leftSection={<Settings size={18} />} />
          <NavLink component={Link} to="/account" active={pathname === '/account'} label="Mi cuenta" leftSection={<User size={18} />} />
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <Container fluid={isMobile} px={0} py="md" size="xl">
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
