import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchFormProps = {
  className?: string
  id?: string
}

// Pleacholder search
function SearchForm({ className, id = "site-search" }: SearchFormProps) {
  return (
    <form role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Cari produk
      </label>
      <Input
        id={id}
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Cari produk"
        className="h-10 bg-background pr-11 text-foreground"
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon-lg"
        aria-label="Cari"
        className="absolute inset-y-0 right-0 h-10 w-11 text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <MagnifyingGlassIcon className="size-5" />
      </Button>
    </form>
  )
}

export { SearchForm }
