import { AppShell, Badge, Burger, Group, Transition } from '@mantine/core'
import { useDisclosure, useWindowScroll } from '@mantine/hooks'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { useIsMobile } from '#/utils/mobile'

import { useUserAuth } from '#/hooks/auth'

import NavbarThemeIcon from '#/components/navbar-theme-icon'
import NavbarUserIcon from '#/components/user/navbar-icon'

export const Route = createFileRoute('/(public)')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isSignedIn } = useUserAuth()

  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false)

  const [scroll] = useWindowScroll()

  const isMobile = useIsMobile()

  return (
    <AppShell
      header={{ height: isMobile ? 50 : 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header bd={0} bg={scroll.y < 80 ? 'transparent' : 'violet.6'}>
        <Group h="100%" justify="space-between" px="md">
          <Group bdrs={6} bg="violet.6" px={4} py={4}>
            <Burger
              color="white"
              hiddenFrom={isMobile ? 'xs' : 'sm'}
              opened={mobileOpened}
              size="sm"
              onClick={toggleMobile}
            />
            <Burger
              color="white"
              opened={desktopOpened}
              size={isMobile ? 'xs' : 'sm'}
              visibleFrom="sm"
              onClick={toggleDesktop}
            />
          </Group>

          <Transition duration={300} mounted={scroll.y > 80} transition="fade">
            {(styles) => (
              <Badge
                bd="1px solid #7c3aed"
                bg="white"
                c="dark"
                color="violet"
                size="lg"
                style={styles}
                variant="dot"
              >
                Bill-LM
              </Badge>
            )}
          </Transition>

          <Group gap="xs">
            <NavbarThemeIcon />
            {isSignedIn && <NavbarUserIcon />}
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md"></AppShell.Navbar>
      <AppShell.Main m={0} p={0}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
