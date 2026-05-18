import { cn } from '@/lib/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...rest }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <section className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={textareaId} className="mb-2 block text-body font-medium text-text-primary">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        className={cn(
          'w-full rounded-md border bg-slate px-4 py-3 text-text-primary placeholder:text-text-tertiary',
          'border-steel focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold',
          error && 'border-signal-red'
        )}
        {...rest}
      />
      {error ? <p className="mt-1 text-body-sm text-signal-red">{error}</p> : null}
    </section>
  );
}
