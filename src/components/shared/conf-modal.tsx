import { Button, Group, Modal } from '@mantine/core'

type ConfModalProps = {
  title: string
  children: React.ReactNode
  opened: boolean
  confirmColor?: string
  confirmText?: string
  cancelColor?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ConfModal = (props: ConfModalProps) => {
  const {
    title,
    opened,
    children,
    cancelColor,
    confirmColor,
    confirmText,
    cancelText,
    onConfirm,
    loading,
    onCancel,
  } = props
  return (
    <Modal centered opened={opened} size="lg" title={title} onClose={onCancel}>
      <div className="cd-mb-[1rem]">{children}</div>
      <Group justify="flex-end">
        <Button color={cancelColor ?? 'gray'} onClick={onCancel}>
          {cancelText ?? 'Cancelar'}
        </Button>
        <Button
          color={confirmColor ?? 'red'}
          loaderProps={{ type: 'dots' }}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmText ?? 'Confirmar'}
        </Button>
      </Group>
    </Modal>
  )
}

export default ConfModal
