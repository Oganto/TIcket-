import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatNaira } from '../hooks/useTicketCatalog'
import type { CatalogTicket } from '../hooks/useTicketCatalog'

const LOW_STOCK = 10

const tagFor = { Regular: 'Regular', Premium: 'Premium', Tables: 'Table' } as const

type PassCardProps = {
  ticket: CatalogTicket
  /** Extra data forwarded to checkout alongside the ticket details */
  extraState?: Record<string, unknown>
}

export function PassCard({ ticket, extraState }: PassCardProps) {
  const soldOut = ticket.available <= 0
  const low = !soldOut && ticket.available <= LOW_STOCK
  const availability = soldOut ? 'Sold out' : low ? `Only ${ticket.available} left` : `${ticket.available} available`
  const classes = ['to-pass', ticket.featured ? 'is-featured' : '', soldOut ? 'is-soldout' : ''].filter(Boolean).join(' ')

  return (
    <article className={classes} aria-label={`${ticket.name}, ${formatNaira(ticket.price)}, ${availability}`}>
      <div className="to-pass-main">
        <span className="to-pass-tag">{tagFor[ticket.group]}</span>
        <h4>{ticket.name}</h4>
        {ticket.description && <p className="to-pass-desc">{ticket.description}</p>}
        <p className={soldOut ? 'to-pass-avail is-out' : low ? 'to-pass-avail is-low' : 'to-pass-avail'}><i />{availability}</p>
      </div>
      <div className="to-pass-stub">
        <div className="to-pass-price">{formatNaira(ticket.price)}<small>{ticket.group === 'Tables' ? 'per table' : 'per person'}</small></div>
        {soldOut
          ? <span className="to-btn-disabled" aria-disabled="true">Sold out</span>
          : <Link className="to-btn" to="/checkout" state={{ ticketId: ticket.id, eventId: ticket.eventId, ticketName: ticket.name, price: ticket.price, ...extraState }}>Select <ArrowUpRight size={16} /></Link>}
      </div>
    </article>
  )
}
