import { Box, Flex, Modal, Text } from '@mantine/core'
import React from 'react'

import { AddBillToCollectionSchema } from '#/schema/collections'

import { parseAndValidateInvoiceXML } from '#/integrations/xml'

import { filesToBase64 } from '#/utils/file'
import { useIsMobile } from '#/utils/mobile'
import { notify } from '#/utils/notifications'
import { isLoadingMutation } from '#/utils/query'

import { useAppForm } from '#/hooks/app-form'
import { useUserAuth } from '#/hooks/auth'
import { useUploadBillsMutation } from '#/hooks/mutation/bill'

import ConfModal from '#/components/shared/conf-modal'
import { DropzoneInput } from '#/components/shared/dropzone'

import type { Factura } from '#/schema/bill'
import type {
  AddBillToCollectionType,
  UploadBillsRequest,
} from '#/schema/collections'
import type { ModalPageProps } from '#/schema/page'
import type { FileWithPath } from '@mantine/dropzone'

const defaultValues: AddBillToCollectionType = {
  collectionId: '',
  bills: [],
}

type BillFormData = {
  collectionId: string
  personalIdNumber: string
  professionalIdNumber: string
}

const MAX_BILLS = 10

const BillAddForm = (props: ModalPageProps<BillFormData>) => {
  const {
    state: { opened, data },
    modal,
    size = 'lg',
    onSubmitted,
    onClose: outerOnClose,
  } = props

  const [confirmExit, setConfirmExit] = React.useState(false)

  const isMobile = useIsMobile()

  const [processing, setProcessing] = React.useState(false)

  const auth = useUserAuth()

  const uploadBillsMutation = useUploadBillsMutation({
    onSuccess: () => {
      onSubmitted?.()
      form.reset()
    },
    onError: (error) => {
      console.error('Error uploading bills:', error)
    },
  })

  const { collectionId, personalIdNumber, professionalIdNumber } = data || {}

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
          auth,
          data: {
            collectionId: collectionId,
            bills: billWithBuffer,
          },
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
            <form.AppField
              children={(field) => (
                <DropzoneInput
                  accept={['text/xml']}
                  disabled={isLoading || field.state.value.length >= MAX_BILLS}
                  files={field.state.value}
                  loading={processing}
                  maxFiles={MAX_BILLS}
                  onDrop={(files) => {
                    setProcessing(true)
                    preProcessBills(files)
                      .then((result) => {
                        if (!result) {
                          notify.error({
                            title: 'Error al subir facturas',
                            message:
                              'Una o más facturas no coinciden con el número de cédula o RUC proporcionado. Por favor, verifica tus archivos e intenta de nuevo.',
                          })
                          return
                        }
                        field.setValue([...field.state.value, ...files])
                      })
                      .then(() => setProcessing(false))
                      .catch((error) => {
                        console.error('Error pre-processing bills:', error)
                        notify.error({
                          title: 'Error al procesar facturas',
                          message:
                            'Ocurrió un error al procesar tus facturas. Por favor, intenta de nuevo.',
                        })
                        setProcessing(false)
                      })
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
            <form.SubmitButton
              fullWidth
              disabled={isLoading}
              loading={isLoading}
            >
              Subir facturas
            </form.SubmitButton>
          </Flex>
        </form>
      </Box>
    ),
    [isLoading, form.state.errors, collectionId],
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
            Agregar facturas
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
            Has realizado cambios, ¿Deseas cerrarlo y descartar los cambios?
          </Text>
        </ConfModal>
      </Modal>
    )
  }

  return Content

  async function preProcessBills(bills: Array<FileWithPath>) {
    if (!personalIdNumber) {
      notify.error({
        title: 'Número de cédula requerido',
        message:
          'Por favor, proporciona un número de cédula para validar las facturas.',
      })
      return false
    }

    const billsData: Array<Factura> = []

    for (const billFile of bills) {
      const buffer = await billFile.arrayBuffer()
      const bill = parseAndValidateInvoiceXML(Buffer.from(buffer))

      if (!bill.success) {
        console.error('Error parsing bill XML:', bill.error)
        continue
      }

      billsData.push(bill.data.factura)
    }

    return billsData.every((bill) => {
      const idBuyer = bill.infoFactura.identificacionComprador.trim() || ''

      if (idBuyer.length === 10) {
        return idBuyer === personalIdNumber
      }
      if (idBuyer.length === 13) {
        return idBuyer === professionalIdNumber
      }
      return false
    })
  }

  function onClose() {
    form.reset()
    setConfirmExit(false)
    outerOnClose?.()
  }
}

export default BillAddForm
