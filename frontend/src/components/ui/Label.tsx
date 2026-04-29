import * as React from "react"
import { cn } from "../../lib/utils"

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-[13px] font-medium text-[var(--gray-700)] mb-1.5 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-[var(--color-danger)] ml-1">*</span>}
    </label>
  )
)
Label.displayName = "Label"

export { Label }
