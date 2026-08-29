function AdminPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-7">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-bold tracking-tight uppercase sm:text-2xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {children}
    </div>
  )
}

export { AdminPage }
