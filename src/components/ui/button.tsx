import * as React from 'react'

export type ButtonVariant = 'default' | 'outline' | 'destructive'
export type ButtonSize = 'default' | 'sm' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-gray-900 text-white hover:bg-gray-800 border border-gray-900',
  outline: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50',
  destructive: 'bg-red-600 text-white border border-red-600 hover:bg-red-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-9 px-3 py-2 text-sm',
  lg: 'h-11 px-6 py-3 text-base',
}

export function Button({
  className = '',
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <button type={type} className={classes} {...props} />
}
