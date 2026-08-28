import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FLAT_CARD = "border border-border shadow-none ring-0"

type AccountCardProps = {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  tone?: "default" | "destructive"
  className?: string
}

function AccountCard({
  title,
  description,
  children,
  footer,
  tone = "default",
  className,
}: AccountCardProps) {
  return (
    <Card
      className={cn(
        FLAT_CARD,
        tone === "destructive" && "border-destructive/40",
        className
      )}
    >
      <CardHeader>
        <CardTitle
          className={cn(
            "tracking-tight uppercase",
            tone === "destructive" && "text-destructive"
          )}
        >
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent>{children}</CardContent>

      {footer && (
        <CardFooter className="flex-wrap gap-3 border-t">{footer}</CardFooter>
      )}
    </Card>
  )
}

type AccountFormCardProps = Omit<AccountCardProps, "footer" | "tone"> & {
  onSubmit: React.FormEventHandler<HTMLFormElement>
  submitLabel: string
  secondaryAction?: React.ReactNode
}

function AccountFormCard({
  onSubmit,
  submitLabel,
  secondaryAction,
  children,
  ...props
}: AccountFormCardProps) {
  return (
    <form noValidate onSubmit={onSubmit}>
      <AccountCard
        {...props}
        footer={
          <>
            <Button type="submit" className="h-10">
              {submitLabel}
            </Button>
            {secondaryAction}
          </>
        }
      >
        <FieldGroup className="gap-4">{children}</FieldGroup>
      </AccountCard>
    </form>
  )
}

export { AccountCard, AccountFormCard, FLAT_CARD }
