type RouteProgressSnapshot = {
  readonly generation: number
  readonly pending: boolean
  readonly visible: boolean
  readonly committed: string | null
  readonly source: string | null
  readonly target: string | null
}

type Listener = () => void

const DISPLAY_DELAY_MS = 120
const STUCK_TIMEOUT_MS = 120_000
const listeners = new Set<Listener>()
const serverSnapshot: RouteProgressSnapshot = {
  generation: 0,
  pending: false,
  visible: false,
  committed: null,
  source: null,
  target: null,
}

let snapshot = serverSnapshot
let displayTimer: ReturnType<typeof setTimeout> | undefined
let stuckTimer: ReturnType<typeof setTimeout> | undefined

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function clearTimers() {
  clearTimeout(displayTimer)
  clearTimeout(stuckTimer)
  displayTimer = undefined
  stuckTimer = undefined
}

function canonicalRoute(url: string) {
  const parsed = new URL(url, window.location.href)
  const query = parsed.searchParams.toString()
  return query ? `${parsed.pathname}?${query}` : parsed.pathname
}

function startRouteProgress(url: string) {
  const target = canonicalRoute(url)
  const source = snapshot.committed

  if (target === source) {
    if (snapshot.pending) {
      clearTimers()

      const generation = snapshot.generation + 1
      snapshot = {
        generation,
        pending: false,
        visible: false,
        committed: snapshot.committed,
        source: null,
        target: null,
      }
      notify()
    }

    return
  }

  clearTimers()

  const generation = snapshot.generation + 1
  snapshot = {
    generation,
    pending: true,
    visible: false,
    committed: snapshot.committed,
    source,
    target,
  }
  notify()

  displayTimer = setTimeout(() => {
    if (snapshot.generation !== generation || !snapshot.pending) {
      return
    }

    snapshot = { ...snapshot, visible: true }
    notify()
  }, DISPLAY_DELAY_MS)

  stuckTimer = setTimeout(() => {
    if (snapshot.generation !== generation) {
      return
    }

    snapshot = {
      generation,
      pending: false,
      visible: false,
      committed: snapshot.committed,
      source: null,
      target: null,
    }
    notify()
  }, STUCK_TIMEOUT_MS)
}

function completeRouteProgress(url: string) {
  const committed = canonicalRoute(url)

  if (!snapshot.pending) {
    if (committed !== snapshot.committed) {
      snapshot = { ...snapshot, committed }
      notify()
    }

    return
  }

  if (committed === snapshot.source) {
    return
  }

  const generation = snapshot.generation
  clearTimers()
  snapshot = {
    generation,
    pending: false,
    visible: false,
    committed,
    source: null,
    target: null,
  }
  notify()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getRouteProgressSnapshot() {
  return snapshot
}

function getRouteProgressServerSnapshot() {
  return serverSnapshot
}

export {
  completeRouteProgress,
  getRouteProgressServerSnapshot,
  getRouteProgressSnapshot,
  startRouteProgress,
  subscribe,
}
