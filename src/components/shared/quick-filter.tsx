import {
  Group,
  Select,
  TextInput,
  Button,
  Stack,
  RangeSlider,
  NumberInput,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { CalendarIcon } from 'lucide-react'
import { DateTime } from 'luxon'
import React from 'react'

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
}: {
  value: [Date | null, Date | null]
  onChange: (val: [Date | null, Date | null]) => void
  defaultValue?: [Date, Date]
  placeholder?: string
}) {
  return (
    <DatePickerInput
      clearable
      defaultValue={defaultValue}
      placeholder={placeholder || 'Selecciona un rango de fechas'}
      rightSection={<CalendarIcon size={16} />}
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

function ThresholdInput({
  field,
  value,
  onChange,
  condition,
  onConditionChange,
}: {
  field: ThresholdFilterField
  value: number
  onChange: (val: number) => void
  condition: ConditionOperator
  onConditionChange: (val: ConditionOperator) => void
}) {
  const conditionOptions: SelectProps['data'] = [
    { value: '>', label: 'Mayor que (>)' },
    { value: '>=', label: 'Mayor o igual (>=)' },
    { value: '<', label: 'Menor que (<)' },
    { value: '<=', label: 'Menor o igual (<=)' },
  ]

  return (
    <Group gap={12}>
      <Select
        data={conditionOptions}
        placeholder="Condición"
        value={condition}
        w={150}
        onChange={(val) => onConditionChange(val as ConditionOperator)}
      />
      <TextInput
        max={field.max}
        min={field.min}
        placeholder="Valor"
        step={field.step}
        type="number"
        value={value}
        w={150}
        onChange={(e) => onChange(parseFloat(e.currentTarget.value) || 0)}
      />
    </Group>
  )
}

export function QuickFilter({
  filter,
  fields,
  onSearch,
  children,
}: QuickFilterProps) {
  const [selectedFieldName, setSelectedFieldName] = React.useState<
    string | null
  >(fields[0]?.name ?? null)

  const [textValue, setTextValue] = React.useState('')

  const [numberValue, setNumberValue] = React.useState<number | null>(null)

  const [numberRangeValue, setNumberRangeValue] = React.useState<
    [number, number]
  >([0, 100])

  const [dateRangeValue, setDateRangeValue] = React.useState<
    [Date | null, Date | null]
  >([null, null])

  const [thresholdValue, setThresholdValue] = React.useState(0)

  const [thresholdCondition, setThresholdCondition] =
    React.useState<ConditionOperator>('>=')

  const selectedField = fields.find((f) => f.name === selectedFieldName)

  React.useLayoutEffect(() => {
    if (!filter) return

    setSelectedFieldName(filter.field)

    switch (filter.type) {
      case 'text':
        setTextValue(filter.value)
        break

      case 'number':
        setNumberValue(filter.value)
        break

      case 'numberRange':
        setNumberRangeValue(filter.value)
        break

      case 'dateRange':
        setDateRangeValue(filter.value)
        break

      case 'threshold':
        setThresholdValue(filter.value)
        setThresholdCondition(filter.condition)
        break
    }
  }, [filter])

  return (
    <Stack gap={16}>
      <Group>
        <Select
          data={fields.map((f) => ({ value: f.name, label: f.label }))}
          placeholder="Selecciona un campo"
          value={selectedFieldName}
          w={200}
          onChange={setSelectedFieldName}
        />

        {renderFilterInput()}

        <Button onClick={handleSearch}>Buscar</Button>
      </Group>

      {children}
    </Stack>
  )

  function handleSearch() {
    if (!selectedField) return

    try {
      switch (selectedField.type) {
        case 'text':
          onSearch({
            field: selectedField.name,
            type: 'text',
            value: textValue,
          } as TextFilterValue)
          break

        case 'number':
          onSearch({
            field: selectedField.name,
            type: 'number',
            value: numberValue,
          } as NumberFilterValue)
          break

        case 'numberRange':
          onSearch({
            field: selectedField.name,
            type: 'numberRange',
            value: numberRangeValue,
          } as NumberRangeFilterValue)
          break

        case 'dateRange':
          if (dateRangeValue[0] && dateRangeValue[1]) {
            onSearch({
              field: selectedField.name,
              type: 'dateRange',
              value: dateRangeValue as [Date, Date],
            } as DateRangeFilterValue)
          }
          break

        case 'threshold':
          onSearch({
            field: selectedField.name,
            type: 'threshold',
            condition: thresholdCondition,
            value: thresholdValue,
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
          <TextInput
            defaultValue={selectedField.defaultValue}
            flex={1}
            placeholder={selectedField.placeholder || 'Escriba un texto...'}
            value={textValue}
            onChange={(e) => setTextValue(e.currentTarget.value)}
          />
        )

      case 'number':
        return (
          <NumberInput
            defaultValue={selectedField.defaultValue}
            flex={1}
            placeholder={selectedField.placeholder || 'Escriba un número...'}
            value={numberValue || undefined}
            onChange={(value) => setNumberValue(Number(value))}
          />
        )

      case 'numberRange':
        return (
          <NumberRangeInput
            field={selectedField}
            value={numberRangeValue}
            onChange={setNumberRangeValue}
          />
        )

      case 'dateRange':
        return (
          <DateRangeInput
            defaultValue={selectedField.defaultValue}
            placeholder={
              selectedField.placeholder || 'Selecciona un rango de fechas'
            }
            value={dateRangeValue}
            onChange={setDateRangeValue}
          />
        )

      case 'threshold':
        return (
          <ThresholdInput
            condition={thresholdCondition}
            field={selectedField}
            value={thresholdValue}
            onChange={setThresholdValue}
            onConditionChange={setThresholdCondition}
          />
        )

      default:
        return null
    }
  }
}
