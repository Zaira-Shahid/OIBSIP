import { useState } from 'react'
import { Link } from 'react-router-dom'

const formatPrice = (price) => `₹${price.toLocaleString('en-IN')}`

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
        <div className="pizza-card__footer">
          <span className="pizza-card__price">{formatPrice(pizza.price)}</span>
          {/* The builder arrives in Module 5; the route is wired then. */}
          <Link className="btn" to="/builder" state={{ pizzaId: pizza.id }} aria-label={`Customize ${pizza.name}`}>
            Customize
          </Link>
        </div>
      </div>
    </article>
  )
}
