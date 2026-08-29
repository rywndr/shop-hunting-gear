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
  title: string
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
      <CardHeader>
        <CardTitle className="tracking-tight uppercase">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>

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

export { AdminCard, AdminCardLink }
