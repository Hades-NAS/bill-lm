// import type { ColumnFiltersState } from '@tanstack/react-table'

export const formatList = (
  items: Array<string>,
  options?: Intl.ListFormatOptions,
) => {
  const ListFormatter = new Intl.ListFormat('en-US', {
    style: 'long',
    type: 'conjunction',
    ...options,
  })

  return ListFormatter.format(items)
}

export const isEmptyObject = (obj?: Record<string, any>) => {
  if (!obj || Object.keys(obj).length === 0) return true

  return Object.values(obj).every(
    (value) =>
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === ''),
  )
}

export const capitalize = (text: string, onlyFirst = false) => {
  text = text.toLowerCase()

  if (onlyFirst) {
    return text
      .replace(
        /(^|[.]\s*)([a-z])/g,
        (_match, sep, char) => sep + char.toUpperCase(),
      )
      .trim()
  }
  return text
    .replace(
      /(^|[.]\s+|\s+)([a-z])/g,
      (_match, sep, char) => sep + char.toUpperCase(),
    )
    .trim()
}

export const cleanNumber = (value: string) => {
  return value.replace(/[^0-9.]/g, '')
}

export const getColorStock = (stock: number, alertStock: number) => {
  if (stock <= 0) return 'red'
  if (stock <= alertStock) return 'yellow'

  return 'inherit'
}

export const validateFormat = (value: string, regex: RegExp) => {
  return regex.test(value)
}

export const periodString = (value?: string | null) => {
  if (!value?.length) return ''

  const lastChar = value.charAt(value.length - 1)

  if (lastChar === '.') return value

  return `${value}.`
}

export const ellipsis = (value: string, length: number = 40) => {
  if (value.length <= length) return value

  return `${value.substring(0, length)}...`
}

export const formatNumber = (
  value: number,
  digits = 2,
  prefix?: string,
  suffix?: string,
) => {
  const valueFormat = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)

  return `${prefix || ''}${valueFormat}${suffix || ''}`
}

export const formatPlate = (value?: string | null) => {
  if (!value || value.length < 3) return value?.toUpperCase() || ''

  const cleanedValue = value.replace(/-/g, '').toUpperCase()

  if (/^[A-Z]{3}/.test(cleanedValue)) {
    return `${cleanedValue.slice(0, 3)}-${cleanedValue.slice(3)}`
  }

  return cleanedValue.toUpperCase()
}

const parseValueString = (value: unknown): any => {
  if (!value) return undefined

  const type = typeof value
  if (Array.isArray(value)) {
    const items = value.map(parseValueString)
    return `list:${items.join(',')}`
  } else if (type === 'number') {
    return `number:${value}`
  } else if (type === 'boolean') {
    return `boolean:${value}`
  } else if (type === 'object') {
    return `object:${JSON.stringify(value)}`
  } else {
    return `text:${value}`
  }
}

const parseValueJs = (value: string): any => {
  if (!value) return undefined

  const index = value.indexOf(':')
  const type = value.slice(0, index)
  const val = value.slice(index + 1)

  if (type === 'list') {
    const items = val.split(',').map(parseValueJs)
    return items
  } else if (type === 'number') {
    return Number(val)
  } else if (type === 'boolean') {
    return val === 'true'
  } else if (type === 'object') {
    return JSON.parse(val)
  } else {
    return val
  }
}

// export const filtersToString = (filters: ColumnFiltersState) => {
//   const params = filters.reduce(
//     (acc, { id, value }) => {
//       acc[id] = parseValueString(value)
//       return acc
//     },
//     {} as Record<string, string>,
//   )

//   return new URLSearchParams(params).toString()
// }

// export const stringToFilters = (queryString: string): ColumnFiltersState => {
//   const params = new URLSearchParams(queryString)
//   const filters: ColumnFiltersState = []

//   for (const [key, value] of params) {
//     filters.push({ id: key, value: parseValueJs(value) })
//   }

//   return filters
// }
