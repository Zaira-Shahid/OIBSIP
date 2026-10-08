import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import OptionGroup from '../components/OptionGroup'
import { getErrorMessage } from '../services/api'
import { fetchCustomPizzaPrice, fetchIngredients } from '../services/pizzaService'
import { formatPrice } from '../utils/format'

const STEPS = [
  { key: 'base', label: 'Base', legend: 'Choose your base', multiple: false },
  { key: 'sauce', label: 'Sauce', legend: 'Choose your sauce', multiple: false },
  {
    key: 'cheese',
    label: 'Cheese',
    legend: 'Choose a cheese',
    hint: 'Pick exactly one.',
    multiple: false,
  },
  {
    key: 'vegetables',
    label: 'Veggies',
    legend: 'Add vegetables',
    hint: 'Optional. Pick as many as you like.',
    multiple: true,
  },
]
const SUMMARY = STEPS.length
const REQUIRED_MESSAGE = { base: 'Please choose a base.', sauce: 'Please choose a sauce.', cheese: 'Please choose a cheese.' }
const EMPTY = { base: '', sauce: '', cheese: '', vegetables: [] }

// Ingredient groups use "vegetable" as the category; the selection uses "vegetables".
const optionsFor = (ingredients, key) => ingredients[key === 'vegetables' ? 'vegetable' : key]

