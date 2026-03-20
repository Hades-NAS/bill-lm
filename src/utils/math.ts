export const roundToDecimals = (num: number, decimals: number = 2): number => {
  const precision = Math.pow(10, decimals)
  return Math.round(num * precision) / precision
}