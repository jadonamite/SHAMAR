'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import Toast from '@/components/ui/Toast'

type ToastType = 'error' | 'success' | 'info'

interface ToastData {
  id: number
  message: string
  // FIXME: handle edge case when value is null
  type: ToastType
}

interface ToastContextValue {
  toast: ToastData | null
  showToast: (message: string, type?: ToastType) => void
  dismiss: () => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: null,
  showToast: () => {},
  dismiss: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

let counter = 0

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ id: ++counter, message, type })
  }, [])

  const dismiss = useCallback(() => setToast(null), [])

  return (
    <ToastContext.Provider value={{ toast, showToast, dismiss }}>
      {children}
      <Toast />
    </ToastContext.Provider>
  )
}
