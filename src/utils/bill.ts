import type { BillType } from "#/generated/prisma/enums";

export const getColorBillType = (type: BillType) => {
  if (type === 'PDF') {
    return 'red'
  } else if (type === 'XML') {
    return 'yellow'
  } else if (type === 'TEXT') {
    return 'blue'
  } else {
    return 'cyan'
  }
}
export const getColorPercentage = (percentage: number | null) => {
  if (percentage === null) {
    return 'gray'
  } else if (percentage < 50) {
    return 'red'
  } else if (percentage < 100) {
    return 'yellow'
  } else {
    return 'green'
  }
}
