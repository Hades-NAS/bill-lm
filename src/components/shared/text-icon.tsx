import { Flex, Text, ThemeIcon } from '@mantine/core'
import React from 'react'

import type { TextProps, ThemeIconProps } from '@mantine/core'

type Props = {
  iconPosition?: 'left' | 'right'
  children: React.ReactNode | Array<React.ReactNode>
}

export const TextWithIcon = (props: Props) => {
  const childrenArray = React.Children.toArray(props.children)

  const iconPosition = props.iconPosition || 'left'

  const textChild = childrenArray.find((child) => {
    return (
      React.isValidElement(child) &&
      // @ts-ignore - this is a bit hacky but it works for now
      child.type.displayName === 'TextWithIcon.Text'
    )
  })
  const iconChild = childrenArray.find((child) => {
    return (
      React.isValidElement(child) &&
      // @ts-ignore - this is a bit hacky but it works for now
      child.type.displayName === 'TextWithIcon.Icon'
    )
  })

  if (textChild && iconChild) {
    return (
      <Flex align="center" direction="row" gap={6} justify="flex-start">
        {iconPosition === 'left' ? iconChild : textChild}
        {iconPosition === 'left' ? textChild : iconChild}
      </Flex>
    )
  }

  return <React.Fragment>{props.children}</React.Fragment>
}

TextWithIcon.displayName = 'TextWithIcon'

type TextWithIconTextProps = TextProps & {
  children: React.ReactNode | Array<React.ReactNode> | string
}

const TextInner = (props: TextWithIconTextProps) => {
  return React.isValidElement(props.children) ? (
    props.children
  ) : (
    <Text {...props}>{props.children}</Text>
  )
}

TextInner.displayName = 'TextWithIcon.Text'

type TextWithIconIconProps = ThemeIconProps & {
  children: React.ReactNode | Array<React.ReactNode>
}

const IconInner = (props: TextWithIconIconProps) => {
  const innerProps = { ...props }

  innerProps.variant = innerProps.variant || 'transparent'
  innerProps.mr = innerProps.mr || 6

  return <ThemeIcon {...innerProps}>{props.children}</ThemeIcon>
}

IconInner.displayName = 'TextWithIcon.Icon'

TextWithIcon.Text = TextInner
TextWithIcon.Icon = IconInner

export default TextWithIcon
