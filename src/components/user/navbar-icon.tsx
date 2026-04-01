import { useClerk, useUser } from '@clerk/clerk-react'
import { ActionIcon, Divider, Menu, Tooltip } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { LibraryBig, LogOutIcon, Telescope, User } from 'lucide-react'

import { useIsMobile } from '#/utils/mobile'

const NavbarUserIcon = () => {
  const { user } = useUser()
  const { signOut } = useClerk()
  const navigate = useNavigate()

  const isMobile = useIsMobile()

  // Desktop: Popover
  if (!isMobile) {
    return (
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Tooltip
            label={user?.firstName || 'Usuario'}
            openDelay={500}
            position="left"
          >
            <ActionIcon
              aria-label="Ver análisis"
              radius="md"
              size="lg"
              variant="default"
            >
              <User size={20} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Secciones</Menu.Label>
          <Menu.Item
            leftSection={<Telescope size={18} />}
            onClick={() => navigate({ to: '/jobs' })}
          >
            Telemetría
          </Menu.Item>
          <Menu.Item
            leftSection={<LibraryBig size={18} />}
            onClick={() => navigate({ to: '/collections' })}
          >
            Colecciones
          </Menu.Item>
          <Divider />
          <Menu.Item
            leftSection={<LogOutIcon color="red" size={18} />}
            onClick={() => signOut({ redirectUrl: '/' })}
          >
            Cerrar sesión
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    )
  }
}

export default NavbarUserIcon
