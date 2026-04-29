import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full h-10 px-3.5 py-2 bg-white border-1.5 border-[var(--gray-300)] rounded-lg text-[14px] text-[var(--gray-800)] outline-none transition-all placeholder:text-[var(--gray-400)] hover:border-[var(--gray-400)] focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_0_3px_rgba(35,71,165,0.12)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-400)] disabled:cursor-not-allowed",
          error && "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.10)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
