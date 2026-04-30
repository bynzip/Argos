import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full px-3.5 py-2.5 bg-white border-2 border-[var(--gray-300)] rounded-lg text-[14px] text-[var(--gray-800)] outline-none transition-all placeholder:text-[var(--gray-400)] hover:border-[var(--gray-400)] focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_0_3px_rgba(35,71,165,0.12)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-400)] disabled:cursor-not-allowed resize-vertical",
          error && "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.10)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
