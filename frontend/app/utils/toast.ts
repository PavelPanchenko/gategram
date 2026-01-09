import { toast } from 'react-toastify'

export const showToast = {
  success: (message: string) => {
    toast.success(message)
  },
  error: (message: string) => {
    toast.error(message)
  },
  info: (message: string) => {
    toast.info(message)
  },
  warning: (message: string) => {
    toast.warning(message)
  },
}

// Тип для функции подтверждения
export type ConfirmCallback = (confirmed: boolean) => void

// Глобальная функция для показа модального окна подтверждения
let globalConfirmHandler: ((message: string, title: string, callback: ConfirmCallback) => void) | null = null

export const setConfirmHandler = (handler: (message: string, title: string, callback: ConfirmCallback) => void) => {
  globalConfirmHandler = handler
}

export const confirmAction = (
  message: string,
  onConfirm: () => void | Promise<void>,
  onCancel?: () => void,
  title: string = 'Подтвердите действие'
): void => {
  if (globalConfirmHandler) {
    globalConfirmHandler(message, title, (confirmed) => {
      if (confirmed) {
        onConfirm()
      } else {
        onCancel?.()
      }
    })
  } else {
    // Fallback на стандартный confirm, если handler не установлен
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm()
    } else {
      onCancel?.()
    }
  }
}

