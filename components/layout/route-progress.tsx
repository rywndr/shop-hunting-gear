"use client"

import { useEffect, useSyncExternalStore } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  completeRouteProgress,
  getRouteProgressServerSnapshot,
  getRouteProgressSnapshot,
  subscribe,
} from "@/lib/navigation/route-progress"

function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { visible } = useSyncExternalStore(
    subscribe,
    getRouteProgressSnapshot,
    getRouteProgressServerSnapshot
  )

  useEffect(() => {
    const query = searchParams.toString()
    completeRouteProgress(query ? `${pathname}?${query}` : pathname)
  }, [pathname, searchParams])

  if (!visible) {
    return null
  }

  return (
    <>
      <div className="route-loading" aria-hidden="true">
        <div className="route-loading__indicator" />
      </div>
      <p className="sr-only" role="status">
        Memuat halaman…
      </p>
    </>
  )
}

export { RouteProgress }
