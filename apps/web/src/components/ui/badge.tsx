import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
}

const variantClasses: Record<string, string> = {
  default: 'bg-[#185FA5] text-white',
  outline: 'border border-gray-200 text-gray-700 bg-transparent',
  secondary: 'bg-gray-100 text-gray-700',
  destructive: 'bg-red-100 text-red-700',
};

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
