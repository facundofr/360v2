import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionContextValue {
  value: string | null
  onValueChange: (val: string) => void
  type: "single" | "multiple"
  openItems: string[]
}

const AccordionContext = React.createContext<AccordionContextValue>({
  value: null,
  onValueChange: () => {},
  type: "single",
  openItems: [],
})

interface AccordionProps {
  type?: "single" | "multiple"
  defaultValue?: string
  value?: string
  onValueChange?: (val: string) => void
  collapsible?: boolean
  className?: string
  children?: React.ReactNode
}

function Accordion({ type = "single", defaultValue, value, onValueChange, className, children }: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<string[]>(
    defaultValue ? [defaultValue] : value ? [value] : []
  )

  const handleValueChange = (val: string) => {
    setOpenItems(prev => {
      if (type === "single") {
        const isOpen = prev.includes(val)
        return isOpen ? [] : [val]
      }
      return prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    })
    onValueChange?.(val)
  }

  const controlled = value !== undefined ? [value] : openItems

  return (
    <AccordionContext.Provider value={{ value: controlled[0] ?? null, onValueChange: handleValueChange, type, openItems: controlled }}>
      <div className={cn("space-y-0", className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemContextValue { value: string }
const AccordionItemContext = React.createContext<AccordionItemContextValue>({ value: "" })

interface AccordionItemProps {
  value: string
  className?: string
  children?: React.ReactNode
}

function AccordionItem({ value, className, children }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div className={cn("border-b", className)}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

function AccordionTrigger({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { openItems, onValueChange } = React.useContext(AccordionContext)
  const { value } = React.useContext(AccordionItemContext)
  const isOpen = openItems.includes(value)

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between py-4 text-sm font-medium transition-all hover:underline text-left",
        className
      )}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {children}
      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
    </button>
  )
}

function AccordionContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { openItems } = React.useContext(AccordionContext)
  const { value } = React.useContext(AccordionItemContext)
  const isOpen = openItems.includes(value)

  if (!isOpen) return null

  return (
    <div className={cn("overflow-hidden text-sm pb-4", className)} {...props}>
      {children}
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
