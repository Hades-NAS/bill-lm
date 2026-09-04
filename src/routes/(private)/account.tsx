import { Alert, Avatar, Button, Container, Divider, Paper, Stack, Text, Title } from '@mantine/core'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogOut, TriangleAlert } from 'lucide-react'

import { signOutFromFirebase } from '#/integrations/firebase/auth'
import { getFirebaseAuth } from '#/integrations/firebase/firebase'
import { useUserAuth } from '#/hooks/auth'

export const Route = createFileRoute('/(private)/account')({ component: AccountPage })

function AccountPage() {
  const { primaryEmail } = useUserAuth()
  const navigate = useNavigate()
  const firebaseUser = getFirebaseAuth().currentUser
  const name = firebaseUser?.displayName?.trim() || primaryEmail || 'Usuario'
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return <Container size="sm" py="xl"><Stack gap="xl">
    <div><Title order={1}>Mi cuenta</Title><Text c="dimmed">Revisa tu sesión y administra tus datos.</Text></div>
    <Paper withBorder p="lg"><Stack align="center"><Avatar size={80} src={firebaseUser?.photoURL} radius="xl">{initials}</Avatar><Stack align="center" gap={2}><Text fw={700}>{name}</Text><Text c="dimmed" size="sm">{primaryEmail}</Text></Stack></Stack></Paper>
    <Button leftSection={<LogOut size={18} />} variant="light" onClick={async () => { await signOutFromFirebase(); navigate({ to: '/' }) }}>Cerrar sesión</Button>
    <Divider />
    <Paper withBorder p="lg"><Stack><Title c="red" order={3}>Zona de peligro</Title><Alert color="red" icon={<TriangleAlert size={18} />}>Eliminar tu cuenta borrará de forma definitiva tus colecciones, facturas, perfiles, conexiones y referencias. La acción estará disponible cuando el borrado transaccional de servidor esté terminado.</Alert><Button color="red" disabled>Eliminar mi cuenta</Button></Stack></Paper>
  </Stack></Container>
}
