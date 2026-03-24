export const roundToDecimals = (num: number | string, decimals: number = 2): number => {
  const parsedNum = typeof num === 'string' ? parseFloat(num) : num

  const precision = Math.pow(10, decimals)
  return Math.round(parsedNum * precision) / precision
}
