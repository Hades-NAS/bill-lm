import { ActionIcon, Group, Text, Tooltip } from '@mantine/core'
import { CircleHelp, Info } from 'lucide-react'

export type FieldHelpLabelProps = {
  hint: string
  label: string
}

export function FieldHelpLabel({ label, hint }: FieldHelpLabelProps) {
  return (
    <Group gap={4} wrap="nowrap">
      <Text inherit component="span">
        {label}
      </Text>
      <Tooltip multiline withArrow label={hint} openDelay={800} w={240}>
        <ActionIcon
          aria-label={`Ayuda sobre ${label}`}
          color="gray"
          radius="xl"
          size="xs"
          variant="subtle"
          onClick={(event) => event.stopPropagation()}
        >
          <CircleHelp size={14} strokeWidth={1.9} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

export type ContextGuideButtonProps = {
  title: string
  onClick: () => void
}

export function ContextGuideButton({
  title,
  onClick,
}: ContextGuideButtonProps) {
  return (
    <Tooltip withArrow label={`Ver guía sobre ${title}`} openDelay={800}>
      <ActionIcon
        aria-label={`Ver guía sobre ${title}`}
        color="violet"
        radius="xl"
        size="md"
        variant="light"
        onClick={onClick}
      >
        <Info size={18} strokeWidth={1.9} />
      </ActionIcon>
    </Tooltip>
  )
}
