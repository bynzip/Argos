import * as React from "react"
import { cn } from "../../lib/utils"

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, className, ...props }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-7", className)} {...props}>
      <div className="space-y-1">
        <h1 className="text-[22px] font-bold text-[var(--gray-800)] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] text-[var(--gray-500)] font-medium">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
