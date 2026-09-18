import { NumberFormatter } from '@mantine/core'

import type { NumberFormatterProps } from '@mantine/core'

export const NumberDisplay = (props: NumberFormatterProps) => {
  const {
    value,
    prefix = '$ ',
    decimalScale = 2,
    thousandSeparator = true,
    fixedDecimalScale = true,

    ...restProps
  } = props

  return (
    <NumberFormatter
      decimalScale={decimalScale}
      fixedDecimalScale={fixedDecimalScale}
      prefix={prefix}
      thousandSeparator={thousandSeparator}
      value={value}
      {...restProps}
    />
  )
}
