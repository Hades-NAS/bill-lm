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
import {
  ContextGuideButton,
  FieldHelpLabel,
  openContextGuide,
} from '#/components/shared/context-help'

import type { CollectionBaseType } from '#/integrations/trpc/procedures/collections'
import type {
  CreateCollectionType,
  UpdateCollectionType,
} from '#/schema/collections'
import type { ModalPageProps } from '#/schema/page'

const defaultValues: CreateCollectionType = {
  name: '',
  description: '',
  year: DateTime.now().year,
}

function openCollectionFormGuide() {
  openContextGuide({
    title: 'Guía de la colección',
    introduction:
      'Una colección reúne facturas de un período o propósito. Después podrás definir el contexto tributario y analizar sus documentos.',
    items: [
      {
        title: 'Nombre y descripción',
        description:
          'Usa un nombre que identifique el período o el uso de las facturas.',
        example: 'Facturas de septiembre de 2026.',
      },
      {
        title: 'Año',
        description:
          'Sirve como referencia para organizar la colección. El contexto de análisis define las fechas exactas.',
      },
      {
        title: 'Contexto tributario',
        description:
          'Después de crear la colección, selecciona un perfil y sus actividades en Contexto. Esa revisión aporta los identificadores y hechos tributarios.',
      },
    ],
  })
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
                    label={
                      <FieldHelpLabel
                        hint="Usa un nombre que reconocerás al buscar o analizar esta colección."
                        label="Nombre"
                      />
                    }
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
                    label={
                      <FieldHelpLabel
                        hint="Resume qué facturas reúne la colección y para qué período o uso la creaste."
                        label="Descripción"
                      />
                    }
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
                    label={
                      <FieldHelpLabel
                        hint="Organiza la colección por año. El contexto de análisis define el rango exacto de fechas."
                        label="Año"
                      />
                    }
                    placeholder="Ingrese el año"
                    typeInput="number"
                    onChange={(value) => field.handleChange(value)}
                  />
                )}
                name="year"
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
          <Flex align="center" gap="xs">
            <Text fw="bolder" size="lg">
              {data ? 'Editar colección' : 'Crear colección'}
            </Text>
            <ContextGuideButton
              title="este formulario"
              onClick={openCollectionFormGuide}
            />
          </Flex>
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
