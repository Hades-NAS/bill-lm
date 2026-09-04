import {
  ActionIcon,
  Divider,
  Group,
  List,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { CircleHelp, Info } from 'lucide-react'

export type ContextGuideItem = {
  title: string
  description: string
  example?: string
}

type ContextGuide = {
  title: string
  introduction: string
  items: Array<ContextGuideItem>
}

export function openContextGuide({ title, introduction, items }: ContextGuide) {
  modals.open({
    centered: true,
    size: 'lg',
    title,
    children: (
      <Stack gap="md">
        <Text>{introduction}</Text>
        <Divider />
        <List withPadding spacing="md">
          {items.map((item) => (
            <List.Item key={item.title}>
              <Stack gap={2}>
                <Text fw={700}>{item.title}</Text>
                <Text size="sm">{item.description}</Text>
                {item.example && (
                  <Text c="dimmed" size="sm">
                    Ejemplo: {item.example}
                  </Text>
                )}
              </Stack>
            </List.Item>
          ))}
        </List>
      </Stack>
    ),
  })
}

export function FieldHelpLabel({
  label,
  hint,
}: {
  label: string
  hint: string
}) {
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

export function ContextGuideButton({
  title,
  onClick,
}: {
  title: string
  onClick: () => void
}) {
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
