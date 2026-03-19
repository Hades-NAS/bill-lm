import { Loader, Stack, Text } from '@mantine/core'
import React from 'react'

type Props = {
  children: string | React.ReactNode
}

export const LoaderText = (props: Props) => {
  return (
    <Stack align="center" gap={8}>
      <Loader size="xl" type="dots" />

      {props.children &&
        (React.isValidElement(props.children) ? (
          props.children
        ) : (
          <Text c="gray.6">{props.children}</Text>
        ))}
    </Stack>
  )
}
