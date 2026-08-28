import Link from "next/link"

type AuthCardProps = {
  title: string
  description: string
  children: React.ReactNode
  alternate: {
    prompt: string
    label: string
    href: string
  }
}

function AuthCard({ title, description, children, alternate }: AuthCardProps) {
  return (
    <section className="w-full max-w-md border border-border bg-card p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight uppercase">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6">{children}</div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {alternate.prompt}{" "}
        <Link
          href={alternate.href}
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          {alternate.label}
        </Link>
      </p>
    </section>
  )
}

export { AuthCard }
