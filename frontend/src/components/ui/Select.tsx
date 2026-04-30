import * as React from "react"
import { cn } from "../../lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          className={cn(
            "flex w-full h-10 px-3.5 py-2 bg-white border-2 border-[var(--gray-300)] rounded-lg text-[14px] text-[var(--gray-800)] outline-none transition-all appearance-none hover:border-[var(--gray-400)] focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_0_3px_rgba(35,71,165,0.12)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-400)] disabled:cursor-not-allowed",
            error && "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.10)]",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--gray-400)]">
          <ChevronDown size={16} />
        </div>
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
