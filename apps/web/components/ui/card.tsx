import React from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'default' | 'interactive' | 'alert';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  onClick?: () => void;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'border-steel bg-steel hover:border-gold/50',
  interactive:
    'cursor-pointer border-steel bg-slate transition-colors hover:border-gold/50 hover:bg-steel/80',
  alert: 'border-signal-amber bg-steel',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', variant = 'default', onClick }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('rounded-xl border p-6', variantStyles[variant], className)}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') onClick();
              }
            : undefined
        }
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
