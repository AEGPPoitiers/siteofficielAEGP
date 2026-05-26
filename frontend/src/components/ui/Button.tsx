import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const base =
    'px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const variantClass =
    variant === 'primary'
      ? 'bg-black text-white hover:bg-gray-800'
      : 'bg-white text-black border border-gray-300 hover:bg-gray-50'

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variantClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
