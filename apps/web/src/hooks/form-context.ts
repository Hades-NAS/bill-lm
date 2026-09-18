import { createFormHookContexts, useStore } from '@tanstack/react-form'

export const { fieldContext, useFieldContext, formContext, useFormContext } =
  createFormHookContexts()

export function useField() {
  try {
    const field = useFieldContext<unknown>()
    const errors = useStore(field.store, (state) => state.meta.errors)

    return {
      field,
      errors,
    }
  } catch {
    return {
      field: null,
      errors: [],
    }
  }
}
