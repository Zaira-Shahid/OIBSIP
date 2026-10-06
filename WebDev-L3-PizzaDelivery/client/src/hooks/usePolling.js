import { useCallback, useEffect, useRef } from 'react'

// Calls `load` now and then every `intervalMs` while the tab is visible.
// - Pauses when the tab is hidden and refreshes straight away when it becomes visible again.
// - Never overlaps: a slow request is not followed by a second one.
// - Stops completely (timer and listener) when the component unmounts.
// `load` must handle its own errors. Returns `refresh`, which runs `load` once immediately (e.g. for a Retry button).
export default function usePolling(load, intervalMs) {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const inFlight = useRef(false)
  const run = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      await loadRef.current()
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    let timer = null
    const start = () => {
      run()
      timer = setInterval(() => !document.hidden && run(), intervalMs)
    }
    const stop = () => {
      clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else if (timer === null) start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, run])

  return run
}
