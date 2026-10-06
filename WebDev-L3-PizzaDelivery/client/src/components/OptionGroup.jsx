import { formatPrice } from '../utils/format'

// One builder step. `multiple` renders checkboxes (vegetables); otherwise radios (exactly one).
export default function OptionGroup({ legend, hint, name, options, selected, multiple, onChange, error }) {
  const isSelected = (id) => (multiple ? selected.includes(id) : selected === id)

  const toggle = (id) => {
    if (!multiple) return onChange(id)
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <fieldset className="option-group" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="option-group__legend">{legend}</legend>
      {hint && <p className="field__hint">{hint}</p>}
      <div className="option-grid">
        {options.map((option) => (
          <label
            key={option.id}
            className={`option${isSelected(option.id) ? ' option--selected' : ''}${option.available ? '' : ' option--disabled'}`}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={name}
              checked={isSelected(option.id)}
              disabled={!option.available}
              onChange={() => toggle(option.id)}
            />
            <span className="option__name">{option.name}</span>
            <span className="option__price">{option.available ? `+${formatPrice(option.price)}` : 'Out of stock'}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
