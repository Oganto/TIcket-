import { PassCard } from './PassCard'
import type { CatalogTicket } from '../hooks/useTicketCatalog'

type PassGroupsProps = {
  tickets: CatalogTicket[]
  extraState?: Record<string, unknown>
}

/** Entry passes (Regular, VIP, VVIP...) and Tables, straight from the live catalog. */
export function PassGroups({ tickets, extraState }: PassGroupsProps) {
  const entry = tickets.filter((ticket) => ticket.group !== 'Tables')
  const tables = tickets.filter((ticket) => ticket.group === 'Tables')
  const sections = [
    { title: 'Entry passes', items: entry },
    { title: 'Tables', items: tables },
  ]
  return (
    <div className="to-groups">
      {sections.map(({ title, items }) => items.length > 0 && (
        <section key={title}>
          <div className="to-group-head"><h3>{title}</h3><span /></div>
          <div className="to-pass-grid">{items.map((ticket) => <PassCard key={ticket.id} ticket={ticket} extraState={extraState} />)}</div>
        </section>
      ))}
    </div>
  )
}
