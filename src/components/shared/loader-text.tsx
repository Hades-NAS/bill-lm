import { Box, Center, Loader } from '@mantine/core'
import React from 'react'

type Props = {
  children: string | React.ReactNode
}

export const LoaderText = (props: Props) => {
  return (
    <Center>
      <Loader size="xl" type="dots" />

      {props.children &&
        (React.isValidElement(props.children) ? (
          props.children
        ) : (
          <Box>{props.children}</Box>
        ))}
    </Center>
  )
}
