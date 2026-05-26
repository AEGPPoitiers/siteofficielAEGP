import type { ReactNode } from 'react'

type FormCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
}

export function FormCard({ title, subtitle, children }: FormCardProps) {
  return (
    <div className="flex justify-center pt-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        {subtitle && <p className="text-sm text-gray-600 mb-6">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
