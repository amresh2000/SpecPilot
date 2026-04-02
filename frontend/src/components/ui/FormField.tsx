import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  hint,
  required,
  className,
  children,
}) => {
  const id = useId();
  const hintId  = hint  ? `${id}-hint`  : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-neutral-700">
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {hint && (
        <p id={hintId} className="text-xs text-neutral-500">{hint}</p>
      )}

      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': !!error })}

      {error && (
        <p id={errorId} className="text-xs text-red-500" role="alert">{error}</p>
      )}
    </div>
  );
};
