import * as React from "react"
import { cn } from "@/lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  blur?: "sm" | "md" | "lg"
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, blur = "md", children, ...props }, ref) => {
    const blurStyles = {
      sm: "backdrop-blur-sm",
      md: "backdrop-blur-md",
      lg: "backdrop-blur-lg"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-white/20 bg-white/10 p-6 shadow-strong",
          blurStyles[blur],
          "transition-all hover:bg-white/20 hover:shadow-xl",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }
