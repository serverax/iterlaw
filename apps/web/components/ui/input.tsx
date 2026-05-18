import React from 'react';
import { cn } from '@/lib/cn';

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'textarea';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  rows?: number;
  className?: string;
  id?: string;
}

export const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (
    {
      type = 'text',
      placeholder,
      value,
      onChange,
      label,
      error,
      disabled,
      icon,
      rows = 4,
      className,
      id,
    },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const baseInputStyles = cn(
      'w-full rounded-lg border bg-slate px-4 py-3 text-text-primary placeholder:text-text-tertiary',
      'border-steel transition-colors focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/50',
      'disabled:cursor-not-allowed disabled:opacity-50',
      icon ? 'pl-10' : undefined,
      error ? 'border-signal-red focus:border-signal-red focus:ring-signal-red' : undefined
    );

    return (
      <section className={cn('w-full', className)}>
        {label ? (
          <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-text-primary">
            {label}
          </label>
        ) : null}
        <section className="relative">
          {icon ? (
            <span className="pointer-events-none absolute left-3 top-3 text-text-secondary">
              {icon}
            </span>
          ) : null}
          {type === 'textarea' ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              id={inputId}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              disabled={disabled}
              rows={rows}
              className={baseInputStyles}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              id={inputId}
              type={type}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              disabled={disabled}
              className={baseInputStyles}
            />
          )}
        </section>
        {error ? <p className="mt-1 text-xs text-signal-red">{error}</p> : null}
      </section>
    );
  }
);

Input.displayName = 'Input';
