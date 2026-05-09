import { forwardRef, SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, className = "", children, ...rest }, ref) => (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      )}
      <select
        ref={ref}
        id={id}
        className={`h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  )
);
Select.displayName = "Select";
