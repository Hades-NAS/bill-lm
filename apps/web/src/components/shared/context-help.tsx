import { Divider, List, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'

export { ContextGuideButton, FieldHelpLabel } from '@bill-lm/ui'

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
