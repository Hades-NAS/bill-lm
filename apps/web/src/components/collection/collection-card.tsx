import { Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNavigate } from '@tanstack/react-router'
import { CollectionCardPresentation } from '@bill-lm/ui'

import { useCollectionDeleteMutation } from '#/hooks/mutation/collection'

import ConfModal from '../shared/conf-modal'
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
    <>
      <CollectionCardPresentation
        archiveDisabled={deleteCollectionMutation.isPending}
        invoiceCount={data._count.bills}
        name={data.name}
        year={data.year}
        onArchive={handlers.open}
        onOpen={() => navigate({ to: '/collections/$id', params: { id: data.id } })}
      />
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
        <Text>Se archivará la colección <b>{data.name}</b>. Ya no aparecerá en tu lista, pero su historial quedará conservado.</Text>
      </ConfModal>
    </>
  )
}
