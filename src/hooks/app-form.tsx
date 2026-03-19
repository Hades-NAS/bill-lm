import { ActionIcon, Button } from '@mantine/core'
import { createFormHook } from '@tanstack/react-form'

import { fieldContext, formContext } from '#/hooks/form-context'

import Input from '#/components/shared/input'

import type { ButtonProps } from '@mantine/core'

export const { useAppForm } = createFormHook({
  fieldComponents: {
    Input,
    Button,
    ActionIcon,
  },
  formComponents: {
    SubmitButton: (props: ButtonProps) => (
      <Button {...props} loaderProps={{ type: 'dots' }} type="submit" />
    ),
    CancelButton: Button,
  },
  fieldContext,
  formContext,
})
