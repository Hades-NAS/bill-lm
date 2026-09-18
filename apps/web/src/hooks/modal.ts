import React from 'react'

import type { ModalFormType } from '#/schema/page'

export const useModal = <TData>(
  initialData: TData | undefined | void | null = null,
) => {
  const hook = React.useState<ModalFormType<TData>>({
    opened: false,
    data: initialData,
  })

  React.useEffect(() => {
    if (initialData !== undefined) {
      hook[1]((prev) => ({ ...prev, data: initialData }))
    }
  }, [initialData])
  return hook
}
