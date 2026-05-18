import Link from 'next/link';
import React from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  icon?: React.ReactNode;
  fullWidth?: boolean;
  href?: string;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-night hover:bg-gold/90 disabled:bg-gold/50',
  secondary:
    'bg-steel text-text-primary border border-gold/50 hover:border-gold disabled:opacity-50',
  ghost: 'bg-transparent text-text-primary hover:bg-steel disabled:opacity-50',
  danger: 'bg-signal-red text-white hover:bg-signal-red/90 disabled:opacity-50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-6 py-4 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled,
      loading,
      children,
      onClick,
      type = 'button',
      icon,
      fullWidth,
      href,
      className,
    },
    ref
  ) => {
    const classes = cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-dm-sans font-semibold transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-night',
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && 'w-full',
      (disabled || loading) && 'cursor-not-allowed opacity-50',
      !disabled && !loading && 'cursor-pointer',
      className
    );

    const content = (
      <>
        {loading ? <span className="animate-spin" aria-hidden>⟳</span> : null}
        {!loading && icon ? icon : null}
        {children}
      </>
    );

    if (href && !disabled) {
      return (
        <Link href={href} className={classes}>
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';
