import { notifications as notMantine } from '@mantine/notifications'

import type { NotificationData } from '@mantine/notifications'

const notificationStyles: NotificationData['styles'] = {
  title: {
    // fontSize: '1.15rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },

  description: {
    // fontSize: '1rem',
    lineHeight: 1.5,
  },
}

const show = (params: NotificationData) => {
  notMantine.show({
    title: params.title,
    message: params.message,
    color: params.color || 'blue',
    autoClose: params.autoClose || 5000,
    withBorder: params.withBorder === undefined ? params.withBorder : true,
    withCloseButton:
      params.withCloseButton === undefined ? params.withCloseButton : true,
    styles: {
      ...notificationStyles,
      ...(params.styles || {}),
    },
  })
}

const hide = (id: string) => {
  notMantine.hide(id)
}

const clean = () => {
  notMantine.clean()
}

const cleanQueue = () => {
  notMantine.cleanQueue()
}

const update = (params: NotificationData) => {
  notMantine.update({
    id: params.id,
    title: params.title,
    message: params.message,
    color: params.color || 'blue',
    autoClose: params.autoClose || 10000,
    withBorder: params.withBorder === undefined && true,
    withCloseButton: params.withCloseButton === undefined && true,
    styles: {
      ...notificationStyles,
      ...(params.styles || {}),
    },
  })
}

const success = (params: NotificationData) => {
  show({
    ...params,
    color: 'green',
  })
}

const error = (params: NotificationData) => {
  show({
    ...params,
    color: 'red',
  })
}

const warn = (params: NotificationData) => {
  show({
    ...params,
    color: 'yellow',
  })
}

export const notify = {
  show,
  success,
  warn,
  error,
  hide,
  clean,
  cleanQueue,
  update,
}
