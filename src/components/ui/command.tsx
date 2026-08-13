import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface CommandContextValue {
  search: string
  setSearch: (s: string) => void
}

const CommandContext = React.createContext<CommandContextValue>({ search: "", setSearch: () => {} })

function Command({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [search, setSearch] = React.useState("")
  return (
    <CommandContext.Provider value={{ search, setSearch }}>
      <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className)} {...props}>
        {children}
      </div>
    </CommandContext.Provider>
  )
}

function CommandInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const { search, setSearch } = React.useContext(CommandContext)
  return (
    <div className="flex items-center border-b px-3">
      <Search className="mr-2 size-4 shrink-0 opacity-50" />
      <input
        className={cn("flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className)}
        value={props.value !== undefined ? props.value : search}
        onChange={e => { setSearch(e.target.value); props.onChange?.(e) }}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)} {...props}>
      {children}
    </div>
  )
}

function CommandEmpty({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground" {...props}>
      {children}
    </div>
  )
}

function CommandGroup({ heading, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { heading?: string }) {
  return (
    <div className={cn("overflow-hidden p-1 text-foreground", className)} {...props}>
      {heading && <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{heading}</div>}
      {children}
    </div>
  )
}

function CommandItem({ className, onSelect, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { onSelect?: (value: string) => void }) {
  return (
    <div
      role="option"
      aria-selected={false}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      onClick={() => onSelect?.((props as Record<string, unknown>)["data-value"] as string ?? "")}
      {...props}
    >
      {children}
    </div>
  )
}

function CommandSeparator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn("-mx-1 h-px bg-border", className)} {...props} />
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator }
