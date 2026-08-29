import Link from "next/link"
import { CaretRightIcon } from "@phosphor-icons/react/ssr"

import { FLAT_CARD } from "@/components/account/account-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AdminCardProps = {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  contentClassName?: string
}

function AdminCard({
  title,
  description,
  action,
  children,
  footer,
  className,
  contentClassName,
}: AdminCardProps) {
  return (
    <Card className={cn(FLAT_CARD, className)}>
      {(title || description || action) && (
        <CardHeader>
          {title && (
            <CardTitle className="tracking-tight uppercase">{title}</CardTitle>
          )}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}

      <CardContent className={contentClassName}>{children}</CardContent>

      {footer && (
        <CardFooter className="flex-wrap gap-3 border-t">{footer}</CardFooter>
      )}
    </Card>
  )
}

function AdminCardLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Button
      variant="link"
      size="sm"
      nativeButton={false}
      render={<Link href={href} />}
      className="px-0 text-xs"
    >
      {children}
      <CaretRightIcon className="size-3.5" aria-hidden />
    </Button>
  )
}

const TABLE_EDGE = "first:pl-(--card-spacing) last:pr-(--card-spacing)"

type AdminMetric = {
  readonly label: string
  readonly meta?: React.ReactNode
  readonly value: string
  readonly footnote?: React.ReactNode
}

function AdminMetricGrid({ metrics }: { metrics: readonly AdminMetric[] }) {
  return (
    <dl className="grid divide-y divide-border sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="px-(--card-spacing) py-3 first:pt-0 last:pb-0 sm:py-0"
        >
          <dt className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span className="font-medium tracking-wide uppercase">
              {metric.label}
            </span>
            {metric.meta}
          </dt>
          <dd className="mt-1.5">
            <span className="block font-heading text-xl font-bold tabular-nums sm:text-2xl">
              {metric.value}
            </span>
            {metric.footnote}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export { AdminCard, AdminCardLink, AdminMetricGrid, TABLE_EDGE }
export type { AdminMetric }
