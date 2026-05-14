import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const variantClasses: Record<string, string> = {
  default: 'bg-[#185FA5] text-white hover:bg-[#0C447C]',
  outline: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
  destructive: 'bg-red-500 text-white hover:bg-red-600',
  link: 'text-[#185FA5] underline-offset-4 hover:underline',
};

const sizeClasses: Record<string, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-11 px-6 text-base',
  icon: 'h-9 w-9',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
