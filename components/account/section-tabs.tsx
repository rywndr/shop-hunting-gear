"use client"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type SectionTab = {
  readonly value: string
  readonly label: string
  readonly count?: number
  readonly panel: React.ReactNode
}

type SectionTabsProps = {
  label: string
  tabs: readonly SectionTab[]
  className?: string
}

function SectionTabs({ label, tabs, className }: SectionTabsProps) {
  return (
    <Tabs defaultValue={tabs[0]?.value} className={cn("gap-5", className)}>
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
