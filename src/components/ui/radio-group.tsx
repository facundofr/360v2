import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupContextValue {
  value: string
  onValueChange: (val: string) => void
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  value: "",
  onValueChange: () => {},
})

interface RadioGroupProps {
  value?: string
  defaultValue?: string
  onValueChange?: (val: string) => void
  className?: string
  children?: React.ReactNode
}

function RadioGroup({ value: controlledValue, defaultValue = "", onValueChange, className, children }: RadioGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const value = controlledValue !== undefined ? controlledValue : internalValue

  const handleChange = (val: string) => {
    setInternalValue(val)
    onValueChange?.(val)
  }

  return (
    <RadioGroupContext.Provider value={{ value, onValueChange: handleChange }}>
      <div role="radiogroup" className={cn("grid gap-2", className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: string
}

function RadioGroupItem({ value, className, id, ...props }: RadioGroupItemProps) {
  const { value: groupValue, onValueChange } = React.useContext(RadioGroupContext)
  const checked = groupValue === value

  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={checked}
      onChange={() => onValueChange(value)}
      className={cn(
        "aspect-square size-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { RadioGroup, RadioGroupItem }
