import * as React from "react"
import { cn } from "@/lib/utils"

export interface FloatingLabelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
}

const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ className, label, id, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(false)
    const inputId = id || `input-${label.toLowerCase().replace(/\s/g, '-')}`

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value !== '')
      props.onChange?.(e)
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "peer h-14 w-full rounded-lg border-2 border-gray-200 bg-white px-4 pt-6 pb-2 text-sm transition-all",
            "placeholder-transparent",
            "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={handleChange}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 transition-all duration-200 pointer-events-none",
            "peer-focus:top-3 peer-focus:text-xs peer-focus:text-primary-600",
            (isFocused || hasValue || props.value) && "top-3 text-xs text-primary-600"
          )}
        >
          {label}
        </label>
      </div>
    )
  }
)
FloatingLabelInput.displayName = "FloatingLabelInput"

export { FloatingLabelInput }
