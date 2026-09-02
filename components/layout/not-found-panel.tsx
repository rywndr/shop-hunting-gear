import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

type NotFoundPanelProps = {
  readonly title: string
  readonly description: string
}

function NotFoundPanel({ title, description }: NotFoundPanelProps) {
  return (
    <Empty className="mx-auto max-w-2xl px-4 py-16 md:py-24">
      <EmptyHeader>
        <p className="text-xs font-medium tracking-widest text-muted-foreground tabular-nums">
          404
        </p>
        <EmptyTitle className="text-xl font-bold sm:text-2xl">
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export { NotFoundPanel }
