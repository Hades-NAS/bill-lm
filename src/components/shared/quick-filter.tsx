import {
  Group,
  Select,
  TextInput,
  Button,
  Stack,
  RangeSlider,
  NumberInput,
  ActionIcon,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { CalendarIcon, XCircle } from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

import { FilterFormSchema } from '#/schema/quick-filter'

import { useAppForm } from '#/hooks/app-form'

import type { FilterFormValues } from '#/schema/quick-filter'
import type { SelectProps } from '@mantine/core'

type FilterFieldType =
  | 'text'
  | 'number'
  | 'numberRange'
  | 'dateRange'
  | 'threshold'

type ConditionOperator = '>' | '>=' | '<' | '<='

interface BaseFilterField {
  name: string
  label: string
  type: FilterFieldType
  defaultValue?: any
  placeholder?: string
  clearable?: boolean
}

interface TextFilterField extends BaseFilterField {
  type: 'text'
  defaultValue?: string
}

interface NumberFilterField extends BaseFilterField {
  type: 'number'
  defaultValue?: number
}

interface NumberRangeFilterField extends BaseFilterField {
  type: 'numberRange'
  min?: number
  max?: number
  step?: number
  defaultValue?: [number, number]
}

interface DateRangeFilterField extends BaseFilterField {
  type: 'dateRange'
  defaultValue?: [Date, Date]
}

interface ThresholdFilterField extends BaseFilterField {
  type: 'threshold'
  min?: number
  max?: number
  step?: number
  defaultValue?: { condition: ConditionOperator; value: number }
}

export type FilterField =
  | TextFilterField
  | NumberFilterField
  | NumberRangeFilterField
  | DateRangeFilterField
  | ThresholdFilterField

// Tipos para los valores del filtro
interface TextFilterValue {
  field: string
  type: 'text'
  value: string
}

interface NumberFilterValue {
  field: string
  type: 'number'
  value: number
}

interface NumberRangeFilterValue {
  field: string
  type: 'numberRange'
  value: [number, number]
}

interface DateRangeFilterValue {
  field: string
  type: 'dateRange'
  value: [Date, Date]
}

interface ThresholdFilterValue {
  field: string
  type: 'threshold'
  condition: ConditionOperator
  value: number
}

export type FilterValue =
  | TextFilterValue
  | NumberFilterValue
  | NumberRangeFilterValue
  | DateRangeFilterValue
  | ThresholdFilterValue

interface QuickFilterProps {
  loading?: boolean
  filter?: FilterValue | null
  fields: Array<FilterField>
  onSearch: (filter: FilterValue) => void
  children: React.ReactNode
}

function NumberRangeInput({
  field,
  value,
  onChange,
  defaultValue,
}: {
  field: NumberRangeFilterField
  value: [number, number]
  onChange: (val: [number, number]) => void
  defaultValue?: [number, number]
  placeholder?: string
  rightSection?: React.ReactNode
}) {
  return (
    <RangeSlider
      defaultValue={defaultValue}
      label={(val) => `${val}`}
      marks={
        field.max
          ? [
              { value: field.min ?? 0, label: `${field.min ?? 0}` },
              {
                value: field.max,
                label: `${field.max}`,
              },
            ]
          : undefined
      }
      max={field.max ?? 1000}
      min={field.min ?? 0}
      step={field.step ?? 1}
      value={value}
      w={300}
      onChange={onChange}
    />
  )
}

function DateRangeInput({
  value,
  onChange,
  defaultValue,
  placeholder,
  rightSection,
}: {
  value: [Date | null, Date | null]
  onChange: (val: [Date | null, Date | null]) => void
  defaultValue?: [Date, Date]
  placeholder?: string
  rightSection?: React.ReactNode
}) {
  return (
    <DatePickerInput
      defaultValue={defaultValue}
      placeholder={placeholder || 'Selecciona un rango de fechas'}
      rightSection={rightSection || <CalendarIcon size={16} />}
      type="range"
      value={value}
      w={300}
      onChange={(val) => {
        const [start, end] = val
        if (start && end) {
          onChange([
            DateTime.fromFormat(start, 'yyyy-MM-dd').toJSDate(),
            DateTime.fromFormat(end, 'yyyy-MM-dd').toJSDate(),
          ])
        }
      }}
    />
  )
}

const conditionOptions: SelectProps['data'] = [
  { value: '>', label: 'Mayor que (>)' },
  { value: '>=', label: 'Mayor o igual (>=)' },
  { value: '<', label: 'Menor que (<)' },
  { value: '<=', label: 'Menor o igual (<=)' },
]

const defaultFilter: FilterFormValues = {
  textValue: '',
  numberValue: null,
  dateRangeValue: [null, null],
  numberRangeValue: [0, 100],
  thresholdValue: 0,
  thresholdCondition: '>=',
}

export function QuickFilter({
  filter,
  fields,
  onSearch,
  children,
  loading,
}: QuickFilterProps) {
  const [selectedFieldName, setSelectedFieldName] = React.useState<
    string | null
  >(fields[0]?.name ?? null)

  const selectedField = fields.find((f) => f.name === selectedFieldName)

  const form = useAppForm({
    defaultValues: defaultFilter,
    validators: {
      onSubmit: FilterFormSchema,
    },
    onSubmit: ({ value }) => {
      handleSearch(value)
      form.reset(value, {
        keepDefaultValues: true,
      })
    },
    onSubmitInvalid: ({ formApi }) => {
      console.error('Invalid filter form values:', formApi.getAllErrors())
    },
  })

  React.useLayoutEffect(() => {
    if (!filter) return

    setSelectedFieldName(filter.field)

    switch (filter.type) {
      case 'text':
        form.setFieldValue('textValue', filter.value)
        break

      case 'number':
        form.setFieldValue('numberValue', filter.value)
        break

      case 'numberRange':
        form.setFieldValue('numberRangeValue', filter.value)
        break

      case 'dateRange':
        form.setFieldValue('dateRangeValue', filter.value)
        break

      case 'threshold':
        form.setFieldValue('thresholdValue', filter.value)
        form.setFieldValue('thresholdCondition', filter.condition)
        break
    }
  }, [filter])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <Stack gap={16}>
        <Group>
          <Select
            allowDeselect={false}
            data={fields.map((f) => ({ value: f.name, label: f.label }))}
            placeholder="Selecciona un campo"
            value={selectedFieldName}
            w={200}
            onChange={setSelectedFieldName}
          />

          {renderFilterInput()}

          <Button
            disabled={!selectedFieldName || loading}
            loading={loading}
            type="submit"
          >
            Buscar
          </Button>
        </Group>

        {children}
      </Stack>
    </form>
  )

  function handleSearch(values: FilterFormValues) {
    if (!selectedField) return

    try {
      switch (selectedField.type) {
        case 'text':
          onSearch({
            field: selectedField.name,
            type: 'text',
            value: values.textValue,
          } as TextFilterValue)
          break

        case 'number':
          onSearch({
            field: selectedField.name,
            type: 'number',
            value: values.numberValue,
          } as NumberFilterValue)
          break

        case 'numberRange':
          onSearch({
            field: selectedField.name,
            type: 'numberRange',
            value: values.numberRangeValue,
          } as NumberRangeFilterValue)
          break

        case 'dateRange':
          onSearch({
            field: selectedField.name,
            type: 'dateRange',
            value: values.dateRangeValue as [Date, Date],
          } as DateRangeFilterValue)
          break

        case 'threshold':
          onSearch({
            field: selectedField.name,
            type: 'threshold',
            condition: values.thresholdCondition,
            value: values.thresholdValue,
          } as ThresholdFilterValue)
          break
      }
    } catch (error) {
      console.error('Error applying filter:', error)
    }
  }

  function renderFilterInput() {
    if (!selectedField) return null

    switch (selectedField.type) {
      case 'text':
        return (
          <form.AppField
            children={(field) => (
              <TextInput
                defaultValue={selectedField.defaultValue}
                flex={1}
                placeholder={selectedField.placeholder || 'Escriba un texto...'}
                rightSection={
                  field.state.value &&
                  selectedField.clearable && (
                    <ActionIcon
                      color="gray"
                      size="xs"
                      variant="transparent"
                      onClick={() => {
                        field.handleChange('')
                        form.handleSubmit()
                      }}
                    >
                      <XCircle size={16} />
                    </ActionIcon>
                  )
                }
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
              />
            )}
            name="textValue"
          />
        )

      case 'number':
        return (
          <form.AppField
            children={(field) => (
              <NumberInput
                defaultValue={selectedField.defaultValue}
                flex={1}
                placeholder={
                  selectedField.placeholder || 'Escriba un número...'
                }
                rightSection={
                  field.state.value !== null &&
                  selectedField.clearable && (
                    <ActionIcon
                      color="gray"
                      size="xs"
                      variant="transparent"
                      onClick={() => {
                        field.handleChange(null)
                        form.handleSubmit()
                      }}
                    >
                      <XCircle size={16} />
                    </ActionIcon>
                  )
                }
                value={field.state.value || undefined}
                onChange={(e) => field.handleChange(Number(e))}
              />
            )}
            name="numberValue"
          />
        )

      case 'numberRange':
        return (
          <form.AppField
            children={(field) => (
              <NumberRangeInput
                field={selectedField}
                value={field.state.value}
                onChange={(val) => field.handleChange(val)}
              />
            )}
            name="numberRangeValue"
          />
        )

      case 'dateRange':
        return (
          <form.AppField
            children={(field) => (
              <DateRangeInput
                defaultValue={selectedField.defaultValue}
                placeholder={
                  selectedField.placeholder || 'Selecciona un rango de fechas'
                }
                rightSection={
                  field.state.value[0] &&
                  field.state.value[1] &&
                  selectedField.clearable && (
                    <ActionIcon
                      color="gray"
                      size="xs"
                      variant="transparent"
                      onClick={() => {
                        field.handleChange([null, null])
                        form.handleSubmit()
                      }}
                    >
                      <XCircle size={16} />
                    </ActionIcon>
                  )
                }
                value={field.state.value}
                onChange={(val) => field.handleChange(val)}
              />
            )}
            name="dateRangeValue"
          />
        )

      case 'threshold':
        return (
          <Group gap={12}>
            <form.AppField
              children={(field) => (
                <Select
                  data={conditionOptions}
                  placeholder="Condición"
                  value={field.state.value}
                  w={150}
                  onChange={(val) =>
                    field.handleChange(val as ConditionOperator)
                  }
                />
              )}
              name="thresholdCondition"
            />
            <form.AppField
              children={(field) => (
                <TextInput
                  max={selectedField.max}
                  min={selectedField.min}
                  placeholder="Valor"
                  rightSection={
                    field.state.value &&
                    selectedField.clearable && (
                      <ActionIcon
                        color="gray"
                        size="xs"
                        variant="transparent"
                        onClick={() => {
                          field.handleChange(0)
                          form.handleSubmit()
                        }}
                      >
                        <XCircle size={16} />
                      </ActionIcon>
                    )
                  }
                  step={selectedField.step}
                  type="number"
                  value={field.state.value}
                  w={150}
                  onChange={(e) =>
                    field.handleChange(parseFloat(e.currentTarget.value) || 0)
                  }
                />
              )}
              name="thresholdValue"
            />
          </Group>
        )

      default:
        return null
    }
  }
}
