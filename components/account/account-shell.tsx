import { cn } from "@/lib/utils"

type AccountShellProps = {
  title: string
  description: string
  children: React.ReactNode
  className?: string
}

function AccountShell({
  title,
  description,
  children,
  className,
}: AccountShellProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-5xl px-4 py-6 md:py-10", className)}
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold tracking-tight uppercase sm:text-2xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  )
}

export { AccountShell }
