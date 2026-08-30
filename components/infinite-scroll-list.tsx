"use client"

import { Children, useEffect, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type InfiniteScrollListProps = {
  "aria-label": string
  children: ReactNode
  className?: string
  initialItemCount: number
  loadMoreItemCount: number
}

function InfiniteScrollList({
  "aria-label": ariaLabel,
  children,
  className,
  initialItemCount,
  loadMoreItemCount,
}: InfiniteScrollListProps) {
  const items = Children.toArray(children)
  const totalItemCount = items.length
  const [requestedItemCount, setRequestedItemCount] = useState(() =>
    Math.min(initialItemCount, totalItemCount)
  )
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const visibleItemCount = Math.min(requestedItemCount, totalItemCount)
  const hasMoreItems = visibleItemCount < totalItemCount

  useEffect(() => {
    const target = loadMoreRef.current

    if (!target || !hasMoreItems) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return
        }

        setRequestedItemCount((currentCount) =>
          Math.min(currentCount + loadMoreItemCount, totalItemCount)
        )
      },
      { rootMargin: "200px 0px" }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMoreItems, loadMoreItemCount, totalItemCount])

  const loadMore = () => {
    setRequestedItemCount((currentCount) =>
      Math.min(currentCount + loadMoreItemCount, totalItemCount)
    )
  }

  return (
    <div>
      <ul aria-label={ariaLabel} className={cn(className)}>
        {items.slice(0, visibleItemCount)}
      </ul>

      <p aria-live="polite" className="sr-only">
        Menampilkan {visibleItemCount} dari {totalItemCount} item.
      </p>

      {hasMoreItems && (
        <div ref={loadMoreRef} className="flex justify-center pt-6">
          <Button type="button" variant="outline" onClick={loadMore}>
            Muat lebih banyak
          </Button>
        </div>
      )}
    </div>
  )
}

export { InfiniteScrollList }
