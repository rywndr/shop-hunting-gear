import { cn } from "@/lib/utils"

type ProductSectionProps = {
  id: string
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function ProductSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: ProductSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className={cn("flex scroll-mt-24 flex-col gap-4", className)}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={id}
            className="font-heading text-lg font-bold tracking-tight uppercase sm:text-xl"
          >
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {action && <div className="ms-auto">{action}</div>}
      </div>

      {children}
    </section>
  )
}

export { ProductSection }
