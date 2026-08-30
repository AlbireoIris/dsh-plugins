/**
 * Shared panel open state: one file-browser panel, two entry buttons
 * (sidebar foot + composer tool row). Module-scope observable like the
 * community plugins' shared chrome; both buttons subscribe and toggle it.
 */
let open = false
const listeners = new Set<() => void>()

/** Current panel state (snapshot for useSyncExternalStore). */
export function panelOpen(): boolean {
  return open
}

/** Flip the panel; every listener re-renders. */
export function togglePanel(): void {
  open = !open
  for (const listener of listeners) listener()
}

/** Subscribe to panel changes; returns the disposer. */
export function subscribePanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
