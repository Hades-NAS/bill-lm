import { ActionIcon, Divider, Menu, Tooltip } from '@mantine/core'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BriefcaseBusiness,
  LibraryBig,
  LogOutIcon,
  Settings,
  Telescope,
  User,
} from 'lucide-react'

import { signOutFromFirebase } from '#/integrations/firebase/auth'

import { useUserAuth } from '#/hooks/auth'

const NavbarUserIcon = () => {
  const { primaryEmail } = useUserAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

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
        <Menu.Label>Trabajo</Menu.Label>
        <Menu.Item
          fw={pathname.startsWith('/collections') ? 700 : undefined}
          leftSection={<LibraryBig size={18} />}
          onClick={() => navigate({ to: '/collections' })}
        >
          Colecciones
        </Menu.Item>
        <Menu.Item
          fw={pathname.startsWith('/jobs') ? 700 : undefined}
          leftSection={<Telescope size={18} />}
          onClick={() => navigate({ to: '/jobs' })}
        >
          Trabajos
        </Menu.Item>
        <Menu.Label>Cuenta</Menu.Label>
        <Menu.Item
          fw={pathname === '/profiles' ? 700 : undefined}
          leftSection={<BriefcaseBusiness size={18} />}
          onClick={() => navigate({ to: '/profiles' })}
        >
          Perfiles y actividades
        </Menu.Item>
        <Menu.Item
          fw={pathname === '/user' ? 700 : undefined}
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
