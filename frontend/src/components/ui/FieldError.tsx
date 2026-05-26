import type { ReactNode } from 'react'

type FieldErrorProps = { children: ReactNode }

export function FieldError({ children }: FieldErrorProps) {
  if (!children) return null
  return (
    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
      {children}
    </div>
  )
}
