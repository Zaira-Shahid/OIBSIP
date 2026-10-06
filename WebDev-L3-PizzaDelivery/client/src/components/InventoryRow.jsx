import { useState } from 'react'
import { getErrorMessage } from '../services/api'
import { currentItemFromError, updateInventoryItem } from '../services/inventoryService'

const MAX = 1000000
const RESTOCK = [10, 50]
const STATUS = {
  OK: { label: 'OK', mark: '✓' },
  LOW: { label: 'Low stock', mark: '!' },
  OUT_OF_STOCK: { label: 'Out of stock', mark: '✕' },
}

// Whole number 0..MAX, or null when the text is not one.
const parseCount = (text) => {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n <= MAX ? n : null
}

// One inventory item. `draft` holds only what the admin has typed; null means "show the saved value", so a
// refreshed row never needs syncing.
export default function InventoryRow({ item, onChange }) {
  const [draft, setDraft] = useState({ stock: null, threshold: null })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { kind: 'ok' | 'error', text }

  const stockText = draft.stock ?? String(item.stock)
  const thresholdText = draft.threshold ?? String(item.lowStockThreshold)
  const stockValue = parseCount(stockText)
  const thresholdValue = parseCount(thresholdText)
  const stockChanged = draft.stock !== null && stockValue !== item.stock
  const thresholdChanged = draft.threshold !== null && thresholdValue !== item.lowStockThreshold
  const invalid = (draft.stock !== null && stockValue === null) || (draft.threshold !== null && thresholdValue === null)
  const status = STATUS[item.status]

  async function run(changes, successText) {
    setBusy(true)
    setMessage(null)
    try {
      onChange(await updateInventoryItem(item.id, changes))
      setDraft({ stock: null, threshold: null })
      setMessage({ kind: 'ok', text: successText })
    } catch (err) {
      const fresh = currentItemFromError(err)
      if (fresh) {
        // Stock moved while the admin was editing: show the new value and drop the stale draft.
        onChange(fresh)
        setDraft({ stock: null, threshold: null })
      }
      setMessage({ kind: 'error', text: getErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const changes = {}
    if (stockChanged) Object.assign(changes, { stock: stockValue, expectedStock: item.stock })
    if (thresholdChanged) changes.lowStockThreshold = thresholdValue
    return run(changes, 'Saved.')
  }

  const label = (what) => `${what} for ${item.name}`

  return (
    <tr className={item.active ? '' : 'inv-row--inactive'}>
      <th scope="row" data-label="Item">
        {item.name}
        {!item.active && <span className="inv-tag"> Hidden from customers</span>}
      </th>
      <td data-label="In stock">
        {item.stock.toLocaleString('en-IN')} {item.unit}
      </td>
      <td data-label="Set stock to">
        <input
          className="inv-input"
          inputMode="numeric"
          aria-label={label('Set stock')}
          aria-invalid={draft.stock !== null && stockValue === null}
          value={stockText}
          disabled={busy}
          onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
        />
      </td>
      <td data-label="Low-stock threshold">
        <input
          className="inv-input"
          inputMode="numeric"
          aria-label={label('Low-stock threshold')}
          aria-invalid={draft.threshold !== null && thresholdValue === null}
          value={thresholdText}
          disabled={busy}
          onChange={(e) => setDraft((d) => ({ ...d, threshold: e.target.value }))}
        />
      </td>
      <td data-label="Status">
        <span className={`badge badge--${item.status.toLowerCase()}`}>
          <span aria-hidden="true">{status.mark}</span> {status.label}
        </span>
      </td>
      <td data-label="Actions">
        <div className="inv-actions">
          <button type="button" className="btn" disabled={busy || invalid || !(stockChanged || thresholdChanged)} onClick={save} aria-label={label('Save changes')}>
            Save
          </button>
          {RESTOCK.map((n) => (
            <button key={n} type="button" className="btn btn--ghost" disabled={busy} onClick={() => run({ adjustBy: n }, `Added ${n}.`)} aria-label={`Add ${n} to ${item.name}`}>
              +{n}
            </button>
          ))}
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => run({ active: !item.active }, item.active ? 'Hidden from customers.' : 'Visible to customers.')}>
            {item.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
        {invalid && <p className="field__error" role="alert">Use a whole number from 0 to {MAX.toLocaleString('en-IN')}.</p>}
        {message && (
          <p className={message.kind === 'error' ? 'field__error' : 'inv-ok'} role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
      </td>
    </tr>
  )
}
