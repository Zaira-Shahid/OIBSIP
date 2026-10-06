import api from './api'

// Returns { items: [...], summary: { total, low, outOfStock } }.
export async function fetchInventory() {
  const res = await api.get('/admin/inventory')
  return res.data.data
}

// `changes` is one of:
//   { stock, expectedStock }   set an absolute value; refused (409) if the stock changed since it was loaded
//   { adjustBy }               atomic +/- change that cannot go below 0
// optionally combined with { lowStockThreshold, active } (adjustBy may also be sent alone).
export async function updateInventoryItem(id, changes) {
  const res = await api.patch(`/admin/inventory/${encodeURIComponent(id)}`, changes)
  return res.data.data.item
}

// Demo helper: runs the same low-stock job the scheduler runs, with the same duplicate rules.
// Returns { checked, alerted: [{ name, category, stock, unit, lowStockThreshold, status }] }.
export async function runLowStockCheck() {
  const res = await api.post('/admin/inventory/check-low-stock')
  return res.data.data
}

// After a refused save the server includes the item's current state so just that row can be refreshed.
export const currentItemFromError = (error) => error.response?.data?.data?.item ?? null
