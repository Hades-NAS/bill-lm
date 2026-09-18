import { Center, Paper, Stack, Text } from '@mantine/core'
import { isValidElement } from 'react'

import type { ReactNode } from 'react'

export type EmptyStateProps = {
  action?: ReactNode
  children?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  title?: ReactNode
  variant?: 'empty' | 'no-results' | 'error'
}

export function EmptyState({
  action,
  children,
  description,
  icon,
  title,
  variant = 'empty',
}: EmptyStateProps) {
  return (
    <Paper
      withBorder
      bg={variant === 'error' ? 'red.0' : undefined}
      p="xl"
      radius="md"
    >
      <Center>
        <Stack align="center" gap="xs" maw={440} ta="center">
          {icon}
          {title && <Text fw={600}>{title}</Text>}
          {description && <Text c="dimmed">{description}</Text>}
          {children &&
            (isValidElement(children) ? (
              children
            ) : (
              <Text c="gray.6">{children}</Text>
            ))}
          {action}
        </Stack>
      </Center>
    </Paper>
  )
}
