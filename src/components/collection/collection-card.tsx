import {
  ActionIcon,
  Box,
  Card,
  Divider,
  Flex,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNavigate } from '@tanstack/react-router'
import { Calendar, ExternalLink, Files, Trash } from 'lucide-react'

import { useCollectionDeleteMutation } from '#/hooks/mutation/collection'

import ConfModal from '../shared/conf-modal'
import TextWithIcon from '../shared/text-icon'

import type { CollectionBaseType } from '#/integrations/trpc/procedures/collections'

type Props = {
  data: CollectionBaseType
}

export const CollectionCard = (props: Props) => {
  const { data } = props

  const [confirmDelete, handlers] = useDisclosure(false)

  const navigate = useNavigate()
  const deleteCollectionMutation = useCollectionDeleteMutation({
    onSuccess: () => {
      handlers.close()
    },
  })

  return (
    <Card withBorder key={data.id} padding={0} radius="md" shadow="sm">
      <Stack gap={12}>
        <Flex direction="row" gap={4} justify="space-between" pt="md" px="md">
          <Box>
            <Title mb={4} order={4} size={18}>
              {data.name}
            </Title>
          </Box>

          <Flex align="center" direction="row" gap={8}>
            <Tooltip label="Abrir colección">
              <ActionIcon
                aria-label="Abrir colección"
                color="violet"
                variant="light"
                onClick={() => {
                  navigate({
                    to: `/collections/$id`,
                    params: { id: data.id },
                  })
                }}
              >
                <ExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Archivar colección">
              <ActionIcon
                aria-label="Archivar colección"
                color="red"
                disabled={deleteCollectionMutation.isPending}
                variant="light"
                onClick={() => {
                  handlers.open()
                }}
              >
                <Trash size={16} />
              </ActionIcon>
            </Tooltip>

            <ConfModal
              confirmColor="red"
              confirmText="Archivar colección"
              consequence="La colección dejará de mostrarse, pero se conservarán sus facturas, contexto y resultados."
              loading={deleteCollectionMutation.isPending}
              opened={confirmDelete}
              title="Archivar colección"
              variant="destructive"
              onCancel={() => {
                handlers.close()
              }}
              onConfirm={() => {
                deleteCollectionMutation.mutate({ id: data.id })
              }}
            >
              <Text>
                Se archivará la colección <b>{data.name}</b>. Ya no aparecerá en
                tu lista, pero su historial quedará conservado.
              </Text>
            </ConfModal>
          </Flex>
        </Flex>

        <Divider my={0} />

        <Flex direction="column" gap="xs" pb="md" px="md">
          <TextWithIcon>
            <TextWithIcon.Icon size="xs">
              <Calendar />
            </TextWithIcon.Icon>
            <TextWithIcon.Text c="gray" size="md">
              {data.year}
            </TextWithIcon.Text>
          </TextWithIcon>

          <TextWithIcon>
            <TextWithIcon.Icon size="xs">
              <Files />
            </TextWithIcon.Icon>
            <TextWithIcon.Text c="gray" size="md">
              {data._count.bills > 0
                ? `${data._count.bills} factura${data._count.bills > 1 ? 's' : ''}`
                : 'Sin facturas'}
            </TextWithIcon.Text>
          </TextWithIcon>
        </Flex>
      </Stack>
    </Card>
  )
}
