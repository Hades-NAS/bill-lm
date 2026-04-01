import { ActionIcon, useMantineColorScheme } from '@mantine/core'
import { MoonStar, Sun } from 'lucide-react'

import { useIsMobile } from '#/utils/mobile'

const NavbarThemeIcon = () => {
  const isMobile = useIsMobile()

  const { toggleColorScheme, colorScheme } = useMantineColorScheme()

  return (
    <ActionIcon
      aria-label="Cambiar tema"
      radius="md"
      size={isMobile ? 'md' : 'lg'}
      variant="default"
      onClick={() => toggleColorScheme()}
    >
      {colorScheme === 'dark' ? (
        <Sun size={isMobile ? 16 : 20} />
      ) : (
        <MoonStar size={isMobile ? 16 : 20} />
      )}
    </ActionIcon>
  )
}

export default NavbarThemeIcon
