import { useEffect, useState } from 'react'
import { getHealth } from '../services/healthService'

// Returns 'checking' | 'ok' | 'degraded' | 'offline'
export default function useApiHealth() {
  const [state, setState] = useState('checking')

  useEffect(() => {
    let active = true
    getHealth()
      .then((body) => active && setState(body.success ? 'ok' : 'degraded'))
      .catch(() => active && setState('offline'))
    return () => {
      active = false
    }
  }, [])

  return state
}
