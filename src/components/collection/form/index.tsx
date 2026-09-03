import { Box, Fieldset, Flex, Modal, Text } from '@mantine/core'
import { DateTime } from 'luxon'
import React from 'react'

import { CreateCollectionSchema } from '#/schema/collections'

import { useIsMobile } from '#/utils/mobile'
import { isLoadingMutation } from '#/utils/query'

import { useAppForm } from '#/hooks/app-form'
import {
  useCollectionCreateMutation,
  useCollectionUpdateMutation,
} from '#/hooks/mutation/collection'

import ConfModal from '#/components/shared/conf-modal'

import type { CollectionBaseType } from '#/integrations/trpc/procedures/collections'
import type {
  CreateCollectionType,
  UpdateCollectionType,
} from '#/schema/collections'
import type { ModalPageProps } from '#/schema/page'

const defaultValues: CreateCollectionType = {
  name: '',
  description: '',
  instructions: '',
  personalIdNumber: '',
  professionalIdNumber: '',
  year: DateTime.now().year,
}

const CollectionForm = (
  props: ModalPageProps<
    CollectionBaseType,
    CreateCollectionType | UpdateCollectionType
  >,
) => {
  const {
    state: { opened, data },
    modal,
    size = 'lg',
    onSubmitted,
    onClose: outerOnClose,
  } = props

  const [confirmExit, setConfirmExit] = React.useState(false)

  const isMobile = useIsMobile()

  const collectionCreateMutation = useCollectionCreateMutation({
    onSuccess: (_data) => {
      onSubmitted?.(_data)
      onClose()
    },
  })
  const collectionUpdateMutation = useCollectionUpdateMutation({
    onSuccess: (_data) => {
      onSubmitted?.(_data)
      onClose()
    },
  })

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: CreateCollectionSchema,
    },
    onSubmit: ({ value }) => {
      if (data?.id) {
        collectionUpdateMutation.mutate({
          ...value,
          id: data.id,
        })
      } else {
        collectionCreateMutation.mutate(value)
      }
    },
    onSubmitInvalid: (errors) => {
      console.log('Form submission failed with errors:', errors)
    },
  })

  const isLoading = isLoadingMutation(
    collectionCreateMutation,
    collectionUpdateMutation,
  )

  React.useLayoutEffect(() => {
    if (data) {
      form.reset({
        name: data.name,
        description: data.description || '',
        instructions: data.instructions || '',
        personalIdNumber: data.personalIdNumber || '',
        professionalIdNumber: data.professionalIdNumber || '',
        year: data.year,
      })
    } else {
      form.reset()
    }
  }, [data, form])

  const Content = React.useMemo(
    () => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <Flex direction="column" gap="md">
          <Fieldset legend="Información de la colección">
            <Flex direction="column" gap="sm">
              <form.AppField
                children={(field) => (
                  <field.Input
                    label="Nombre"
                    placeholder="Ingrese el nombre de la colección"
                    typeInput="text"
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
                name="name"
              />

              <form.AppField
                children={(field) => (
                  <field.Input
                    label="Descripción"
                    placeholder="Ingrese una descripción"
                    typeInput="textarea"
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
                name="description"
              />

              <form.AppField
                children={(field) => (
                  <field.Input
                    label="Año"
                    placeholder="Ingrese el año"
                    typeInput="number"
                    onChange={(value) => field.handleChange(value)}
                  />
                )}
                name="year"
              />
            </Flex>
          </Fieldset>

          <Fieldset legend="Información fiscal">
            <Flex direction="column" gap="sm">
              <Flex direction={isMobile ? 'column' : 'row'} gap="sm">
                <form.AppField
                  children={(field) => (
                    <field.Input
                      label="Cédula"
                      maxLength={10}
                      placeholder="Cédula personal"
                      style={{ flex: 1 }}
                      typeInput="text"
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                  name="personalIdNumber"
                />

                <form.AppField
                  children={(field) => (
                    <field.Input
                      label="RUC (opcional)"
                      maxLength={13}
                      placeholder="RUC profesional"
                      style={{ flex: 1 }}
                      typeInput="text"
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  )}
                  name="professionalIdNumber"
                />
              </Flex>

              <form.AppField
                children={(field) => (
                  <field.Input
                    autosize
                    label="Instrucciones (opcional)"
                    minRows={4}
                    placeholder="Instrucciones para facturas emitidas a RUC"
                    typeInput="textarea"
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
                name="instructions"
              />
            </Flex>
          </Fieldset>
          <Box className="bill-lm-modal-actions">
            <form.AppForm>
              <form.SubmitButton loading={isLoading} mt="md">
                {data ? 'Actualizar colección' : 'Crear colección'}
              </form.SubmitButton>
            </form.AppForm>
          </Box>
        </Flex>
      </form>
    ),
    [data, isLoading],
  )

  if (modal) {
    return (
      <Modal
        centered
        fullScreen={isMobile}
        opened={Boolean(opened)}
        size={size}
        title={
          <Text fw="bolder" size="lg">
            {data ? 'Editar colección' : 'Crear colección'}
          </Text>
        }
        onClose={() => {
          if (form.state.isDirty) {
            setConfirmExit(true)
          } else {
            onClose()
          }
        }}
      >
        {Content}
        <ConfModal
          cancelColor="gray"
          cancelText="Cancelar"
          confirmColor="red"
          confirmText="Descartar"
          opened={confirmExit}
          title="Descartar cambios"
          onCancel={() => setConfirmExit(false)}
          onConfirm={onClose}
        >
          <Text>
            Has realizado cambios en el formulario, ¿Deseas cerrarlo y descartar
            los cambios?
          </Text>
        </ConfModal>
      </Modal>
    )
  }

  return Content

  function onClose() {
    form.reset()
    setConfirmExit(false)
    outerOnClose?.()
  }
}

export default CollectionForm
