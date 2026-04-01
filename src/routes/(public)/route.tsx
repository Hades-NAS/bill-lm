import { AppShell, Group } from '@mantine/core'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { useUserAuth } from '#/hooks/auth'

import NavbarThemeIcon from '#/components/navbar-theme-icon'
import NavbarUserIcon from '#/components/user/navbar-icon'

export const Route = createFileRoute('/(public)')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isSignedIn } = useUserAuth()
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
      <AppShell.Header bd={0} bg="violet.6">
        <Group h="100%" justify="flex-end" px="md">
          <Group gap="xs">
            <NavbarThemeIcon />
            {isSignedIn && <NavbarUserIcon />}
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md"></AppShell.Navbar>
      <AppShell.Main m={0} mt="md" p={0}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
