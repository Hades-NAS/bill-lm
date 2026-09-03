import { ActionIcon, Divider, Menu, Tooltip } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { LibraryBig, LogOutIcon, Settings, Telescope, User } from 'lucide-react'

import { signOutFromFirebase } from '#/integrations/firebase/auth'

import { useUserAuth } from '#/hooks/auth'

const NavbarUserIcon = () => {
  const { primaryEmail } = useUserAuth()
  const navigate = useNavigate()

  return (
    <Menu shadow="md" width={200}>
        <Menu.Target>
          <Tooltip
            label={primaryEmail || 'Usuario'}
            openDelay={500}
            position="left"
          >
            <ActionIcon
              aria-label="Menú de usuario"
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
          <Menu.Item
            leftSection={<Settings size={18} />}
            onClick={() => navigate({ to: '/user' })}
          >
            Configuración
          </Menu.Item>
          <Divider />
          <Menu.Item
            leftSection={<LogOutIcon color="red" size={18} />}
            onClick={async () => {
              await signOutFromFirebase()
              navigate({ to: '/' })
            }}
          >
            Cerrar sesión
          </Menu.Item>
        </Menu.Dropdown>
    </Menu>
  )
}

export default NavbarUserIcon
