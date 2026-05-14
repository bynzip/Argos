import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-blue)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-gradient text-white shadow-[0_2px_8px_rgba(35,71,165,0.20)] hover:opacity-90 hover:shadow-[0_4px_16px_rgba(35,71,165,0.28)] border-none",
        secondary:
          "bg-white text-[var(--gray-700)] border border-[var(--gray-300)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-[var(--gray-50)] hover:border-[var(--gray-400)]",
        ghost:
          "bg-transparent text-[var(--gray-500)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-700)]",
        danger:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)] hover:bg-[var(--color-danger-bg)] hover:border-[var(--color-danger)]",
        outline:
          "bg-transparent border border-[var(--gray-300)] text-[var(--gray-600)] hover:border-[var(--color-brand-blue)] hover:text-[var(--color-brand-blue)]",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px] rounded-[6px]",
        md: "h-[38px] px-5 text-[14px] rounded-lg",
        lg: "h-11 px-7 text-[15px] rounded-lg",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
