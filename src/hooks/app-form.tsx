import { ActionIcon, Button } from '@mantine/core'

import { createFormHook } from '@tanstack/react-form'

import Input from '#/components/shared/input'
import { fieldContext, formContext } from '#/hooks/form-context'

export const { useAppForm } = createFormHook({
  fieldComponents: {
    Input,
    Button,
    ActionIcon,
  },
  formComponents: {
    SubmitButton: (props) => (
      <Button loaderProps={{ type: 'dots' }} {...props} type="submit" />
    ),
    CancelButton: Button,
  },
  fieldContext,
  formContext,
})
