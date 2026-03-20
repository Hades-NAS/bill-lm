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