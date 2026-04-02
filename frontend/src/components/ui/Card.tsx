import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => (
  <div
    className={cn(
      'rounded-xl border border-neutral-200 bg-white shadow-card',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ className, children, ...props }) => (
  <div className={cn('flex flex-col space-y-1 p-5 pb-0', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3
    className={cn('text-base font-semibold leading-snug tracking-tight text-neutral-900', className)}
    {...props}
  >
    {children}
  </h3>
);

export const CardContent: React.FC<CardProps> = ({ className, children, ...props }) => (
  <div className={cn('p-5 pt-3', className)} {...props}>
    {children}
  </div>
);

/** Inset content area — replaces inner-card-on-card patterns */
export const CardInset: React.FC<CardProps> = ({ className, children, ...props }) => (
  <div
    className={cn('rounded-lg bg-neutral-50 border border-neutral-100 p-4', className)}
    {...props}
  >
    {children}
  </div>
);
