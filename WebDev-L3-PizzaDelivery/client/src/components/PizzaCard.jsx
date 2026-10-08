import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../utils/format'

export default function PizzaCard({ pizza }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className="pizza-card">
      {imageFailed ? (
        <div className="pizza-card__image pizza-card__image--fallback" role="img" aria-label={`${pizza.name} (photo unavailable)`}>
          🍕
        </div>
      ) : (
        <img
          className="pizza-card__image"
          src={pizza.image}
          alt={pizza.name}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="pizza-card__body">
        <h2 className="pizza-card__name">{pizza.name}</h2>
        <p className="pizza-card__desc">{pizza.description}</p>
        {pizza.ingredients?.length > 0 && <p className="pizza-card__includes">{pizza.ingredients.join(' · ')}</p>}
        <div className="pizza-card__footer">
          <span className="pizza-card__price">{formatPrice(pizza.price)}</span>
          {/* The builder opens with this preset's ingredients selected; the price is the sum of those ingredients. */}
          <Link
            className="btn"
            to="/builder"
            state={{ preset: { name: pizza.name, selection: pizza.selection } }}
            aria-label={`Customize ${pizza.name}`}
          >
            Customize
          </Link>
        </div>
      </div>
    </article>
  )
}
