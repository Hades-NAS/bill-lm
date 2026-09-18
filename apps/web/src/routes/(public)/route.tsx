import { AppShell, Badge, Group, Transition } from '@mantine/core'
import { useWindowScroll } from '@mantine/hooks'
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

  const [scroll] = useWindowScroll()

  const isMobile = useIsMobile()

  return (
    <AppShell
      header={{ height: isMobile ? 50 : 60 }}
      padding="md"
    >
      <AppShell.Header bd={0} bg={scroll.y < 80 ? 'transparent' : 'violet.6'}>
        <Group h="100%" justify="flex-end" px="md">
          <Transition duration={300} mounted={scroll.y > 80} transition="fade">
            {(styles) => (
              <Badge
                bd="1px solid var(--bill-lm-brand)"
                bg="white"
                c="dark"
                color="violet"
                size="lg"
                style={{
                  ...styles,
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
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
      <AppShell.Main m={0} p={0}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
