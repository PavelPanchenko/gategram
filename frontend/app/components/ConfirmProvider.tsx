'use client'

import { useState, useCallback, useEffect, ReactNode } from 'react'
import ConfirmModal from './ConfirmModal'
import { setConfirmHandler } from '@/app/utils/toast'

interface ConfirmState {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const handleConfirm = useCallback((message: string, title: string, callback: (confirmed: boolean) => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        callback(true)
        setConfirmState(null)
      },
      onCancel: () => {
        callback(false)
        setConfirmState(null)
      },
    })
  }, [])

  // Регистрируем handler при монтировании
  useEffect(() => {
    setConfirmHandler(handleConfirm)
  }, [handleConfirm])

  return (
    <>
      {children}
      {confirmState && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
          confirmText="Подтвердить"
          cancelText="Отмена"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      )}
    </>
  )
}

