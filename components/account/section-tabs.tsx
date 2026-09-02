"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type SectionTab = {
  readonly value: string
  readonly label: string
  readonly count?: React.ReactNode
  readonly panel: React.ReactNode
}

type SectionTabsProps = {
  label: string
  tabs: readonly SectionTab[]
  className?: string
  activeValue?: string
  queryParam?: string
}

function SectionTabs({
  label,
  tabs,
  className,
  activeValue,
  queryParam,
}: SectionTabsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  function changeTab(value: string | null) {
    if (!queryParam || value === null) return

    const params = new URLSearchParams(searchParams.toString())
    if (value === tabs[0]?.value) params.delete(queryParam)
    else params.set(queryParam, value)
    params.delete("page")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Tabs
      defaultValue={activeValue === undefined ? tabs[0]?.value : undefined}
      value={activeValue}
      onValueChange={changeTab}
      className={cn("gap-5", className)}
    >
      <div className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
        <TabsList
          aria-label={label}
          variant="line"
          className="h-auto! w-max min-w-full justify-start gap-0 border-b border-border p-0 pb-[5px]"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-11! flex-none gap-2 px-4 font-medium"
            >
              {tab.label}
              {tab.count !== undefined && (
                <Badge variant="secondary" className="px-1.5 tabular-nums">
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.panel}
        </TabsContent>
      ))}
    </Tabs>
  )
}

export { SectionTabs, type SectionTab }
