import { ActionIcon, useMantineColorScheme } from '@mantine/core'
import { MoonStar, Sun } from 'lucide-react'

const NavbarThemeIcon = () => {
  const { toggleColorScheme, colorScheme } = useMantineColorScheme()

  return (
    <ActionIcon
      aria-label="Cambiar tema"
      radius="md"
      size="lg"
      variant="default"
      onClick={() => toggleColorScheme()}
    >
      {colorScheme === 'dark' ? <Sun size={20} /> : <MoonStar size={20} />}
    </ActionIcon>
  )
}

export default NavbarThemeIcon
