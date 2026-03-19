
export const collectionKeys = {
  all: ['collections'],
  list: (filters: unknown) => [...collectionKeys.all, 'list', filters],
  detail: (id: string) => [...collectionKeys.all, 'detail', id],
}
