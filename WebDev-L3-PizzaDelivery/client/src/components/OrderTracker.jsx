import { ORDER_STATUS_LABELS } from '../utils/format'

const STEPS = ['ORDER_RECEIVED', 'IN_KITCHEN', 'SENT_TO_DELIVERY']

// Three-step progress for an order. State is shown with text and icons, not colour alone.
export default function OrderTracker({ status }) {
  const current = STEPS.indexOf(status)

  return (
    <ol className="tracker" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={step} className={`tracker__step tracker__step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="tracker__mark" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
            <span>
              {ORDER_STATUS_LABELS[step]}
              {state === 'done' && <span className="sr-only"> (done)</span>}
              {state === 'current' && <span className="sr-only"> (current step)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
