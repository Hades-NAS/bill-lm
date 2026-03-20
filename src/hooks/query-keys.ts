export const billsKeys = {
  all: ['bills'] as const,
  calc: (collectionId: string, bills: any) => [...billsKeys.all, 'calc', collectionId, bills] as const,
}