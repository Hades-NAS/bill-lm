import {
  Alert,
  Avatar,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogOut, TriangleAlert } from 'lucide-react'

import { signOutFromFirebase } from '#/integrations/firebase/auth'
import { getFirebaseAuth } from '#/integrations/firebase/firebase'
import { useTRPC } from '#/integrations/trpc/react'

import { useUserAuth } from '#/hooks/auth'

export const Route = createFileRoute('/(private)/account')({
  component: AccountPage,
})

function AccountPage() {
  const { primaryEmail } = useUserAuth()
  const navigate = useNavigate()
  const trpc = useTRPC()
  const removeAccount = useMutation(
    trpc.account.remove.mutationOptions({
      onSuccess: async () => {
        await signOutFromFirebase()
        navigate({ to: '/' })
      },
    }),
  )
  const firebaseUser = getFirebaseAuth().currentUser
  const name = firebaseUser?.displayName?.trim() || primaryEmail || 'Usuario'
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Container py="xl" size="sm">
      <Stack gap="xl">
        <div>
          <Title order={1}>Mi cuenta</Title>
          <Text c="dimmed">Revisa tu sesión y administra tus datos.</Text>
        </div>
        <Paper withBorder p="lg">
          <Stack align="center">
            <Avatar radius="xl" size={80} src={firebaseUser?.photoURL}>
              {initials}
            </Avatar>
            <Stack align="center" gap={2}>
              <Text fw={700}>{name}</Text>
              <Text c="dimmed" size="sm">
                {primaryEmail}
              </Text>
            </Stack>
          </Stack>
        </Paper>
        <Button
          leftSection={<LogOut size={18} />}
          variant="light"
          onClick={async () => {
            await signOutFromFirebase()
            navigate({ to: '/' })
          }}
        >
          Cerrar sesión
        </Button>
        <Divider />
        <Paper withBorder p="lg">
          <Stack>
            <Title c="red" order={3}>
              Zona de peligro
            </Title>
            <Alert color="red" icon={<TriangleAlert size={18} />}>
              Eliminar tu cuenta borrará de forma definitiva tus colecciones,
              facturas, perfiles, conexiones y referencias. Esta acción no se
              puede deshacer.
            </Alert>
            <Button
              color="red"
              loading={removeAccount.isPending}
              onClick={() =>
                modals.openConfirmModal({
                  title: '¿Eliminar tu cuenta?',
                  children: (
                    <Text size="sm">
                      Se eliminarán permanentemente todos tus datos de Bill-LM y
                      tu cuenta de acceso. Esta acción no se puede deshacer.
                    </Text>
                  ),
                  labels: { confirm: 'Eliminar cuenta', cancel: 'Cancelar' },
                  confirmProps: { color: 'red' },
                  onConfirm: () =>
                    removeAccount.mutate({ confirmation: 'ELIMINAR' }),
                })
              }
            >
              Eliminar mi cuenta
            </Button>
            {removeAccount.error && (
              <Alert color="red">
                No se pudo eliminar la cuenta. Intenta de nuevo.
              </Alert>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
