import { formatPrice } from '../utils/format'

const ROWS = [
  { category: 'base', label: 'Base' },
  { category: 'sauce', label: 'Sauce' },
  { category: 'cheese', label: 'Cheese' },
  { category: 'vegetable', label: 'Vegetables' },
]

// Itemised price table. `items` is [{ category, name, price }]; every figure comes from the server.
export default function PizzaBreakdown({ items, unitPrice, quantity, total }) {
  return (
    <table className="breakdown">
      <caption className="sr-only">Pizza price breakdown</caption>
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col">Choice</th>
          <th scope="col" className="breakdown__num">Price</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(({ category, label }) => {
          const chosen = items.filter((i) => i.category === category)
          if (chosen.length === 0) {
            return (
              <tr key={category}>
                <th scope="row">{label}</th>
                <td className="summary__none">None</td>
                <td className="breakdown__num">—</td>
              </tr>
            )
          }
          return chosen.map((item, i) => (
            <tr key={`${category}-${item.name}`}>
              <th scope="row">{i === 0 ? label : <span className="sr-only">{label}</span>}</th>
              <td>{item.name}</td>
              <td className="breakdown__num">{formatPrice(item.price)}</td>
            </tr>
          ))
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={2}>Price per pizza</th>
          <td className="breakdown__num">{formatPrice(unitPrice)}</td>
        </tr>
        <tr>
          <th scope="row" colSpan={2}>Quantity</th>
          <td className="breakdown__num">× {quantity}</td>
        </tr>
        <tr className="breakdown__total">
          <th scope="row" colSpan={2}>Total</th>
          <td className="breakdown__num">{formatPrice(total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}
