import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const variantColors: Record<BadgeVariant, string> = {
  default: 'bg-gold/15 text-gold',
  success: 'bg-signal-green/15 text-signal-green',
  warning: 'bg-signal-amber/15 text-signal-amber',
  error: 'bg-signal-red/15 text-signal-red',
  info: 'bg-signal-blue/15 text-signal-blue',
};

export function Badge({ label, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full font-dm-sans font-semibold',
        variantColors[variant],
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
        className
      )}
    >
      {label}
    </span>
  );
}