export default function Builder() {
  const [load, setLoad] = useState({ status: 'loading', ingredients: null, error: '' })
  const [attempt, setAttempt] = useState(0)
  const locationState = useLocation().state
  // Coming back from the order summary restores the pizza and opens the review step.
  const returned = locationState?.selection
  // Opened from a menu card: start at step 1 with that preset's ingredients already selected.
  const preset = returned ? null : locationState?.preset
  const navigate = useNavigate()
  const [step, setStep] = useState(returned ? SUMMARY : 0)
  const [selection, setSelection] = useState(returned ?? EMPTY)
  const [presetNote, setPresetNote] = useState('')
  const presetApplied = useRef(false)
  const [error, setError] = useState('')
  const [priceResult, setPrice] = useState({ key: '', status: 'loading', total: null, error: '' })
  const headingRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetchIngredients()
      .then((ingredients) => {
        if (cancelled) return
        setLoad({ status: 'ready', ingredients, error: '' })
        // Pre-select the preset once. Anything that is out of stock right now is left unselected and the customer is told.
        if (preset && !presetApplied.current) {
          presetApplied.current = true
          const available = new Set(Object.values(ingredients).flat().filter((o) => o.available).map((o) => o.id))
          const { base, sauce, cheese, vegetables } = preset.selection
          const wanted = [base, sauce, cheese, ...vegetables]
          const missing = wanted.filter((id) => !available.has(id)).length
          setSelection({
            base: available.has(base) ? base : '',
            sauce: available.has(sauce) ? sauce : '',
            cheese: available.has(cheese) ? cheese : '',
            vegetables: vegetables.filter((id) => available.has(id)),
          })
          setPresetNote(
            missing
              ? `Starting from ${preset.name}. ${missing === 1 ? 'One ingredient is' : `${missing} ingredients are`} out of stock right now, so you will need to pick a replacement.`
              : `Starting from ${preset.name}. Change anything you like.`,
          )
        }
      })
      .catch((err) => !cancelled && setLoad({ status: 'error', ingredients: null, error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [attempt, preset])

  // Move keyboard/screen-reader focus to the new step's heading.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step, load.status])

  // The summary shows the server's price. The running total in the footer is only a preview.
  const selectionKey = JSON.stringify(selection)
  // A result for an older selection counts as "still confirming".
  const price = priceResult.key === selectionKey ? priceResult : { status: 'loading' }
  useEffect(() => {
    if (step !== SUMMARY) return undefined
    let cancelled = false
    fetchCustomPizzaPrice(JSON.parse(selectionKey))
      .then((data) => !cancelled && setPrice({ key: selectionKey, status: 'ready', total: data.total, error: '' }))
      .catch((err) => !cancelled && setPrice({ key: selectionKey, status: 'error', total: null, error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [step, selectionKey])

  if (load.status === 'loading') {
    return (
      <section className="card center-note" aria-busy="true">
        <p>Loading ingredients…</p>
      </section>
    )
  }

  if (load.status === 'error') {
    return (
      <section className="card center-note" role="alert">
        <p className="form-error">{load.error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setLoad({ status: 'loading', ingredients: null, error: '' })
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </section>
    )
  }

  const { ingredients } = load
  const chosen = (key) => {
    const options = optionsFor(ingredients, key)
    return key === 'vegetables'
      ? options.filter((o) => selection.vegetables.includes(o.id))
      : options.filter((o) => o.id === selection[key])
  }
  const picked = STEPS.flatMap((s) => chosen(s.key))
  const previewTotal = picked.reduce((sum, o) => sum + o.price, 0)

  const goTo = (n) => {
    setError('')
    setStep(n)
  }
  const next = () => {
    const current = STEPS[step]
    if (!current.multiple && !selection[current.key]) return setError(REQUIRED_MESSAGE[current.key])
    goTo(step + 1)
  }
  const choose = (key) => (value) => {
    setError('')
    setSelection((s) => ({ ...s, [key]: value }))
  }

  const current = STEPS[step]

  return (
    <section className="builder">
      <header className="page-head">
        <h1>Build your pizza</h1>
        <p className="lead">Four quick steps, then review your order.</p>
      </header>

      {presetNote && <p className="notice card" role="status">{presetNote}</p>}

      <ol className="stepper" aria-label="Progress">
        {[...STEPS, { key: 'summary', label: 'Review' }].map((s, i) => (
          <li
            key={s.key}
            className={`stepper__item${i === step ? ' stepper__item--current' : ''}${i < step ? ' stepper__item--done' : ''}`}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="stepper__num" aria-hidden="true">{i < step ? '✓' : i + 1}</span>
            <span className="stepper__label">
              {s.label}
              {i < step && <span className="sr-only"> (completed)</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="card builder__panel">
        {step < SUMMARY && (
          <>
            <h2 ref={headingRef} tabIndex={-1} className="builder__heading">
              Step {step + 1} of {STEPS.length}: {current.label}
            </h2>
            <OptionGroup
              key={current.key}
              legend={current.legend}
              hint={current.hint}
              name={current.key}
              options={optionsFor(ingredients, current.key)}
              selected={selection[current.key]}
              multiple={current.multiple}
              onChange={choose(current.key)}
              error={error}
            />
          </>
        )}

        {step === SUMMARY && (
          <>
            <h2 ref={headingRef} tabIndex={-1} className="builder__heading">Your pizza</h2>
            <dl className="summary">
              {STEPS.map((s, i) => (
                <div key={s.key} className="summary__row">
                  <dt>{s.label}</dt>
                  <dd>
                    {chosen(s.key).length === 0 ? (
                      <span className="summary__none">None</span>
                    ) : (
                      <ul className="summary__list">
                        {chosen(s.key).map((o) => (
                          <li key={o.id}>
                            {o.name} <span className="summary__price">{formatPrice(o.price)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button type="button" className="link-btn" onClick={() => goTo(i)} aria-label={`Change ${s.label.toLowerCase()}`}>
                      Change
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="summary__total" aria-live="polite">
              <span>Total</span>
              {price.status === 'loading' && <span>Confirming price…</span>}
              {price.status === 'ready' && <strong>{formatPrice(price.total)}</strong>}
              {price.status === 'error' && <span>—</span>}
            </div>
            {price.status === 'error' && (
              <p className="form-error" role="alert">
                {price.error} Go back to change your selection.
              </p>
            )}
          </>
        )}

        <div className="builder__nav">
          {step === 0 ? (
            <Link className="btn btn--ghost" to="/dashboard">Back to menu</Link>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={() => goTo(step - 1)}>Back</button>
          )}
          {step < SUMMARY ? (
            <button type="button" className="btn" onClick={next}>
              {step === SUMMARY - 1 ? 'Review pizza' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={price.status !== 'ready'}
              onClick={() => navigate('/order-summary', { state: { selection } })}
            >
              Continue to summary
            </button>
          )}
        </div>
      </div>

      {step < SUMMARY && (
        <p className="builder__preview" aria-live="polite">
          Running total: <strong>{formatPrice(previewTotal)}</strong>
        </p>
      )}
    </section>
  )
}
