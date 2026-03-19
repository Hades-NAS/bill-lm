import {
  Autocomplete,
  Checkbox,
  Loader,
  MultiSelect,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { DatePickerInput, DateTimePicker } from '@mantine/dates'

import type {
  AutocompleteProps,
  CheckboxProps,
  MultiSelectProps,
  NumberInputProps,
  SegmentedControlProps,
  SelectProps,
  SwitchProps,
  TextInputProps,
  TextareaProps,
} from '@mantine/core'
import type { DatePickerInputProps, DateTimePickerProps } from '@mantine/dates'

import { UI } from '@/constants/app'
import { useField } from '@/hooks/form-context'
import { capitalize } from '@/utils/string'
import { cn } from '@/utils/styles'

// Load the Spanish locale for date pickers
// This will be executed on the client side
if (typeof window !== 'undefined') {
  import('dayjs/locale/es')
}

type InputTextInputProps = TextInputProps & {
  typeInput: 'text'
  uppercase?: boolean
  lowercase?: boolean
  capitalize?: boolean
  formatter?: (value?: string | null) => string
}

type InputAutoCompleteProps = AutocompleteProps & {
  typeInput: 'autocomplete'
  loading?: boolean
  capitalize?: boolean
  lowercase?: boolean
  uppercase?: boolean
}

type InputTextAreaProps = TextareaProps & {
  typeInput: 'textarea'
}

type InputNumberInputProps = Omit<NumberInputProps, 'onChange'> & {
  typeInput: 'number'
  onChange?: (value: number) => void
}

type InputSelectProps = SelectProps & {
  typeInput: 'select'
  loading?: boolean
}

type InputMultiSelectProps = MultiSelectProps & {
  typeInput: 'multiSelect'
  loading?: boolean
}

type InputSegmentedControlProps = SegmentedControlProps & {
  typeInput: 'segmentedControl'
  label?: string
}

type InputSwitchProps = Omit<SwitchProps, 'labelPosition'> & {
  typeInput: 'switch'
  labelPosition?: 'left' | 'right' | 'top'
}

type InputCheckboxProps = CheckboxProps & {
  typeInput: 'checkbox'
}

type InputDateTimePickerProps = DateTimePickerProps & {
  typeInput: 'dateTimePicker'
}

type InputDateRangePickerProps = DatePickerInputProps & {
  typeInput: 'dateRangePicker'
}

export type InputProps =
  | InputTextInputProps
  | InputNumberInputProps
  | InputSelectProps
  | InputSegmentedControlProps
  | InputTextAreaProps
  | InputSwitchProps
  | InputCheckboxProps
  | InputDateTimePickerProps
  | InputDateRangePickerProps
  | InputAutoCompleteProps
  | InputMultiSelectProps

const Input = (props: InputProps) => {
  const { typeInput } = props

  const dataContext = useField()

  let errorContext = null
  if (dataContext.field?.state.meta.isTouched) {
    errorContext = dataContext.errors[0]?.message
  }

  const componentProps = {
    ...props,
    size: props.size ?? UI.Size,
    typeInput: undefined,
    uppercase: undefined,
    lowercase: undefined,
    capitalize: undefined,
    loading: undefined,
    onBlur: props.onBlur || dataContext.field?.handleBlur,
    onChange: props.onChange || dataContext.field?.handleChange,
    value:
      props.value !== null && props.value !== undefined
        ? props.value
        : dataContext.field?.state.value || '',
    error: errorContext || (props as any).error,
  } as any

  let inputComponent = null

  if (typeInput === 'number') {
    inputComponent = (
      <NumberInput
        {...componentProps}
        onChange={(value) => {
          if (props.onChange) props.onChange(Number(value))
          else if (dataContext.field?.handleChange) {
            dataContext.field.handleChange(Number(value))
          }
        }}
      />
    )
  } else if (typeInput === 'select') {
    inputComponent = (
      <Select
        {...componentProps}
        rightSection={props.loading ? <Loader size={18} /> : props.rightSection}
      />
    )
  } else if (typeInput === 'multiSelect') {
    inputComponent = (
      <MultiSelect
        {...componentProps}
        rightSection={props.loading ? <Loader size={18} /> : props.rightSection}
      />
    )
  } else if (typeInput === 'segmentedControl') {
    inputComponent = (
      <div className={cn(props.className, 'w-full flex flex-col')}>
        {componentProps.label && (
          <Text className="text-sm">{componentProps.label}</Text>
        )}
        <SegmentedControl {...componentProps} />
      </div>
    )
  } else if (typeInput === 'textarea') {
    inputComponent = (
      <Textarea
        {...componentProps}
        onChange={(e) => {
          if (props.onChange) props.onChange(e)
          if (dataContext.field?.handleChange) {
            dataContext.field.handleChange(e.target.value)
          }
        }}
      />
    )
  } else if (typeInput === 'switch') {
    if (componentProps.labelPosition === 'top') {
      const { label, ...rest } = componentProps

      inputComponent = (
        <div className={cn(props.className, 'flex flex-col gap-y-2')}>
          <Text className="text-sm">{label}</Text>
          <Switch
            {...rest}
            onChange={(e) => {
              if (props.onChange) props.onChange(e)
              if (dataContext.field?.handleChange) {
                dataContext.field.handleChange(e.currentTarget.checked)
              }
            }}
          />
        </div>
      )
    } else {
      inputComponent = (
        <Switch
          {...componentProps}
          onChange={(e) => {
            if (props.onChange) props.onChange(e)
            if (dataContext.field?.handleChange) {
              dataContext.field.handleChange(e.currentTarget.checked)
            }
          }}
        />
      )
    }
  } else if (typeInput === 'checkbox') {
    inputComponent = (
      <Checkbox
        {...componentProps}
        onChange={(e) => {
          if (props.onChange) props.onChange(e)
          if (dataContext.field?.handleChange) {
            dataContext.field.handleChange(e.currentTarget.checked)
          }
        }}
      />
    )
  } else if (typeInput === 'dateTimePicker') {
    inputComponent = <DateTimePicker {...componentProps} locale="es" />
  } else if (typeInput === 'dateRangePicker') {
    inputComponent = <DatePickerInput {...componentProps} locale="es" />
  } else if (typeInput === 'autocomplete') {
    inputComponent = (
      <Autocomplete
        {...componentProps}
        rightSection={props.loading ? <Loader size={18} /> : props.rightSection}
        onChange={(value) => {
          if (props.uppercase) {
            value = value.toUpperCase()
          } else if (props.lowercase) {
            value = value.toLowerCase()
          } else if (props.capitalize) {
            value = capitalize(value)
          }

          if (props.onChange) props.onChange(value)
          if (dataContext.field?.handleChange) {
            dataContext.field.handleChange(value)
          }
        }}
      />
    )
  } else {
    if (props.type === 'password') {
      inputComponent = (
        <PasswordInput
          {...componentProps}
          onChange={(e) => {
            if (props.onChange) props.onChange(e)
            if (dataContext.field?.handleChange) {
              dataContext.field.handleChange(e.target.value)
            }
          }}
        />
      )
    } else {
      inputComponent = (
        <TextInput
          {...componentProps}
          onChange={(e) => {
            if (props.uppercase) {
              e.target.value = e.target.value.toUpperCase()
            } else if (props.lowercase) {
              e.target.value = e.target.value.toLowerCase()
            } else if (props.capitalize) {
              e.target.value = capitalize(e.target.value)
            }

            if (componentProps.formatter) {
              e.target.value = componentProps.formatter(e.target.value)
            }
            if (props.onChange) props.onChange(e)
            if (dataContext.field?.handleChange) {
              dataContext.field.handleChange(e.target.value)
            }
          }}
        />
      )
    }
  }

  return inputComponent
}

export default Input
