import { Center, Paper, Stack, Text } from '@mantine/core'
import React from 'react'

type Props = {
  action?: React.ReactNode
  children?: string | React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  title?: React.ReactNode
  variant?: 'empty' | 'no-results' | 'error'
}

export const EmptyState = (props: Props) => {
  const {
    action,
    children,
    description,
    icon,
    title,
    variant = 'empty',
  } = props

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
            (React.isValidElement(children) ? (
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
