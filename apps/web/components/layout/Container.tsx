import { cn } from '@/lib/cn';

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn('mx-auto w-full max-w-7xl px-6', className)}>{children}</section>;
}
