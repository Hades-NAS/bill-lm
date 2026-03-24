import { Center, Paper, Text } from '@mantine/core'
import React from 'react'

type Props = {
  children: string | React.ReactNode
}

export const EmptyState = (props: Props) => {
  return (
    <Paper withBorder p="xl" radius="md">
      <Center>
        {React.isValidElement(props.children) ? (
          props.children
        ) : (
          <Text c="gray.6">{props.children}</Text>
        )}
      </Center>
    </Paper>
  )
}
