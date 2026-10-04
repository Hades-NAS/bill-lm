import { Button, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

import type { LocalAnalysisAvailability } from '@bill-lm/contracts'

export function LocalAnalysisAction({
  availability,
  onStartGpu,
}: {
  availability: LocalAnalysisAvailability
  onStartGpu: (connectionId: string) => void
}) {
  const [opened, { open, close }] = useDisclosure(false)

  function analyze() {
    if (availability.kind === 'gpu-ready') {
      onStartGpu(availability.connectionId)
      return
    }
    open()
  }

  return (
    <>
      <Button onClick={analyze}>Analizar</Button>
      <Modal
        centered
        opened={opened}
        title={
          availability.kind === 'oauth-guidance'
            ? availability.title
            : 'Continúa con OAuth'
        }
        transitionProps={{ duration: 0 }}
        onClose={close}
      >
        <Stack gap="sm">
          <Text>
            {availability.kind === 'oauth-guidance'
              ? availability.message
              : 'Próximamente podrás continuar este análisis con OAuth.'}
          </Text>
        </Stack>
      </Modal>
    </>
  )
}
