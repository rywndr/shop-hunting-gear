import { startRouteProgress } from "./lib/navigation/route-progress"

export function onRouterTransitionStart(url: string) {
  startRouteProgress(url)
}
