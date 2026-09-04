import { Alert, Box, Flex, Group, Modal, Text } from '@mantine/core'
import { FileWarningIcon } from 'lucide-react'
import React from 'react'

import { AddBillToCollectionSchema } from '#/schema/collections'

import { filesToBase64 } from '#/utils/file'
import { useIsMobile } from '#/utils/mobile'
import { notify } from '#/utils/notifications'
import { isLoadingMutation } from '#/utils/query'

import { useAppForm } from '#/hooks/app-form'
import {
  usePreprocessBillMutation,
  useUploadBillsMutation,
} from '#/hooks/mutation/bill'

import ConfModal from '#/components/shared/conf-modal'
import {
  ContextGuideButton,
  openContextGuide,
} from '#/components/shared/context-help'
import { DropzoneInput } from '#/components/shared/dropzone'

import type {
  AddBillToCollectionType,
  UploadBillsRequest,
} from '#/schema/collections'
import type { ModalPageProps } from '#/schema/page'

const defaultValues: AddBillToCollectionType = {
  collectionId: '',
  bills: [],
}

export type BillFormData = {
  collectionId: string
  personalIdNumber: string
  professionalIdNumber: string
}

const MAX_BILLS = 10

function openBillUploadGuide() {
  openContextGuide({
    title: 'Guía para subir facturas',
    introduction:
      'Sube los XML de comprobantes electrónicos que pertenecen a esta colección. El sistema los lee antes de guardarlos.',
    items: [
      {
        title: 'Archivo admitido',
        description:
          'Usa el XML original del comprobante electrónico. Una foto o PDF no contiene el mismo detalle estructurado.',
      },
      {
        title: 'Preprocesamiento',
        description:
          'El sistema extrae los datos principales y te avisa si un archivo no puede procesarse.',
      },
      {
        title: 'Límite',
        description: 'Puedes subir hasta diez facturas por vez.',
      },
    ],
  })
}

const BillAddForm = (props: ModalPageProps<BillFormData>) => {
  const {
    state: { opened, data },
    modal,
    size = 'lg',
    onSubmitted,
    onClose: outerOnClose,
  } = props

  const { collectionId, personalIdNumber, professionalIdNumber } = data || {}

  const [confirmExit, setConfirmExit] = React.useState(false)

  const isMobile = useIsMobile()

  const uploadBillsMutation = useUploadBillsMutation({
    onSuccess: () => {
      onSubmitted?.()
      form.reset()
    },
    onError: (error) => {
      console.error('Error uploading bills:', error)
    },
  })

  const preprocessBillMutation = usePreprocessBillMutation(
    {
      collectionId,
      personalIdNumber,
      professionalIdNumber,
    },
    {
      onSuccess: (result) => {
        const { bills, errors } = result
        form.setFieldValue('bills', bills)

        if (errors.length > 0) {
          notify.warn({
            title: 'Algunas facturas no se pudieron procesar',
            message: 'Revisar el mensaje de error para más detalles.',
          })
        }
      },
    },
  )

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: AddBillToCollectionSchema,
    },
    onSubmit: async ({ value }) => {
      if (!collectionId) {
        notify.error({
          title: 'Error al subir facturas',
          message:
            'No se ha especificado una colección válida. Por favor, intenta de nuevo.',
        })
        return
      }

      try {
        const billWithBuffer: UploadBillsRequest['bills'] = await filesToBase64(
          value.bills,
        )

        uploadBillsMutation.mutate({
          collectionId,
          bills: billWithBuffer,
        })
      } catch (error) {
        console.error('Error processing bills:', error)
        notify.error({
          title: 'Error al procesar facturas',
          message:
            'Ocurrió un error al procesar tus facturas. Por favor, intenta de nuevo.',
        })
      }
    },
    onSubmitInvalid: (errors) => {
      console.log(
        'Form submission failed with errors:',
        errors.formApi.getAllErrors(),
      )
    },
  })

  React.useEffect(() => {
    if (!opened) {
      form.reset()
      preprocessBillMutation.reset()
      return
    }
  }, [opened, data, form])

  const isLoading = isLoadingMutation(uploadBillsMutation)

  const Content = React.useMemo(
    () => (
      <Box>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <Flex direction="column" gap="md">
            {preprocessBillMutation.data?.errors &&
              preprocessBillMutation.data.errors.length > 0 && (
                <Alert
                  color="yellow"
                  icon={<FileWarningIcon />}
                  title="Algunas facturas no se pudieron procesar"
                  variant="light"
                >
                  {preprocessBillMutation.data.errors.map(
                    ({ file, error }, index) => (
                      <Text key={index} mt="sm" size="sm">
                        <Text span fw={500}>
                          {file.name}:
                        </Text>{' '}
                        {error}
                      </Text>
                    ),
                  )}
                </Alert>
              )}
            <form.AppField
              children={(field) => (
                <DropzoneInput
                  accept={['text/xml']}
                  disabled={isLoading || field.state.value.length >= MAX_BILLS}
                  files={field.state.value}
                  loading={preprocessBillMutation.isPending}
                  maxFiles={MAX_BILLS}
                  onDrop={(files) => {
                    preprocessBillMutation.mutate(files)
                  }}
                  onRemove={(index) => {
                    const newFiles = [...field.state.value]
                    newFiles.splice(index, 1)
                    field.handleChange(newFiles)
                  }}
                />
              )}
              mode="array"
              name="bills"
            />
            <Box className="bill-lm-modal-actions">
              <form.SubmitButton
                fullWidth
                disabled={isLoading}
                loading={isLoading}
              >
                Subir facturas
              </form.SubmitButton>
            </Box>
          </Flex>
        </form>
      </Box>
    ),
    [
      isLoading,
      form.state.errors,
      collectionId,
      preprocessBillMutation.data,
      preprocessBillMutation.isPending,
    ],
  )

  if (modal) {
    return (
      <Modal
        centered
        fullScreen={isMobile}
        opened={Boolean(opened)}
        size={size}
        title={
          <Group gap="xs">
            <Text fw="bolder" size="lg">
              Agregar facturas
            </Text>
            <ContextGuideButton
              title="subir facturas"
              onClick={openBillUploadGuide}
            />
          </Group>
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
            Has realizado cambios, ¿Deseas cerrarlo y descartar los cambios?
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

export default BillAddForm
