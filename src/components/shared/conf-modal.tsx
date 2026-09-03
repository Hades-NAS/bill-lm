import { Button, Group, Modal, Text } from '@mantine/core'

type ConfModalProps = {
  title: string
  children: React.ReactNode
  opened: boolean
  confirmColor?: string
  confirmText?: string
  cancelColor?: string
  cancelText?: string
  loading?: boolean
  consequence?: React.ReactNode
  variant?: 'default' | 'destructive'
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
    consequence,
    variant = 'default',
  } = props
  const isDestructive = variant === 'destructive'
  return (
    <Modal
      centered
      opened={opened}
      size="lg"
      title={
        <Text fw="bolder" size="lg">
          {title}
        </Text>
      }
      onClose={onCancel}
    >
      <div className="cd-mb-[1rem]">
        {children}
        {consequence && (
          <Text c={isDestructive ? 'red' : 'dimmed'} mt="sm" size="sm">
            {consequence}
          </Text>
        )}
      </div>

      <Group justify="flex-end" mt="lg">
        <Button
          data-autofocus
          color={cancelColor ?? 'gray'}
          disabled={loading}
          onClick={onCancel}
        >
          {cancelText ?? 'Cancelar'}
        </Button>
        <Button
          color={confirmColor ?? (isDestructive ? 'red' : 'violet')}
          loaderProps={{ type: 'dots' }}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmText ?? (isDestructive ? 'Eliminar' : 'Confirmar')}
        </Button>
      </Group>
    </Modal>
  )
}

export default ConfModal
